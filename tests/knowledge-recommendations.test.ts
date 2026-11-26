import {documentKey} from '../src/server/arangodb';
import {Database} from 'bun:sqlite';
import {afterEach,expect,test} from 'bun:test';
import {createKnowledgeRecommendations,rankRecommendations} from '../src/server/knowledge-recommendations.ts';
import {canUseArangoKnowledge} from '../src/server/enterprise-knowledge.ts';
import {readFileSync} from 'node:fs';
const databases:Database[]=[];afterEach(()=>databases.splice(0).forEach(db=>db.close()));
const candidate=(id:string,tag:string)=>({id,name:id,tags:[tag],type:tag,categoryIds:[tag],videos:[]});
test('interests from positive actions rank similar unseen content above unrelated knowledge',()=>{
  const favorite=candidate('favorite','astronomy');
  const nodes=[favorite,...Array.from({length:12},(_,i)=>candidate(`science-${i}`,'astronomy')),...Array.from({length:12},(_,i)=>candidate(`art-${i}`,'painting'))];
  const ranked=rankRecommendations(nodes,[{node:favorite,weight:6,seen:true}],'seed');
  expect(ranked.slice(0,10).every(node=>node.tags[0]==='astronomy'&&node.id!=='favorite')).toBe(true);
  expect(rankRecommendations(nodes,[],'refresh-a').map(node=>node.id)).not.toEqual(rankRecommendations(nodes,[],'refresh-b').map(node=>node.id));
  expect(rankRecommendations(nodes,[],'refresh-a')).toEqual(rankRecommendations(nodes,[],'refresh-a'));
});
function setup(){
  const db=new Database(':memory:');databases.push(db);
  db.run('CREATE TABLE account_knowledge_activity(user_id INTEGER,project_id INTEGER,node_id TEXT,kind TEXT,created_at TEXT)');
  const rows=Array.from({length:40},(_,i)=>({...candidate(`n${i}`,i<20?'astronomy':'painting'),sqlite_id:`n${i}`,labels:{zh:{value:`n${i}`}},visibility:'public',owner_user_id:99,project_id:1,class_ids:[i<20?'astronomy':'painting']}));
  const calls:URL[]=[];let time=Date.now();
  const store={get:async(_db:string,id:string)=>rows.find(row=>row.id===id)||null,
    searchAccess:async(_db:string,user:any)=>rows.filter(row=>canUseArangoKnowledge(row,user)).map(row=>({id:row.id})),
    query:async(_db:string,_aql:string,vars:any)=>vars.keys ? rows.filter(row=>vars.keys.includes(documentKey(row.id)) && canUseArangoKnowledge(row,vars.uid>0?{id:vars.uid,role:vars.admin?'admin':'user'} as any:null)).map(row=>({id:row.id})) : vars.uid===1?[{id:'n0',weight:5}]:vars.uid===2?[{id:'n20',weight:5}]:[],
  };
  const rec=createKnowledgeRecommendations({db,store,now:()=>time,getProject:slug=>({id:slug==='default'?1:2,name:slug}),getUser:req=>req.headers.get('test-user')?{id:Number(req.headers.get('test-user')),role:'user'} as any:null,
    search:async(req,url)=>{calls.push(url);const user=req.headers.get('test-user')?{id:Number(req.headers.get('test-user')),role:'user'} as any:null;const nodes=rows.filter(row=>canUseArangoKnowledge(row,user));return Response.json({nodes:nodes.slice(Number(url.searchParams.get('offset')),Number(url.searchParams.get('offset'))+Number(url.searchParams.get('limit'))),total:nodes.length});},
  });
  const call=async(seed:string,offset=0,user=1,scope='default',classId='')=>{
    const url=new URL(`http://localhost/api/kb/recommendations?db=${scope}&limit=5&offset=${offset}&recommendation_seed=${seed}&hide_entity=1&defined_class_only=1`);
    if(classId)url.searchParams.set('class_id',classId);
    const response=(await rec.handle(new Request(url,{headers:user?{'test-user':String(user)}:{cookie:'kb_viewer=anonymous-visitor-id'}}),url))!;
    expect(response.status).toBe(200);return response.json();
  };
  return {db,rows,calls,call,advance:()=>{time+=1000;}};
}
test('category-scoped shorts recommendations constrain candidate searches to the selected category',async()=>{
  const h=setup();await h.call('category-feed',0,1,'default','astronomy');
  expect(h.calls.filter(url=>url.searchParams.has('order')).every(url=>url.searchParams.get('class_id')==='astronomy')).toBe(true);
});
test('per-user likes influence ranking and every refresh changes the first recommendation',async()=>{
  const h=setup();const first=await h.call('first');
  expect(first.nodes.every((node:any)=>node.tags.includes('astronomy'))).toBe(true);
  const anotherUser=await h.call('first',0,2);
  expect(anotherUser.nodes.every((node:any)=>node.tags.includes('painting'))).toBe(true);
  h.advance();const refreshed=await h.call('second');
  expect(refreshed.nodes[0].id).not.toBe(first.nodes[0].id);
  expect(h.calls.every(url=>url.searchParams.get('hide_entity')==='1'&&url.searchParams.get('defined_class_only')==='1')).toBe(true);
});
test('same-session pagination is stable, disjoint and rechecks revoked read access',async()=>{
  const h=setup();const a=await h.call('stable'),b=await h.call('stable',5);
  expect(new Set([...a.nodes,...b.nodes].map(node=>node.id)).size).toBe(10);
  expect((await h.call('stable')).nodes.map((node:any)=>node.id)).toEqual(a.nodes.map((node:any)=>node.id));
  expect(h.calls).toHaveLength(2);
  h.rows.find(row=>row.id===a.nodes[0].id)!.visibility='private';
  const after=await h.call('stable');
  expect(after.nodes.some((node:any)=>node.id===a.nodes[0].id)).toBe(false);
  expect(after.total).toBe(a.total-1);
});
test('anonymous users get varied recommendations and behavior stays within its application',async()=>{
  const h=setup();const a=await h.call('anonymous-a',0,0);h.advance();const b=await h.call('anonymous-b',0,0);
  expect(a.nodes[0].id).not.toBe(b.nodes[0].id);expect(a.personalized).toBe(false);
  h.db.run("INSERT INTO account_knowledge_activity VALUES(3,1,'n0','favorite',?)",[new Date().toISOString()]);
  const scoped=await h.call('profile',0,3);expect(scoped.nodes.every((node:any)=>node.tags.includes('astronomy'))).toBe(true);
  const other=await h.call('profile',0,3,'other');
  expect(other.nodes.map((node:any)=>node.id)).not.toEqual(scoped.nodes.map((node:any)=>node.id));
});
test('shorts refresh gets a new recommended feed instead of replaying the URL node',async()=>{
  const requests:URL[]=[],opened:string[]=[];
  const host:any={replaceChildren(){},setAttribute(){},append(){},classList:{add(){}}};
  const window:any={kbViewMode:'shorts',getCurrentDbParam:()=> 'default',history:{state:{},replaceState(){}},homeKnowledgeMediaViewer:{isPage:()=>false,open:(id:string)=>opened.push(id),updateFeed(){}}};
  const source=readFileSync('public/assets/scripts/shorts-page.js','utf8');
  new Function('window','document','location','fetch','performance',source)(window,{getElementById:()=>host,createElement:()=>host},{origin:'http://localhost',search:'?db=default',hash:'#view=shorts&node=old'},async(url:URL)=>{requests.push(url);return {ok:true,json:async()=>({nodes:[{id:'new-recommended'}]})};},{getEntriesByType:()=>[{type:'reload'}]});
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(requests[0]!.pathname).toBe('/api/kb/recommendations');expect(requests[0]!.searchParams.get('recommendation_seed')).toBeTruthy();
  expect(opened).toEqual(['new-recommended']);
});

test('Shorts menu refresh stops the old player and requests a fresh recommendation seed',async()=>{
  const requests:URL[]=[],opened:string[]=[];let playing=false,closed=0;
  const host:any={replaceChildren(){},setAttribute(){},append(){},classList:{add(){}}};
  const window:any={kbViewMode:'app_home',getCurrentDbParam:()=> 'demo',homeKnowledgeMediaViewer:{isPage:()=>playing,close:()=>{playing=false;closed++;},open:(id:string)=>{playing=true;opened.push(id);}}};
  new Function('window','document','location','fetch',readFileSync('public/assets/scripts/shorts-page.js','utf8'))(window,{getElementById:()=>host,createElement:()=>host},{origin:'http://localhost',search:'?db=demo',hash:''},async(url:URL)=>{requests.push(url);return {ok:true,json:async()=>({nodes:[{id:`pick-${requests.length}`}]})};});
  window.kbViewMode='shorts';await window.loadShortsPage();
  await window.refreshShortsPage();
  expect(requests).toHaveLength(2);expect(closed).toBe(1);expect(opened).toEqual(['pick-1','pick-2']);
  expect(requests[0]!.searchParams.get('recommendation_seed')).not.toBe(requests[1]!.searchParams.get('recommendation_seed'));
  expect(requests.every(url=>url.searchParams.get('db')==='demo')).toBe(true);
});

test('shorts rank unseen videos first and diversify adjacent categories',()=>{
  const nodes=[candidate('seen','a'),candidate('shown','a'),...Array.from({length:6},(_,i)=>({...candidate('a'+i,'a'),videos:['/a.mp4']})),...Array.from({length:6},(_,i)=>({...candidate('b'+i,'b'),video:'/b.mp4'}))];
  const result=rankRecommendations(nodes,[{node:nodes[0]!,weight:0,seen:true}],'shorts',{surface:'shorts',shown:new Set(['shown'])});
  expect(result.slice(0,6).every(node=>!['seen','shown'].includes(node.id))).toBe(true);
  expect(new Set(result.slice(0,4).map(node=>node.type)).size).toBe(2);
  expect(new Set(result.map(node=>node.id)).size).toBe(nodes.length);
  expect(result).toEqual(rankRecommendations(nodes,[{node:nodes[0]!,weight:0,seen:true}],'shorts',{surface:'shorts',shown:new Set(['shown'])}));
});

test('homepage recommendations enforce classified candidates and final results', async () => {
  const h=setup();await h.call('classified-home');
  expect(h.calls.filter(url=>url.searchParams.has('order')).every(url=>url.searchParams.get('defined_class_only')==='1')).toBe(true);
  expect(h.calls.filter(url=>url.searchParams.has('ids')).at(-1)!.searchParams.get('defined_class_only')).toBe('1');
});

test('shorts place all video knowledge before image-only items even when videos were seen', () => {
  const video = {...candidate('v','science'), videos:['/v.webm']};
  const image = {...candidate('i','art'), images:['/i.jpg']};
  const ranked=rankRecommendations([image,video],[{node:video,weight:0,seen:true},{node:image,weight:100}],'video-priority',{surface:'shorts',shown:new Set(['v'])});
  expect(ranked.map(node=>node.id)).toEqual(['v','i']);
});

test('shorts order video then image then text regardless of interest score', () => {
  const video = {...candidate('video','v'),videos:['/video.webm']};
  const image = {...candidate('image','i'),images:['/image.jpg']};
  const text = candidate('text','t');
  const ranked=rankRecommendations([text,image,video],[{node:text,weight:10000},{node:image,weight:1000},{node:video,weight:0,seen:true}],'media-order',{surface:'shorts',shown:new Set(['video'])});
  expect(ranked.map(node=>node.id)).toEqual(['video','image','text']);
});
