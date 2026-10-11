import { test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createGraphCanvasHandler } from '../src/server/graph-canvases.ts';
function setup() {
  const db=new Database(':memory:');
  db.run('CREATE TABLE application_members(project_id INTEGER,user_id INTEGER)');
  db.run('INSERT INTO application_members VALUES(10,1),(10,2),(20,1)');
  db.run('CREATE TABLE nodes(id TEXT,project_id INTEGER,owner_user_id INTEGER,visibility TEXT)');
  db.run("INSERT INTO nodes VALUES('a',10,9,'private'),('b',10,9,'public'),('foreign',20,9,'private')");
  db.run('CREATE TABLE knowledge_maintainers(node_id TEXT,user_id INTEGER)');
  const handler=createGraphCanvasHandler(db,req=>{
    const id=Number(req.headers.get('user'));return id?{id,username:String(id),memberProjectIds:(db.query('SELECT project_id FROM application_members WHERE user_id=?').all(id) as any[]).map(m=>m.project_id)}:null;
  },slug=>({mine:{id:10,owner_user_id:9},other:{id:20,owner_user_id:9}}[slug]));
  const call=(method='GET',path='',body?:any,user=1,scope='mine')=>{
    const url=new URL('http://192.168.1.10:8080/api/graph-canvases'+path+'?db='+scope);
    return handler(new Request(url,{method,headers:{user:String(user),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),url);
  };
  const graph={nodes:[{data:{id:'entity/a',label:'A'},position:{x:12,y:34}},{data:{id:'entity/b',label:'B'},position:{x:150,y:90}}],edges:[{data:{id:'edge/a',source:'entity/a',target:'entity/b',label:'关系'}}],zoom:1.5,pan:{x:20,y:-10}};
  return {db,call,graph};
}
test('personal canvases save nodes, relationships and viewport and isolate users and applications',async()=>{
  const h=setup();try{
    const created=await (await h.call('POST','',{name:'研究',graph:h.graph}))!.json();
    expect(created.revision).toBe(1);
    expect((await (await h.call('GET','/'+created.id))!.json()).graph).toEqual(h.graph);
    expect((await h.call('GET','/'+created.id,undefined,2))!.status).toBe(404);
    expect((await h.call('GET','/'+created.id,undefined,1,'other'))!.status).toBe(404);
    expect((await (await h.call('GET','',undefined,2))!.json()).items).toHaveLength(0);
    expect((await h.call('PUT','/'+created.id,{name:'更名',graph:h.graph,revision:1}))!.status).toBe(200);
    expect((await h.call('PUT','/'+created.id,{name:'旧修改',graph:h.graph,revision:1}))!.status).toBe(409);
    expect((await h.call('DELETE','/'+created.id))!.status).toBe(200);
    expect(h.db.query('SELECT count(*) as n FROM nodes').get()).toEqual({n:3});
  }finally{h.db.close();}
});
test('canvas access requires membership; foreign nodes and invalid graph data are rejected',async()=>{
  const h=setup();try{
    expect((await h.call('GET','',undefined,0))!.status).toBe(401);
    expect((await h.call('GET','',undefined,3))!.status).toBe(403);
    expect((await h.call('POST','',{name:'坏画布',graph:{...h.graph,nodes:[{data:{id:'foreign'},position:{x:0,y:0}}],edges:[]}}))!.status).toBe(403);
    expect((await h.call('POST','',{name:'坏画布',graph:{...h.graph,zoom:99}}))!.status).toBe(400);
    const created=await (await h.call('POST','',{name:'研究',graph:h.graph}))!.json();
    h.db.run("DELETE FROM nodes WHERE id='a'");
    const graph=(await (await h.call('GET','/'+created.id))!.json()).graph;
    expect(graph.nodes).toHaveLength(1);expect(graph.edges).toHaveLength(0);
    h.db.run('DELETE FROM application_members WHERE user_id=1');
    expect((await h.call('GET','/'+created.id))!.status).toBe(403);
  }finally{h.db.close();}
});
