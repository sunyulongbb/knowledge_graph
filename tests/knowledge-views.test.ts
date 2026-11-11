import {Database} from 'bun:sqlite';
import {afterEach,expect,test} from 'bun:test';
import {createKnowledgeViews} from '../src/server/knowledge-views.ts';
import {readFileSync} from 'node:fs';
const databases:Database[]=[];afterEach(()=>{databases.splice(0).forEach(db=>db.close());});
function setup() {
  const db=new Database(':memory:');databases.push(db);let now=1000;
  const api=createKnowledgeViews({db,now:()=>now,
    getUser:req=>req.headers.get('test-user')?{id:Number(req.headers.get('test-user')),role:'user'} as any:null,
    getProject:slug=>['default','other'].includes(slug)?{id:slug==='default'?1:2,name:slug}:null,
    store:{get:async(database,id)=>id==='missing'?null:{id,project_id:database==='default'?1:2,visibility:id==='private'?'private':'public',owner_user_id:2}},
  });
  const call=async(id='a',options:{method?:string;db?:string;user?:number;cookie?:string;action?:string}={})=>{
    const url=new URL(`http://localhost/api/knowledge/${encodeURIComponent(id)}/${options.action||'view'}?db=${options.db||'default'}`);
    const response=await api.handle(new Request(url,{method:options.method||'POST',headers:{...(options.user?{'test-user':String(options.user)}:{}),...(options.cookie?{cookie:options.cookie}:{})}}),url);
    return response!;
  };
  return {db,api,call,setTime:(value:number)=>{now=value;}};
}
test('counts real reads once per visitor in thirty seconds and keeps applications separate',async()=>{
  const h=setup();
  expect(await (await h.call('a',{user:1})).json()).toEqual({viewCount:1,counted:true});
  expect(await (await h.call('entity/a',{user:1})).json()).toEqual({viewCount:1,counted:false});
  expect((await (await h.call('a',{user:2})).json()).viewCount).toBe(2);
  expect((await (await h.call('a',{user:1,db:'other'})).json()).viewCount).toBe(1);
  h.setTime(31001);expect((await (await h.call('a',{user:1})).json()).viewCount).toBe(3);
  const read=await h.call('a',{user:1,method:'GET',action:'views'});
  expect(await read.json()).toEqual({viewCount:3});expect(read.headers.get('Cache-Control')).toContain('no-store');
});
test('anonymous reads get an anonymous cookie and duplicate concurrent reads do not inflate counts',async()=>{
  const h=setup(),first=await h.call();
  const cookie=first.headers.get('set-cookie')!.split(';')[0]!;
  expect(cookie).toStartWith('kb_viewer=');
  const results=await Promise.all(Array.from({length:10},()=>h.call('a',{cookie}).then(response=>response.json())));
  expect(results.every(row=>row.viewCount===1&&!row.counted)).toBe(true);
});
test('unreadable or missing records do not expose or increment counts',async()=>{
  const h=setup();
  expect((await h.call('private')).status).toBe(404);
  expect((await h.call('private',{user:1})).status).toBe(404);
  expect((await h.call('missing',{user:2})).status).toBe(404);
  expect((await h.call('a',{db:'absent'})).status).toBe(404);
  expect((await h.call('a',{method:'GET'})).status).toBe(405);
  expect((h.db.query('SELECT COUNT(*) AS count FROM knowledge_view_counts').get() as any).count).toBe(0);
  expect((await h.call('private',{user:2})).status).toBe(200);
});
test('list and detail responses include durable scoped counts without counting list impressions',async()=>{
  const h=setup();await h.call('a',{user:1});
  const list=await h.api.decorate(Response.json({nodes:[{id:'a'},{id:'never-opened'}],total:2}),new URL('http://localhost/api/kb/discover/search?db=default'));
  expect((await list.json()).nodes.map((node:any)=>node.viewCount)).toEqual([1,0]);
  const detail=await h.api.decorate(Response.json({node:{_id:'entity/a'}}),new URL('http://localhost/api/kb/node?db=other'));
  expect((await detail.json()).node.viewCount).toBe(0);
});
test('Lite uses the node project and read permissions before counting',async()=>{
  const db=new Database(':memory:');databases.push(db);
  db.run('CREATE TABLE nodes(id TEXT PRIMARY KEY,project_id INTEGER,visibility TEXT,owner_user_id INTEGER)');
  db.run('CREATE TABLE knowledge_maintainers(node_id TEXT,user_id INTEGER)');
  db.run("INSERT INTO nodes VALUES('a',1,'public',2),('private',1,'private',2)");
  const api=createKnowledgeViews({db,store:null,getUser:()=>null,getProject:slug=>({id:slug==='default'?1:2,name:slug})});
  for(const [id,scope,status] of [['a','default',200],['a','other',404],['private','default',404]] as const){
    const url=new URL(`http://localhost/api/knowledge/${id}/view?db=${scope}`);
    expect((await api.handle(new Request(url,{method:'POST'}),url))!.status).toBe(status);
  }
});
test('client view tracking updates matching counters and suppresses duplicate renders',async()=>{
  const elements=[{dataset:{knowledgeViews:'a',db:'default'},textContent:''},{dataset:{knowledgeViews:'a',db:'other'},textContent:''}];
  const window:any={dispatchEvent(){}};let requests=0;
  new Function('window','document','location','fetch',readFileSync('public/assets/scripts/knowledge-views.js','utf8'))(
    window,{querySelectorAll:()=>elements},{origin:'http://localhost',search:''},async()=>{requests++;return{ok:true,json:async()=>({viewCount:12})};},
  );
  window.recordKnowledgeViewCount('entity/a');window.recordKnowledgeViewCount('a');
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(requests).toBe(1);expect(elements[0]!.textContent).toBe('12');expect(elements[1]!.textContent).toBe('');
});
