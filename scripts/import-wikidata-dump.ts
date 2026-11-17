/** Stream the official Wikidata JSON bz2 dump into the default application. */
import { spawn } from 'node:child_process';
import { stat, readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { ArangoClient, configFromEnvironment, entityDocument, edgeDocuments, ensureApplicationDatabase } from '../src/server/arangodb';

import { normalizeDatatype, valueTypeFor } from '../src/shared/wikidata';

const CATEGORY = 'class/wikidata-import';
const identifier = (id: string) => 'wikidata:' + id;
const languageAllowed = (language:string) => language === 'en' || language === 'zh' || language.startsWith('zh-');
export const chineseEnglishOnly = (values:Record<string,any> = {}) => Object.fromEntries(Object.entries(values).filter(([language]) => languageAllowed(language)));
const typeIdentifier = (id:string) => 'class/wikidata/' + id;
export function wikidataTypes(record:any, property:string):string[] {
  return [...new Set<string>((record.claims?.[property] || []).filter((claim:any) => claim.rank !== 'deprecated' && claim.mainsnak?.snaktype === 'value')
    .map((claim:any) => claim.mainsnak?.datavalue?.value?.id).filter((id:any) => /^Q[1-9][0-9]*$/.test(id)))];
}
export function mergeWikidataTypes(classes:any[], references:string[], records:any[], projectId:number) {
  const byId=new Map(classes.map(row=>[row.id,row]));
  const definitions=new Map(records.map(row=>[row.data?.wikidata_id,row]));
  const pending=[...references]; const visited=new Set<string>();
  while(pending.length){
    const id=pending.shift()!;if(visited.has(id))continue;visited.add(id);
    const key=typeIdentifier(id);const source=definitions.get(id);
    const previous=byId.get(key);
    const labels=source?.labels || previous?.labels || {};
    const parents=source?.data?.wikidata_parent_ids || previous?.wikidata_parent_ids || [];
    const name=labels.zh?.value || labels['zh-hans']?.value || labels['zh-cn']?.value || labels['zh-hant']?.value || labels.en?.value || previous?.name || id;
    byId.set(key,{...previous,id:key,name,label:name,labels,project_id:projectId,source:'wikidata',wikidata_id:id,
      wikidata_parent_ids:parents,parent_id:null});
    for(const parent of parents)if(parent!==id)pending.push(parent);
  }
  // Wikidata permits multiple parents; preserve all IDs, and choose one acyclic display parent.
  for(const id of visited){
    const row=byId.get(typeIdentifier(id));
    for(const parent of row.wikidata_parent_ids){
      const key=typeIdentifier(parent);if(!byId.has(key)||key===row.id)continue;
      const seen=new Set([row.id]);let cursor=key;
      while(cursor && !seen.has(cursor)){seen.add(cursor);cursor=byId.get(cursor)?.parent_id;}
      if(cursor===row.id)continue;
      row.parent_id=key;break;
    }
  }
  return [...byId.values()];
}
const ontologyIdentifier = (id:string) => 'ontology/wikidata/' + id;
export function mergeWikidataOntologies(schema:any, entities:any[], edges:any[], projectId:number) {
  const ontologies=new Map(schema.ontologies.map((row:any)=>[row.id,row]));
  const root=null;
  ontologies.delete('ontology/wikidata-import');
  for(const cls of schema.classes.filter((row:any)=>row.source==='wikidata' && row.wikidata_id)){
    const id=ontologyIdentifier(cls.wikidata_id);
    ontologies.set(id,{...(ontologies.get(id) || {}),id,name:cls.name,label:cls.name,labels:cls.labels,
      parent_id:cls.parent_id?.startsWith('class/wikidata/') ? ontologyIdentifier(cls.parent_id.slice('class/wikidata/'.length)) : root,
      project_id:projectId,status:'active',source:'wikidata',wikidata_id:cls.wikidata_id,wikidata_parent_ids:cls.wikidata_parent_ids});
  }
  schema.ontologies=[...ontologies.values()];
  const byEntity=new Map(entities.map(row=>[row.sqlite_id,row]));
  const properties=new Map(schema.properties.map((row:any)=>[row.id,row]));
  const links=new Set(schema.ontology_properties.map((row:any)=>row.ontology_id+'\0'+row.property_id));
  for(const edge of edges){
    const entity:any=byEntity.get(edge.source_id);if(!entity)continue;
    const property=String(edge.property_id || '');if(!property)continue;
    if(!properties.has(property)){
      const datatype=normalizeDatatype(edge.datatype || edge.mainsnak?.datatype || 'string');
      properties.set(property,{id:property,name:property,alias:[property],datatype,valuetype:valueTypeFor(datatype),
        status:'active',source:'wikidata',project_id:projectId,types:[],description:''});
    }
    const types=entity.data?.wikidata_ontology_ids || [];
    for(const ontology of types){
      const key=ontology+'\0'+property;
      if(!links.has(key)){links.add(key);schema.ontology_properties.push({ontology_id:ontology,property_id:property});}
    }
  }
  schema.properties=[...properties.values()];
  return schema;
}
export function convertWikidata(record: any, projectId: number) {
  if (!/^Q[1-9][0-9]*$/.test(record.id || '') || record.type !== 'item') return null;
  const instanceTypes=wikidataTypes(record,'P31');
  const parentTypes=wikidataTypes(record,'P279');
  const timestamp = record.modified || '1970-01-01T00:00:00.000Z';
  const node = { id:identifier(record.id), project_id:projectId, name:chineseEnglishOnly(record.labels), description:chineseEnglishOnly(record.descriptions),
    aliases:chineseEnglishOnly(record.aliases), type:instanceTypes[0] ? ontologyIdentifier(instanceTypes[0]) : '', visibility:'public', created_at:timestamp, updated_at:timestamp,
    link:'https://www.wikidata.org/wiki/' + record.id,
    data:{ wikidata_id:record.id, wikidata_revision:record.lastrevid, wikidata_parent_ids:parentTypes, wikidata_ontology_ids:instanceTypes.map(ontologyIdentifier), sitelinks:Object.fromEntries(Object.entries(record.sitelinks || {}).filter(([site]) => ['zhwiki','enwiki'].includes(site))) } };
  const attributes: any[] = [];
  for (const [property, claims] of Object.entries(record.claims || {})) {
    for (const [index, original] of (claims as any[]).entries()) {
      const claim = structuredClone(original);
      const value = claim.mainsnak?.datavalue?.value;
      if (claim.mainsnak?.datatype === 'wikibase-item' && value?.id) value.id = identifier(value.id);
      attributes.push({ id:'wikidata:' + (claim.id || record.id + ':' + property + ':' + index), node_id:node.id,
        key:property, value:JSON.stringify(value ?? null), datatype:claim.mainsnak?.datatype || 'string',
        property_name_snapshot:property, statement_json:JSON.stringify(claim), created_at:timestamp });
    }
  }
  return { entity:entityDocument(node, undefined, instanceTypes.length ? instanceTypes.map(typeIdentifier) : []), edges:edgeDocuments(node, attributes), typeReferences:[...instanceTypes,...(parentTypes.length ? [record.id,...parentTypes] : [])] };
}

export function removeWikidataRoots(schema:any) {
  schema.classes=schema.classes.filter((row:any)=>row.id!==CATEGORY);
  schema.ontologies=schema.ontologies.filter((row:any)=>row.id!=='ontology/wikidata-import');
  for(const row of [...schema.classes,...schema.ontologies]) {
    if([CATEGORY,'ontology/wikidata-import'].includes(row.parent_id))row.parent_id=null;
    if([CATEGORY,'ontology/wikidata-import'].includes(row.parent))row.parent=null;
  }
  schema.ontology_properties=schema.ontology_properties.filter((row:any)=>row.ontology_id!=='ontology/wikidata-import');
  return schema;
}

export function readDefaultImportSchema(database: any, projectId: number) {
  // Same project-scoped fallback used by the application server.
  return {
    classes:database.query('SELECT * FROM classes WHERE project_id=? ORDER BY COALESCE(sort_order,rowid),name').all(projectId),
    ontologies:database.query('SELECT * FROM ontologies WHERE project_id=?').all(projectId),
    properties:database.query('SELECT * FROM properties WHERE project_id=?').all(projectId),
    ontology_properties:database.query('SELECT op.* FROM ontology_properties op JOIN ontologies o ON o.id=op.ontology_id WHERE o.project_id=?').all(projectId),
  };
}

const decoder = `import bz2,sys,os,errno
try:
 with bz2.open(sys.argv[1], 'rb') as source:
  skip=int(sys.argv[2])
  for number,line in enumerate(source,1):
   if number>skip:
    try:
     sys.stdout.buffer.write(line)
    except OSError as error:
     if error.errno not in (errno.EPIPE, errno.EINVAL): raise
     # Windows reports a consumer-closed pipe as EINVAL, not EPIPE.
     os.dup2(os.open(os.devnull, os.O_WRONLY), sys.stdout.fileno())
     break
finally:
 try:
  sys.stdout.buffer.flush()
 except OSError as error:
  if error.errno not in (errno.EPIPE, errno.EINVAL): raise
  os.dup2(os.open(os.devnull, os.O_WRONLY), sys.stdout.fileno())
`;

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('bun scripts/import-wikidata-dump.ts [--file=F:\\latest-all.json.bz2] [--batch-size=100] [--max-items=1000] [--dry-run] [--checkpoint=path] [--python=python]'); return;
  }
  const option = (key:string, fallback:string) => args.find(arg => arg.startsWith('--'+key+'='))?.slice(key.length+3) ?? fallback;
  const positive = (key:string, fallback:string) => { const n=Number(option(key,fallback)); if(!Number.isSafeInteger(n)||n<1)throw Error('Invalid --'+key);return n; };
  const file = resolve(option('file', 'F:/latest-all.json.bz2'));
  const batchSize = positive('batch-size','100');
  const maxItems = positive('max-items',String(Number.MAX_SAFE_INTEGER));
  const dryRun = args.includes('--dry-run');
  const checkpoint = resolve(option('checkpoint','data/wikidata-import.checkpoint.json'));
  const sourceStat = await stat(file);
  const signature = {file, size:sourceStat.size, mtimeMs:sourceStat.mtimeMs};
  let lineNumber=0, imported=0;
  if (!dryRun) {
    try {
      const saved = JSON.parse(await readFile(checkpoint,'utf8'));
      if (JSON.stringify(saved.source) !== JSON.stringify(signature)) throw Error('Checkpoint belongs to a different dump; select another --checkpoint.');
      if(saved.line>0 && saved.typeExtractionVersion!==2)throw Error('Checkpoint predates ontology extraction. Use --checkpoint=data/wikidata-ontologies.checkpoint.json to replay the dump and attach types without deleting existing knowledge.');
      lineNumber=saved.line; imported=saved.imported;
      if (!Number.isSafeInteger(lineNumber)||lineNumber<0||!Number.isSafeInteger(imported)||imported<0)throw Error('Invalid checkpoint');
      if(saved.complete){console.log('Dump already completed.');return;}
    } catch(error:any) { if(error.code!=='ENOENT')throw error; }
  }
  let client: ArangoClient | undefined;
  let store: import('../src/server/enterprise-knowledge').EnterpriseKnowledgeStore | undefined;
  let projectId=0;
  if (!dryRun) {
    const config=configFromEnvironment(); if(!config)throw Error('Set ARANGO_URL, ARANGO_USERNAME and ARANGO_PASSWORD.');
    const {getProjectByIdentifier, adminDb}=await import('../src/server/db');
    const project=getProjectByIdentifier('default'); if(!project)throw Error('Default application does not exist; initialize the application first.');
    projectId=Number(project.id);
    client=new ArangoClient(config);
    await ensureApplicationDatabase(client,'default');
    const {EnterpriseKnowledgeStore}=await import('../src/server/enterprise-knowledge');
    store=new EnterpriseKnowledgeStore(client);
    await store.ensureImportSchema('default');
    await store.transaction('default',async trx=>{
      const stored=await store.importSchema('default',trx);
      const schema=stored || readDefaultImportSchema(adminDb, projectId);
      if(!stored) console.log('Initializing ArangoDB schema from existing default application definitions.');
      removeWikidataRoots(schema);
      const result=await client!.database('default','/_api/document/knowledge_schema?overwriteMode=replace',{method:'POST',headers:{'x-arango-trx-id':trx},body:JSON.stringify([{_key:'definitions',...schema}])});
      if(!Array.isArray(result.body)||result.body.some((row:any)=>row.error))throw Error('Cannot save import category');
    },['knowledge_schema']);
  }
  console.log(JSON.stringify({file,dryRun,resumeLine:lineNumber,imported,batchSize}));
  if(lineNumber)console.log('Resuming requires streaming/decompressing from the start to the checkpoint.');
  const child=spawn(option('python','python'),['-u','-c',decoder,file,String(lineNumber)],{stdio:['ignore','pipe','inherit'],windowsHide:true});
  const completion=new Promise<number>((resolve,reject)=>{child.on('error',reject);child.on('close',code=>resolve(code ?? 1));});
  // Attach immediately so a missing Python executable cannot cause an unhandled rejection.
  completion.catch(()=>{});
  async function* readLines() {
    // Async chunk reads apply pipe backpressure while database batches are pending.
    let pending='';
    child.stdout.setEncoding('utf8');
    for await(const chunk of child.stdout){
      pending+=chunk;
      let index;
      while((index=pending.indexOf('\n'))>=0){yield pending.slice(0,index);pending=pending.slice(index+1);}
    }
    if(pending)yield pending;
  }
  const lines=readLines();
  let stopping=false, limited=false, finished=false, runItems=0;
  const stop=()=>{stopping=true;};process.on('SIGINT',stop);process.on('SIGTERM',stop);
  let entities:any[]=[], edges:any[]=[];
  let typeReferences=new Set<string>();
  const started=Date.now();
  async function bulk(collection:string, documents:any[]) {
    if(!client||!documents.length)return;
    // Keep individual HTTP payloads bounded even for items with many claims.
    for(let offset=0;offset<documents.length;offset+=500){
      const chunk=documents.slice(offset,offset+500);
      for(let attempt=0;;attempt++){
        try{
          const response=await client.database('default','/_api/import?collection='+collection+'&type=documents&onDuplicate=ignore&details=true',{method:'POST',headers:{'Content-Type':'application/x-ndjson'},body:chunk.map(row=>JSON.stringify(row)).join('\n')+'\n'});
          if(response.body.error||response.body.errors)throw Error('Import errors: '+JSON.stringify(response.body.details || response.body));
          break;
        }catch(error){if(attempt>=4)throw error;await Bun.sleep(1000*2**attempt);}
      }
    }
  }
  async function flush(complete=false){
    await bulk('entity',entities); await bulk('link',edges);
    if(store && entities.length){
      await store.transaction('default',async trx=>{
        const schema=await store!.importSchema('default',trx);if(!schema)throw Error('Missing application schema');
        const existingTypes=new Set(schema.classes.map(row=>row.wikidata_id).filter(Boolean));
        const refs=new Set([...typeReferences,...entities.filter(row=>existingTypes.has(row.data.wikidata_id)).map(row=>row.data.wikidata_id)]);
        const candidates:any[]=[];const queried=new Set<string>();let pending=[...refs];
        while(pending.length){
          const ids=pending.filter(id=>!queried.has(id));if(!ids.length)break;
          ids.forEach(id=>queried.add(id));pending=[];
          for(let offset=0;offset<ids.length;offset+=500){
            const found=await store!.query('default','FOR key IN @keys LET doc = DOCUMENT("entity", key) FILTER doc != null RETURN doc',
              {keys:ids.slice(offset,offset+500).map(id=>entityDocument({id:identifier(id)})._key)},trx);
            candidates.push(...found);
            for(const row of found)pending.push(...(row.data?.wikidata_parent_ids || []));
          }
        }
        removeWikidataRoots(schema);
        schema.classes=mergeWikidataTypes(schema.classes,[...refs],candidates,projectId);
        mergeWikidataOntologies(schema,entities,edges,projectId);
        const response=await client!.database('default','/_api/document/knowledge_schema?overwriteMode=replace',{method:'POST',headers:{'x-arango-trx-id':trx},body:JSON.stringify([{_key:'definitions',...schema}])});
        if(!Array.isArray(response.body)||response.body.some((row:any)=>row.error))throw Error('Type definitions could not be saved');
        // Replaying older imports must also attach the newly extracted types.
        await store!.query('default',`FOR input IN @rows LET doc = DOCUMENT('entity', input.key) FILTER doc != null
          UPDATE doc WITH { type: input.type, class_ids: UNION_DISTINCT(REMOVE_VALUE(NOT_NULL(doc.class_ids, []), @fallback), input.classes),
            data: MERGE(NOT_NULL(doc.data, {}), {wikidata_parent_ids:input.parents,wikidata_ontology_ids:input.ontologies}) } IN entity`,
          {rows:entities.map(row=>({key:row._key,classes:row.class_ids,parents:row.data.wikidata_parent_ids,type:row.type,ontologies:row.data.wikidata_ontology_ids})),fallback:CATEGORY},trx);
      },['knowledge_schema']);
    }
    typeReferences.clear();
    imported+=entities.length;entities=[];edges=[];
    if(!dryRun){await mkdir(dirname(checkpoint),{recursive:true});await writeFile(checkpoint+'.tmp',JSON.stringify({typeExtractionVersion:2,source:signature,line:lineNumber,imported,complete,updatedAt:new Date().toISOString()}));await rename(checkpoint+'.tmp',checkpoint);}
    console.log(JSON.stringify({line:lineNumber,imported,runItems,seconds:Math.round((Date.now()-started)/1000),complete}));
  }
  try {
    for await(const raw of lines){
      if(stopping){child.kill();break;}
      lineNumber++;
      const text=raw.trim().replace(/,$/,'');if(!text||text==='['||text===']')continue;
      let record;try{record=JSON.parse(text);}catch{throw Error('Invalid JSON at dump line '+lineNumber);}
      const converted=convertWikidata(record,projectId);if(!converted)continue;
      entities.push(converted.entity);edges.push(...converted.edges);for(const id of converted.typeReferences)typeReferences.add(id);runItems++;
      if(entities.length>=batchSize||edges.length>=5000)await flush();
      if(runItems>=maxItems){limited=true;child.kill();break;}
    }
    if(!stopping&&!limited){const code=await completion;if(code!==0)throw Error('bz2 decompression failed; checkpoint retained');finished=true;}
    await flush(finished);
  } finally {child.kill();await completion.catch(()=>{});process.off('SIGINT',stop);process.off('SIGTERM',stop);}
  console.log('Import stopped. Existing Wikidata IDs are preserved on reruns. Run scripts/sync-arango-to-es.ts --database=default to index search.');
}
if(import.meta.main)main().catch(error=>{console.error(error.message);process.exitCode=1;});
