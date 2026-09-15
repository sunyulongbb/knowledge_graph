import { afterEach, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { PipelineStore, normalizeTable } from '../src/server/pipeline/store.ts';
import { CleaningEngine, mergeValues, validateFlow } from '../src/server/pipeline/engine.ts';
import { createKnowledgeDatabase, ensureKnowledgeAccessSchema, knowledgeContext } from '../src/server/knowledge-access.ts';
import { parseCsv, parseJsonTable, matrixToTable, defaultFlow } from '../public/assets/scripts/pipeline-data.js';
import { readMysql, selectQuery, wikidataQuery } from '../src/server/pipeline/sources.ts';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createPipelineHandler } from '../src/server/pipeline/http.ts';
import { inferBasicFields, basicList, basicText } from '../public/assets/scripts/pipeline-fields.js';

const databases: Database[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
const user = { id: 1, username: 'admin', role: 'admin' };
function fixture(rows: any[] = [{ id: '1', name: '张三', birthday: '1990-01-01', country: '中国', job: '工程师' }]) {
  const raw = new Database(':memory:'); databases.push(raw);
  raw.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE nodes (id TEXT PRIMARY KEY, name TEXT, type TEXT, aliases TEXT, description TEXT, tags TEXT, project_id INTEGER, updated_at TEXT, data TEXT);
    CREATE TABLE attributes (id TEXT PRIMARY KEY, node_id TEXT REFERENCES nodes(id), key TEXT, value TEXT, datatype TEXT, property_name_snapshot TEXT, statement_json TEXT);
    CREATE TABLE ontologies (id TEXT PRIMARY KEY, name TEXT, parent_id TEXT, project_id INTEGER);
    CREATE TABLE properties (id TEXT PRIMARY KEY, name TEXT, datatype TEXT, valuetype TEXT, tail_ontology_id TEXT, project_id INTEGER, status TEXT);
    CREATE TABLE ontology_properties (ontology_id TEXT, property_id TEXT);
    INSERT INTO ontologies VALUES ('person','人物',NULL,1),('country','国家',NULL,1),('other','另一应用',NULL,2);
    INSERT INTO properties VALUES ('birthday','出生日期','time','time',NULL,1,'active'),('country','国籍','wikibase-item','wikibase-entityid','country',1,'active'),('job','职业','string','string',NULL,1,'active');
    INSERT INTO ontology_properties VALUES ('person','birthday'),('person','country'),('person','job');
  `);
  ensureKnowledgeAccessSchema(raw); PipelineStore.migrate(raw);
  const db = createKnowledgeDatabase(raw), store = new PipelineStore(raw, 1, 1);
  const table = store.saveTable({ name: '人物表', sourceType: 'file', sourceKey: 'people', columns: Object.keys(rows[0]), rows });
  const flow: any = defaultFlow(table.id);
  flow.nodes.find((n: any) => n.type === 'ontology').config.ontologyId = 'person';
  flow.nodes.find((n: any) => n.type === 'properties').config = { idField: 'id', nameField: 'name', mapping: Object.fromEntries(table.columns.filter(c => !['id','name'].includes(c)).map(c => [c,c])) };
  const saved = store.saveFlow(flow), engine = new CleaningEngine(store,db,user);
  const run = (mode: 'preview' | 'full' = 'full', decisions = {}) => knowledgeContext.run({ user }, () => store.saveRun(saved.id,mode,engine.plan(saved,mode,decisions)));
  const confirm = (id: string) => knowledgeContext.run({ user },() => engine.confirm(id));
  return { raw, db, store, table, flow: saved, engine, run, confirm };
}

test('CSV quoting, BOM, multiline fields, missing cells and JSON union preserve two-dimensional data', () => {
  expect(parseCsv('\uFEFFid,name,note\r\n001,"张,三","第一行\n第二行"\r\n002,"李""四",')).toEqual({ columns:['id','name','note'], rows:[{id:'001',name:'张,三',note:'第一行\n第二行'},{id:'002',name:'李"四',note:''}] });
  expect(() => parseCsv('id,id\n1,2')).toThrow('表头');
  expect(() => parseCsv('id,name\n1,"bad')).toThrow('未闭合');
  expect(() => parseCsv('id,name\n1,"bad"x')).toThrow('引号后');
  expect(parseJsonTable('[{"id":1,"extra":{"a":2}},{"name":"张三"}]').rows[1]).toEqual({id:null,extra:null,name:'张三'});
  expect(() => parseJsonTable('{}')).toThrow('对象数组');
});

test('existing Excel component reads workbook cells into the shared matrix adapter', () => {
  const context: any = { console }; vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../public/js/xlsx.full.min.js',import.meta.url),'utf8'),context);
  const xlsx = context.XLSX;
  const sheet = xlsx.utils.aoa_to_sheet([['id','name'],['001','张三']]);
  const book = xlsx.utils.book_new(); xlsx.utils.book_append_sheet(book,sheet,'人物');
  const loaded = xlsx.read(xlsx.write(book,{type:'base64',bookType:'xlsx'}),{type:'base64'});
  const matrix = xlsx.utils.sheet_to_json(loaded.Sheets['人物'],{header:1,raw:false});
  expect(matrixToTable(matrix).rows).toEqual([{id:'001',name:'张三'}]);
});

test('staging keeps only selected columns and never creates knowledge; tables and flows are scoped', () => {
  const f = fixture();
  expect(f.raw.query('SELECT COUNT(*) AS n FROM nodes').get()).toEqual({n:0});
  expect(normalizeTable({name:'表',sourceType:'file',sourceKey:'test',columns:['id'],rows:[{id:1,password:'omitted'}]}).rows).toEqual([{id:1}]);
  const otherProject = new PipelineStore(f.raw,2,1), otherUser = new PipelineStore(f.raw,1,2);
  for (const store of [otherProject,otherUser]) {
    expect(store.listTables()).toEqual([]); expect(() => store.getTable(f.table.id)).toThrow();
    expect(() => store.getFlow(f.flow.id)).toThrow(); expect(() => store.saveFlow(f.flow)).toThrow();
  }
  expect(f.store.getFlow(f.flow.id)).toEqual(f.flow);
});

test('flow validation rejects missing nodes, branches, cycles, disconnected paths and invalid mappings', () => {
  const f = fixture();
  for (const edges of [[],[{from:'output',to:'input'}], [...f.flow.edges.slice(1),{from:'input',to:'output'}]]) expect(() => validateFlow({...f.flow,edges})).toThrow();
  expect(() => validateFlow({...f.flow,nodes:f.flow.nodes.slice(1)})).toThrow();
  f.flow.nodes.find(n=>n.type==='properties')!.config.mapping = {};
  expect(() => f.engine.plan(f.flow,'preview')).toThrow('尚未映射');
  f.flow.nodes.find(n=>n.type==='ontology')!.config.ontologyId = 'other';
  expect(() => f.engine.plan(f.flow,'preview')).toThrow('当前应用');
});

test('preview processes at most 100 rows with zero knowledge mutations', () => {
  const f = fixture(Array.from({length:101},(_,i)=>({id:String(i),name:'人物'+i,job:'工程师'})));
  const run = f.run('preview');
  expect(run.result.summary.input).toBe(100); expect(run.result.rows.length).toBe(100);
  expect(f.raw.query('SELECT COUNT(*) AS n FROM nodes').get()).toEqual({n:0});
  expect(f.raw.query('SELECT COUNT(*) AS n FROM attributes').get()).toEqual({n:0});
  expect(() => f.confirm(run.id)).toThrow('只能确认');
  expect(f.run().result.summary.input).toBe(101);
});

test('confirm writes typed attributes, relations and ownership, and repeated confirm/run is idempotent', () => {
  const f = fixture(), run = f.run();
  expect(run.result.summary).toMatchObject({created:2,attributesAdded:3,failed:0});
  expect(f.raw.query('SELECT COUNT(*) AS n FROM nodes').get()).toEqual({n:0});
  const completed = f.confirm(run.id); expect(completed.status).toBe('completed');
  expect(f.confirm(run.id).status).toBe('completed');
  expect(f.raw.query('SELECT COUNT(*) AS n FROM nodes').get()).toEqual({n:2});
  const main: any = f.raw.query("SELECT * FROM nodes WHERE type='person'").get();
  expect(main.owner_user_id).toBe(1);
  const time: any = f.raw.query("SELECT * FROM attributes WHERE key='birthday'").get();
  expect(JSON.parse(time.value)).toMatchObject({time:'+1990-01-01T00:00:00Z',precision:11});
  const reference: any = f.raw.query("SELECT * FROM attributes WHERE key='country'").get();
  expect(reference.datatype).toBe('wikibase-entityid');
  expect(JSON.parse(reference.statement_json).datavalue.type).toBe('wikibase-entityid');
  expect(f.run().result.summary).toMatchObject({aligned:1,created:0,updated:0,conflicts:0});
});

test('same name and ontology requires a decision; link/new/skip work and foreign entities are excluded', () => {
  const f = fixture([{id:'1',name:'张三',job:'工程师'}]);
  f.raw.run("INSERT INTO nodes(id,name,type,project_id) VALUES ('existing','张三','person',1),('foreign','张三','person',2)");
  const run = f.run(); expect(run.result.rows[0].candidates).toEqual([{id:'existing',name:'张三'}]);
  expect(run.result.summary.unresolved).toBe(1); expect(() => f.confirm(run.id)).toThrow('疑似');
  expect(f.run('full',{'0':{action:'skip'}}).result.summary.skipped).toBe(1);
  expect(f.run('full',{'0':{action:'new'}}).result.summary.created).toBe(1);
  const linked = f.run('full',{'0':{action:'link',entityId:'existing'}});
  expect(linked.result.summary.updated).toBe(1); f.confirm(linked.id);
  expect(f.run().result.summary.aligned).toBe(1);
});

test('duplicate source IDs within a table reuse the same planned entity; candidate IDs survive rerun', () => {
  const f = fixture([{id:'1',name:'张三',job:'工程师'},{id:'1',name:'张三',job:'教师'},{id:'2',name:'张三',job:'研究员'}]);
  const first = f.run(); expect(first.result.summary).toMatchObject({created:1,aligned:1,suspected:1});
  const candidate = first.result.rows[2].candidates[0].id;
  const next = f.run('full',{'2':{action:'link',entityId:candidate}});
  expect(next.result.summary).toMatchObject({created:1,unresolved:0,failed:0});
  f.confirm(next.id); expect(f.raw.query('SELECT COUNT(*) AS n FROM nodes').get()).toEqual({n:1});
});

test('fusion fills empty values, deduplicates and applies keep/replace/merge policies', () => {
  expect(mergeValues([],['a'],'keep')).toEqual({values:['a'],conflict:false});
  expect(mergeValues(['a'],['a','a'],'merge')).toEqual({values:['a'],conflict:false});
  expect(mergeValues(['a'],['b'],'keep')).toEqual({values:['a'],conflict:true});
  expect(mergeValues(['a'],['b'],'replace')).toEqual({values:['b'],conflict:true});
  expect(mergeValues(['a'],['b','a'],'merge')).toEqual({values:['a','b'],conflict:true});
  expect(mergeValues([0],[false],'merge').values).toEqual([0,false]);
});

test('numeric-looking text attributes stay unchanged when importing the same source again', () => {
  const f = fixture([{id:'1',name:'张三',job:'123'}]);
  f.confirm(f.run().id);
  expect(f.run().result.summary).toMatchObject({created:0,updated:0,conflicts:0});
});

test('basic fields detect Chinese and Wikidata names while keeping explicit decisions and custom property mappings', () => {
  expect(inferBasicFields(['来源ID','名称','别名','描述','标签'])).toMatchObject({idField:'来源ID',nameField:'名称',aliasesField:'别名',descriptionField:'描述',tagsField:'标签'});
  expect(inferBasicFields(['id','labels','aliases','descriptions','tags'])).toMatchObject({idField:'id',nameField:'labels',aliasesField:'aliases',descriptionField:'descriptions',tagsField:'tags'});
  expect(inferBasicFields(['id','name','aliases','description'],{aliasesField:'',mapping:{description:'job'}})).toMatchObject({aliasesField:'',descriptionField:'',mapping:{description:'job'}});
  expect(basicText({zh:{language:'zh',value:'人物'},en:{language:'en',value:'Person'}},'en')).toBe('Person');
  expect(basicList({zh:[{value:'老张'},{value:'张工'},{value:'老张'}]})).toEqual(['老张','张工']);
  expect(basicList('中国;人物、科学家|中国')).toEqual(['中国','人物','科学家']);
});

test('basic metadata previews without writing and commits directly to entity fields, with repeat imports deduplicated', () => {
  const f=fixture([{id:'1',labels:{zh:{value:'张三'},en:{value:'Zhang'}},aliases:{zh:[{value:'老张'},{value:'张工'}]},descriptions:{zh:{value:'人物介绍'}},tags:'人物;工程师;人物'}]);
  f.flow.nodes.find(n=>n.type==='properties')!.config={mapping:{}};
  const preview=f.run('preview');
  expect(preview.result.rows[0].basic).toEqual({id:'1',name:'张三',aliases:['老张','张工'],description:'人物介绍',tags:['人物','工程师']});
  expect(preview.result.summary).toMatchObject({created:1,attributesAdded:0,failed:0});
  expect(f.raw.query('SELECT COUNT(*) AS n FROM nodes').get()).toEqual({n:0});
  const run=f.run(); f.confirm(run.id);
  expect(f.raw.query('SELECT name,aliases,description,tags FROM nodes').get()).toEqual({name:'张三',aliases:'["老张","张工"]',description:'人物介绍',tags:'["人物","工程师"]'});
  expect(f.raw.query('SELECT COUNT(*) AS n FROM attributes').get()).toEqual({n:0});
  expect(f.run().result.summary).toMatchObject({created:0,updated:0,failed:0});
});

test('metadata fusion combines aliases and tags, handles description strategies and rejects duplicate base mapping', () => {
  for (const strategy of ['keep','replace','merge']) {
    const f=fixture([{id:'1',name:'新名',aliases:['别名','老别名'],description:'新描述',tags:['新标签','原标签']}]);
    f.flow.nodes.find(n=>n.type==='properties')!.config={mapping:{}};
    f.flow.nodes.find(n=>n.type==='fusion')!.config.strategy=strategy;
    f.raw.run("INSERT INTO nodes(id,name,type,aliases,description,tags,project_id) VALUES ('existing','原名','person','[\"老别名\"]','原描述','[\"原标签\"]',1)");
    f.raw.run("INSERT INTO cleaning_entity_sources VALUES ('1','people','1','person','existing')");
    const run=f.run();expect(run.result.summary.failed).toBe(0);f.confirm(run.id);
    expect(f.raw.query('SELECT name,description,aliases,tags FROM nodes').get()).toEqual({name:'原名',description:strategy==='keep'?'原描述':strategy==='replace'?'新描述':'原描述\n新描述',aliases:'["老别名","别名","新名"]',tags:'["原标签","新标签"]'});
    expect(f.run().result.summary.updated).toBe(0);
    f.flow.nodes.find(n=>n.type==='properties')!.config={idField:'id',nameField:'name',aliasesField:'name',mapping:{}};
    expect(()=>f.run()).toThrow('不重复');
  }
});

test('existing flows can still use one source column as both identifier and entity name', () => {
  const f=fixture([{id:'张三'}]);
  f.flow.nodes.find(n=>n.type==='properties')!.config={idField:'id',nameField:'id',mapping:{}};
  expect(f.run().result.summary).toMatchObject({created:1,failed:0});
});

test('fusion retains separate statement metadata and fills previously unknown values with a value snak', () => {
  const f=fixture([{id:'1',name:'张三',job:'教师',birthday:'2000-01-01'}]);
  f.raw.run("INSERT INTO nodes(id,name,type,aliases,project_id) VALUES ('existing','张三','person','[]',1)");
  f.raw.run("INSERT INTO cleaning_entity_sources VALUES ('1','people','1','person','existing')");
  const metadata=JSON.stringify({property:'job',datatype:'string',snaktype:'value',references:[{source:'source-b'}],qualifiers:{context:'test'}});
  f.raw.run("INSERT INTO attributes(id,node_id,key,value,datatype,statement_json) VALUES ('a','existing','job','工程师','string','{}'),('b','existing','job','研究员','string',?),('c','existing','birthday','','time',?)",[metadata,JSON.stringify({snaktype:'somevalue',rank:'preferred'})]);
  f.flow.nodes.find(n=>n.type==='fusion')!.config.strategy='merge';
  f.confirm(f.run().id);
  expect((f.raw.query("SELECT statement_json FROM attributes WHERE id='b'").get() as any).statement_json).toBe(metadata);
  const birthday=JSON.parse((f.raw.query("SELECT statement_json FROM attributes WHERE id='c'").get() as any).statement_json);
  expect(birthday).toMatchObject({snaktype:'value',rank:'preferred',datavalue:{type:'time'}});
  expect(f.run().result.summary.updated).toBe(0);
});

test('source ID matching preserves original name as new name becomes alias and replaces conflicting property', () => {
  const f = fixture([{id:'1',name:'新名称',job:'新职业'}]);
  f.raw.run("INSERT INTO nodes(id,name,type,aliases,project_id) VALUES ('existing','旧名称','person','[]',1)");
  f.raw.run("INSERT INTO attributes(id,node_id,key,value,datatype,statement_json) VALUES ('a','existing','job','原职业','string','{}')");
  f.raw.run("INSERT INTO cleaning_entity_sources VALUES ('1','people','1','person','existing')");
  f.flow.nodes.find(n=>n.type==='fusion')!.config.strategy='replace';
  const run=f.run(); expect(run.result.summary.conflicts).toBe(2); f.confirm(run.id);
  expect(f.raw.query("SELECT name, aliases FROM nodes WHERE id='existing'").get()).toEqual({name:'旧名称',aliases:'["新名称"]'});
  expect(f.raw.query("SELECT value FROM attributes WHERE id='a'").get()).toEqual({value:'新职业'});
});

test('bad rows cannot leak partially planned entities or mutate someone else knowledge', () => {
  const f = fixture([{id:'1',name:'bad',country:'新国家',birthday:'invalid',job:'职业'},{id:'2',name:'owned',country:'中国',birthday:'2000-01-01',job:'职业'}]);
  f.raw.run("INSERT INTO nodes(id,name,type,project_id,owner_user_id) VALUES ('owned','owned','person',1,99)");
  const run = f.run('full',{'1':{action:'link',entityId:'owned'}});
  expect(run.result.summary.failed).toBe(2); expect(run.result.changes).toEqual([]);
  expect(run.result.rows[0].error).toContain('时间'); expect(run.result.rows[1].error).toContain('维护权限');
});

test('stale knowledge is rejected and a failed transaction rolls back nodes, properties and provenance', () => {
  const f=fixture(), stale=f.run();
  f.raw.run("INSERT INTO nodes(id,name,type,project_id) VALUES ('other','其他','person',1)");
  expect(()=>f.confirm(stale.id)).toThrow('已变化');
  const run=f.run();
  f.raw.exec("CREATE TRIGGER fail_attribute BEFORE INSERT ON attributes BEGIN SELECT RAISE(ABORT,'test write failure'); END");
  expect(()=>f.confirm(run.id)).toThrow('test write failure');
  expect(f.raw.query('SELECT COUNT(*) AS n FROM nodes').get()).toEqual({n:1});
  expect(f.raw.query('SELECT COUNT(*) AS n FROM cleaning_entity_sources').get()).toEqual({n:0});
  expect(f.store.getRun(run.id).status).toBe('pending');
});

test('source adapters expose demo separately, reject writes, and build validated simple Wikidata queries', async () => {
  const demo = await readMysql({demo:true,action:'read'}); expect(demo.demo).toBe(true); expect(demo.rows.length).toBe(3);
  expect(selectQuery({table:'people'})).toBe('SELECT * FROM `people`');
  for(const sql of ['DELETE FROM people','SELECT 1; DROP TABLE people','SELECT * INTO OUTFILE \'x\' FROM people','SELECT SLEEP(20)']) expect(()=>selectQuery({sql})).toThrow();
  expect(wikidataQuery({entityType:'Q5',language:'zh',limit:20,property:'P27',value:'Q148'}).query).toContain('?id wdt:P27 wd:Q148');
  expect(()=>wikidataQuery({entityType:'Q5 } UNION {'})).toThrow();
  expect(()=>wikidataQuery({query:'DELETE WHERE { ?s ?p ?o }'})).toThrow();
});

test('HTTP APIs enforce authentication and scope, separate pending runs from confirmation and hide internal plans', async () => {
  const f = fixture();
  const handler = createPipelineHandler(f.raw,f.db,req=>req.headers.get('test-user')==='admin'?user:req.headers.get('test-user')==='user'?{...user,role:'user'}:null,slug=>slug==='demo'?{id:1}:null);
  const request = (path: string, body?: any, identity='admin', project='demo') => {
    const url=new URL('http://test/api/kb/pipeline/'+path);url.searchParams.set('db',project);
    const req=new Request(url,{method:body===undefined?'GET':'POST',headers:{'test-user':identity,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    return knowledgeContext.run({user},()=>handler(req,url,req.method));
  };
  expect((await request('tables',undefined,''))?.status).toBe(401);
  expect((await request('tables',undefined,'user'))?.status).toBe(403);
  expect((await request('tables',undefined,'admin','missing'))?.status).toBe(404);
  expect((await request('tables/'+f.table.id,undefined,'admin','app'))?.status).toBe(400);
  expect(((await (await request('tables'))!.json()) as any).items).toHaveLength(1);
  const run: any=await (await request('run',{flowId:f.flow.id,mode:'full'}))!.json();
  expect(run.status).toBe('pending');expect(run.result.changes).toBeUndefined();expect(run.result.fingerprint).toBeUndefined();
  expect((await request('confirm',{runId:run.id}))?.status).toBe(400);
  expect((await request('confirm',{runId:run.id,confirm:true}))?.status).toBe(200);
  const restored: any=await (await request('runs/'+run.id))!.json();expect(restored.status).toBe('completed');
  const records: any=await (await request('runs'))!.json();expect(records.items[0].summary.created).toBe(2);
});
