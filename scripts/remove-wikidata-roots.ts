import {EnterpriseKnowledgeStore} from '../src/server/enterprise-knowledge';
import {removeWikidataRoots} from './import-wikidata-dump';
const store=EnterpriseKnowledgeStore.configured();
await store.transaction('default',async trx=>{
 const schema=await store.importSchema('default',trx);if(!schema)throw Error('Default schema is missing');
 removeWikidataRoots(schema);
 const {body}=await store.client.database('default','/_api/document/knowledge_schema?overwriteMode=replace',{method:'POST',headers:{'x-arango-trx-id':trx},body:JSON.stringify([{_key:'definitions',...schema}])});
 if(!Array.isArray(body)||body.some((row:any)=>row.error))throw Error('Schema update failed');
 await store.query('default',`FOR doc IN entity
  FILTER @class IN NOT_NULL(doc.class_ids, []) OR doc.type == @ontology
  UPDATE doc WITH {class_ids:REMOVE_VALUE(NOT_NULL(doc.class_ids, []),@class),type:doc.type == @ontology ? '' : doc.type} IN entity`,
  {class:'class/wikidata-import',ontology:'ontology/wikidata-import'},trx);
 console.log(JSON.stringify({classes:schema.classes.length,ontologies:schema.ontologies.length,removed:'artificial Wikidata roots only'}));
},['knowledge_schema']);
