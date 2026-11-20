import { test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createTopicsHandler } from '../src/server/topics';
test('topics require login and scope Arango writes and reads to their owner and application',async()=>{
 const db=new Database(':memory:');db.run('CREATE TABLE application_members(project_id INTEGER,user_id INTEGER)');let user:any=null;
 const queries:any[]=[];const store:any={client:{database:async()=>({})},query:async(database:string,query:string,vars:any)=>{queries.push({database,query,vars});return []}};
 const handler=createTopicsHandler({db,store,getUser:()=>user,getProject:()=>({id:7,name:'example',is_default:1})});
 const url=new URL('http://localhost/api/kb/topics?db=example');
 expect((await handler(new Request(url),url))?.status).toBe(401);expect(queries.length).toBe(0);
 user={id:3};expect((await handler(new Request(url),url))?.status).toBe(200);expect(queries[0].vars).toEqual({owner:3,project:7});
 const response=await handler(new Request(url,{method:'POST',body:JSON.stringify({name:'人物',category:'gender',groups:'country',rows:[{secret:'must not persist'}]})}),url);
 expect(response?.status).toBe(201);expect(queries[1].database).toBe('example');expect(queries[1].vars.doc.owner).toBe(3);expect(queries[1].vars.doc.rows).toEqual([]);
 const itemUrl=new URL('http://localhost/api/kb/topics/other');expect((await handler(new Request(itemUrl,{method:'DELETE'}),itemUrl))?.status).toBe(404);expect(queries[2].vars.owner).toBe(3);db.close();
});
