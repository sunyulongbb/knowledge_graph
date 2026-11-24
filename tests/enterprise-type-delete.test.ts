import { test, expect } from 'bun:test';
import { createEnterpriseKnowledgeHandler } from '../src/server/routes/enterprise-knowledge';
test('Arango type deletion enforces permissions, checks children and persists schema', async () => {
  const previous = process.env.KNOWLEDGE_STORAGE_BACKEND;
  process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  try {
    let member = true, user: any = {id:42}, written: any, cleanup: any;
    let classes = [{id:'class/root',name:'Root'}, {id:'class/leaf',name:'Leaf',parent_id:'class/root'}];
    const handler = createEnterpriseKnowledgeHandler({
      store: { ensureImportSchema:async()=>{}, transaction:async (_:any, work:any)=>work('trx'),
        importSchema:async()=>({classes,ontologies:[],properties:[],ontology_properties:[]}),
        query:async (...args:any[])=>{cleanup=args; return [];},
        client:{database:async (_:any, path:any, options:any)=>{written=JSON.parse(options.body);return {body:[{error:false}]};}},
      } as any, getProject:()=>({id:7,name:'project'}), getUser:()=>user, canCreate:()=>member,
    });
    const remove = async (id:string) => { const url = new URL('http://localhost/api/kb/classes?db=project');url.searchParams.set('id',id);return (await handler(new Request(url,{method:'DELETE'}),url,'DELETE'))!; };
    user=null; expect((await remove('class/leaf')).status).toBe(401);
    user={id:42}; member=false; expect((await remove('class/leaf')).status).toBe(403);
    member=true; expect((await remove('class/root')).status).toBe(409);
    expect(written).toBeUndefined();
    expect((await remove('class/leaf')).status).toBe(200);
    expect(written[0].classes.map((row:any)=>row.id)).toEqual(['class/root']);
    expect(cleanup[2].id).toBe('class/leaf'); expect(cleanup[3]).toBe('trx');
    expect((await remove('missing')).status).toBe(404);
  } finally { if(previous===undefined)delete process.env.KNOWLEDGE_STORAGE_BACKEND;else process.env.KNOWLEDGE_STORAGE_BACKEND=previous; }
});

test('clearing classes uses Arango transaction, preserves ontology and checks membership', async () => {
 const previous=process.env.KNOWLEDGE_STORAGE_BACKEND;process.env.KNOWLEDGE_STORAGE_BACKEND='arangodb';
 try {
  let user:any=null,member=false,written:any,cleanup:any,fail=false;
  const handler=createEnterpriseKnowledgeHandler({store:{ensureImportSchema:async()=>{},transaction:async(_:any,work:any)=>work('clear-trx'),importSchema:async()=>({classes:[{id:'root'},{id:'child',parent_id:'root'}],ontologies:[{id:'type'}],properties:[{id:'property'}],ontology_properties:[]}),query:async(...args:any[])=>{cleanup=args;return []},client:{database:async(_:any,path:any,options:any)=>{written=JSON.parse(options.body);return {body:[{error:fail}]}}}} as any,getProject:()=>({id:7,name:'project'}),getUser:()=>user,canCreate:()=>member});
  const url=new URL('http://localhost/api/kb/classes/clear?db=project');const clear=()=>handler(new Request(url,{method:'DELETE'}),url,'DELETE');
  expect((await clear())?.status).toBe(401);user={id:42};expect((await clear())?.status).toBe(403);expect(written).toBeUndefined();
  member=true;const response=(await clear())!;expect(response.status).toBe(200);expect((await response.json()).deleted).toBe(2);
  expect(written[0].classes).toEqual([]);expect(written[0].ontologies).toEqual([{id:'type'}]);expect(written[0].properties).toEqual([{id:'property'}]);expect(cleanup[0]).toBe('project');expect(cleanup[1]).toContain('class_ids: []');expect(cleanup[3]).toBe('clear-trx');
  fail=true;expect((await clear())?.status).toBe(503);
 }finally{if(previous===undefined)delete process.env.KNOWLEDGE_STORAGE_BACKEND;else process.env.KNOWLEDGE_STORAGE_BACKEND=previous}
});
