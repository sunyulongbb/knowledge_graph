import {test,expect} from 'bun:test';
import {createEnterpriseKnowledgeHandler} from '../src/server/routes/enterprise-knowledge';
test('lightweight class tree does not scan knowledge or relationships',async()=>{
 const previous=process.env.KNOWLEDGE_STORAGE_BACKEND;process.env.KNOWLEDGE_STORAGE_BACKEND='arangodb';
 try{
 const schema={classes:[{id:'class/a',name:'A',analyses:['large'],parent_id:null}],ontologies:[],properties:[],ontology_properties:[]};
 const store={ensure:async()=>{},importSchema:async()=>schema,summary:async()=>{throw Error('Full graph scan');}} as any;
 const handler=createEnterpriseKnowledgeHandler({store,getProject:()=>({id:1,name:'default'}),getUser:()=>null,canCreate:()=>false});
 const url=new URL('http://localhost/api/kb/classes?db=default&counts=0');
 const response=await handler(new Request(url),url,'GET');expect(response?.status).toBe(200);
 const rows=await response!.json();expect(rows[0].name).toBe('A');expect(rows[0].instance_count).toBeUndefined();expect(rows[0].analyses).toBeUndefined();
 }finally{if(previous===undefined)delete process.env.KNOWLEDGE_STORAGE_BACKEND;else process.env.KNOWLEDGE_STORAGE_BACKEND=previous;}
});
