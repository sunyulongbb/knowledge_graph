import {test,expect} from 'bun:test';
import {createEnterpriseKnowledgeHandler} from '../src/server/routes/enterprise-knowledge';
test('manual backup is administrator-only and status does not start a backup',async()=>{
 const previous=process.env.KNOWLEDGE_STORAGE_BACKEND;process.env.KNOWLEDGE_STORAGE_BACKEND='arangodb';
 let role='user',calls=0;
 const handler=createEnterpriseKnowledgeHandler({store:{} as any,getProject:()=>({id:1,name:'default'}),getUser:()=>({id:1,role} as any),canCreate:()=>true,
 backup:{flush:async()=>{calls++;},progress:()=>({running:false,error:null,backup:null})} as any});
 try{
 const url=new URL('http://localhost/api/kb/knowledge-sync/backup?db=default');
 expect((await handler(new Request(url),url,'GET'))?.status).toBe(403);expect(calls).toBe(0);
 role='admin';expect((await handler(new Request(url),url,'GET'))?.status).toBe(200);expect(calls).toBe(0);
 expect((await handler(new Request(url,{method:'POST'}),url,'POST'))?.status).toBe(202);expect(calls).toBe(1);
 }finally{if(previous===undefined)delete process.env.KNOWLEDGE_STORAGE_BACKEND;else process.env.KNOWLEDGE_STORAGE_BACKEND=previous;}
});
