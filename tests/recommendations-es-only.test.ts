import {test,expect} from 'bun:test';
import {Database} from 'bun:sqlite';
import {EnterpriseKnowledgeSearch} from '../src/server/enterprise-search';
import {createKnowledgeRecommendations} from '../src/server/knowledge-recommendations';
test('ES-only search never reads Arango and includes indexed source permission filtering',async()=>{
 let body:any;
 const store={searchAccess:()=>{throw Error('Arango accessed');}} as any;
 const client={send:async (_:string,init:any)=>{body=JSON.parse(init.body);return {body:{hits:{total:{value:1},hits:[{_id:'key',_source:{sqlite_id:'Q1',visibility:'public'}}]}}};}} as any;
 const search=new EnterpriseKnowledgeSearch(store,client);
 const page=await search.search('default',null,{esOnly:true,limit:24,offset:0});
 expect(page.total).toBe(1);expect(page.nodes[0].sqlite_id).toBe('Q1');
 expect(body._source.excludes).toContain('data');
 expect(body.runtime_mappings.recommendation_readable).toBeDefined();
 expect(body.query.bool.filter).toContainEqual({term:{recommendation_readable:true}});
});
test('recommendation pages read ES candidates and content without any graph reads',async()=>{
 const db=new Database(':memory:');let calls=0;
 try{
  const store={get:()=>{throw Error('Graph get');},query:()=>{throw Error('Graph query');},searchAccess:()=>{throw Error('Graph scan');}} as any;
  const nodes=[{id:'Q1',name:'Example',tags:[],class_ids:['class/test']}];
  const handler=createKnowledgeRecommendations({db,store,getProject:()=>({id:1,name:'default'}),getUser:()=>null,
   search:async (_req,url)=>{calls++;const ids=url.searchParams.get('ids');return Response.json({nodes:ids?nodes.filter(node=>JSON.parse(ids).includes(node.id)):nodes,total:1});}});
  const url=new URL('http://localhost/api/kb/recommendations?recommendation_seed=test');
  const response=await handler.handle(new Request(url),url);expect(response?.status).toBe(200);
  expect((await response!.json()).nodes[0].name).toBe('Example');expect(calls).toBeGreaterThan(1);
 }finally{db.close();}
});

test('recommendation page rechecks only the requested page of candidate IDs',async()=>{
 const db=new Database(':memory:');const sizes:number[]=[];
 try{
 const nodes=Array.from({length:80},(_,i)=>({id:'Q'+i,name:'Example',tags:[]}));
 const handler=createKnowledgeRecommendations({db,store:null,getProject:()=>({id:1,name:'default'}),getUser:()=>null,
 search:async(_req,url)=>{const ids=url.searchParams.get('ids');if(ids)sizes.push(JSON.parse(ids).length);return Response.json({nodes:ids?nodes.filter(node=>JSON.parse(ids).includes(node.id)):nodes,total:80});}});
 const url=new URL('http://localhost/api/kb/recommendations?limit=24&offset=24&recommendation_seed=bounded');
 expect((await handler.handle(new Request(url),url))?.status).toBe(200);
 expect(sizes).toEqual([24]);
 }finally{db.close();}
});

test('refresh seeds reuse candidate reads but each page still queries ES',async()=>{
 const db=new Database(':memory:');const orders:string[]=[];let pages=0;
 try{
 const handler=createKnowledgeRecommendations({db,store:null,getProject:()=>({id:1,name:'default'}),getUser:()=>null,
 search:async(_req,url)=>{if(url.searchParams.has('ids'))pages++;else orders.push(url.searchParams.get('order')!);return Response.json({nodes:[{id:'Q1',tags:[]}],total:1});}});
 for(const seed of ['a','b']){const url=new URL('http://localhost/api/kb/recommendations?recommendation_seed='+seed);expect((await handler.handle(new Request(url,{headers:{cookie:'kb_viewer=stable-viewer-123456'}}),url))?.status).toBe(200);}
 expect(orders.filter(order=>order==='richness')).toHaveLength(1);
 expect(orders.filter(order=>order==='created_desc')).toHaveLength(1);
 expect(pages).toBe(2);
 }finally{db.close();}
});
test('ES recommendation richness uses indexed media instead of source ranking scripts',async()=>{
 let body:any;const client={send:async(_:string,init:any)=>{body=JSON.parse(init.body);return {body:{hits:{total:{value:0},hits:[]}}};}} as any;
 await new EnterpriseKnowledgeSearch({} as any,client).search('default',null,{esOnly:true,order:'richness',limit:24,offset:0});
 expect(body.runtime_mappings.home_richness).toBeUndefined();expect(body.runtime_mappings.home_media).toBeUndefined();
 expect(body.sort[0]).toEqual({has_media:{order:'desc',unmapped_type:'boolean'}});
});
