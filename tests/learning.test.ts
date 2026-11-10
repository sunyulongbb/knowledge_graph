import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { createLearningHandler, discoverLearningRoute } from '../src/server/learning.ts';
import { documentKey } from '../src/server/arangodb.ts';
import { correctLearningOption } from './helpers/learning-quiz.ts';

function setup() {
  const db = new Database(':memory:');
  let user: any = { id: 1, username: 'one' };
  const nodes = new Map(['a','b','c'].map(id => [id, { id, sqlite_id:id, _id:`entity/${documentKey(id)}`,name:`知识${id}`,description:`描述${id}`,visibility:'public' }]));
  const queries: any[] = [];
  const store: any = {
    require: async (_database:string,id:string) => { if(!nodes.has(id)) {const {KnowledgeStoreError}=await import('../src/server/enterprise-knowledge.ts');throw new KnowledgeStoreError('不存在',404);} return nodes.get(id); },
    query: async (_database:string,query:string,params:any) => { queries.push({query,params}); return params.keys ? [...nodes.values()].filter(node=>params.keys.includes(documentKey(node.id))) : [{node:nodes.get('b'),depth:1,relation:'关联'},{node:nodes.get('c'),depth:2,relation:'扩展'},{node:nodes.get('b'),depth:2}]; },
    attributes: async ()=>[{id:'p',node_id:'a',key:'P1',datatype:'string',value:'"属性值"'}],
    relations: async ()=>[{source:nodes.get('a'),target:nodes.get('b'),edge:{property_name:'相关'}}],
  };
  const handler = createLearningHandler({ db,store,getUser:()=>user,getKnowledgeUser:()=>user,getProject:slug=>({id:slug==='other'?8:7,name:slug}) });
  async function request(path='',method='GET',body?:any,project='app') {
    const url=new URL(`http://localhost/api/kb/learning${path}`);url.searchParams.set('db',project);
    const response=await handler(new Request(url,{method,...(body!==undefined?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})}),url);
    return {status:response!.status,data:await response!.json()};
  }
  async function complete(id:string,nodeId:string) {
    const quiz=await request(`/routes/${id}/quiz`,'POST',{nodeId});
    const detail=await request(`/routes/${id}/level?nodeId=${nodeId}`);
    let answer:any;
    for(const question of quiz.data.questions)answer=await request(`/routes/${id}/answer`,'POST',{attemptId:quiz.data.attemptId,questionId:question.id,optionId:correctLearningOption(question,detail.data)});
    return answer;
  }
  return {db,store,nodes,queries,request,complete,setUser:(next:any)=>{user=next;}};
}
test('learning complete flow: discover, create, learn, resume, reorder and delete',async()=>{
  const h=setup();
  try {
    const generated=await h.request('/discover','POST',{nodeId:'a'});
    expect(generated.status).toBe(200);
    expect(generated.data.candidates.map((item:any)=>item.node.id)).toEqual(['a','b','c']);
    expect(h.queries[0].query).toContain("GRAPH 'graph'");
    expect(h.queries[0].query).toContain('PRUNE blocked');
    const created=await h.request('/routes','POST',{name:'主题学习',nodeIds:['a','b','c']});
    expect(created.status).toBe(201);const id=created.data.route.id;
    const level=await h.request(`/routes/${id}/unknown`);
    expect(level.status).toBe(404);
    const detail=await h.request(`/routes/${id}/level`);
    expect(detail.data.node.name).toBe('知识a');
    expect(detail.data.attributes[0].value).toBe('属性值');
    expect(detail.data.related[0].node.id).toBe('b');
    await h.complete(id,'a');
    const resumed=await h.request(`/routes/${id}`);
    expect(resumed.data.route).toMatchObject({completedIds:['a'],currentNodeId:'b',completedCount:1});
    const edited=await h.request(`/routes/${id}`,'PUT',{name:'调整后',nodeIds:['b','a'],revision:resumed.data.route.revision});
    expect(edited.data.route.completedIds).toEqual(['a']);
    await h.complete(id,'b');
    expect((await h.request('/routes')).data.routes[0].progress).toBe(100);
    expect((await h.request(`/routes/${id}`,'DELETE')).status).toBe(200);
    expect((await h.request('/routes')).data.routes).toHaveLength(0);
    expect(h.db.query('SELECT count(*) AS count FROM learning_routes').get()).toEqual({count:0});
  } finally { h.db.close(); }
});
test('learning routes are isolated by actual user and application; anonymous access is rejected',async()=>{
  const h=setup();try{
    const id=(await h.request('/routes','POST',{name:'私有路线',nodeIds:['a']})).data.route.id;
    h.setUser({id:2,username:'two'});
    expect((await h.request('/routes')).data.routes).toEqual([]);
    expect((await h.request(`/routes/${id}`)).status).toBe(404);
    expect((await h.request(`/routes/${id}`,'DELETE')).status).toBe(404);
    h.setUser({id:1,username:'one'});
    expect((await h.request(`/routes/${id}`,'GET',undefined,'other')).status).toBe(404);
    h.setUser(null);expect((await h.request('/routes')).status).toBe(401);
  }finally{h.db.close();}
});
test('invalid routes, inaccessible knowledge and stale revisions do not overwrite progress',async()=>{
  const h=setup();try{
    expect((await h.request('/routes','POST',{name:'重复',nodeIds:['a','a']})).status).toBe(400);
    expect((await h.request('/routes','POST',{name:'不存在',nodeIds:['missing']})).status).toBe(400);
    const route=(await h.request('/routes','POST',{name:'正常',nodeIds:['a','b']})).data.route;
    expect((await h.request(`/routes/${route.id}/progress`,'POST',{nodeId:'c',complete:true})).status).toBe(400);
    expect((await h.request(`/routes/${route.id}/level?nodeId=c`)).status).toBe(400);
    await h.complete(route.id,'a');
    expect((await h.request(`/routes/${route.id}`,'PUT',{name:'旧副本',nodeIds:['a','b'],revision:route.revision})).status).toBe(409);
    await h.complete(route.id,'a');
    expect((await h.request(`/routes/${route.id}`)).data.route.completedIds).toEqual(['a']);
    h.nodes.delete('b');
    expect((await h.request(`/routes/${route.id}`)).data.nodes[1].unavailable).toBe(true);
    expect((await h.request(`/routes/${route.id}/progress`,'POST',{nodeId:'b'})).status).toBe(404);
  }finally{h.db.close();}
});
test('automatic discovery excludes private, unnamed and duplicate candidates',async()=>{
  const seed={id:'seed',name:'主题',visibility:'public'};
  const store:any={require:async()=>seed,query:async()=>[
    {node:{id:'private',name:'私有',visibility:'private',owner_user_id:2},depth:1},
    {node:{id:'empty',name:'',visibility:'public'},depth:1},
    {node:{id:'ok',name:'有效',visibility:'public'},depth:2},
    {node:{id:'ok',name:'有效',visibility:'public'},depth:2},
  ]};
  expect((await discoverLearningRoute(store,'app','seed',{id:1,username:'one'})).candidates.map(item=>item.node.id)).toEqual(['seed','ok']);
});

test('concurrent progress updates merge completed IDs instead of overwriting one another',async()=>{
  const h=setup();try{
    const route=(await h.request('/routes','POST',{name:'并行学习',nodeIds:['a','b','c']})).data.route;
    await Promise.all(['a','b'].map(nodeId=>h.complete(route.id,nodeId)));
    const updated=(await h.request(`/routes/${route.id}`)).data.route;
    expect(updated.completedIds.sort()).toEqual(['a','b']);expect(updated.currentNodeId).toBe('c');
  }finally{h.db.close();}
});

test('automatic discovery keeps the theme first and caps related knowledge at twenty',async()=>{
  const store:any={require:async()=>({id:'seed',name:'主题',visibility:'public'}),query:async()=>Array.from({length:40},(_,index)=>({node:{id:String(index),name:'关联知识',visibility:'public'},depth:index<10?1:2}))};
  const discovered=await discoverLearningRoute(store,'app','seed',{id:1,username:'one'});
  expect(discovered.candidates).toHaveLength(21);expect(discovered.candidates[0]?.node.id).toBe('seed');
  expect(discovered.candidates.slice(1,11).every(item=>item.depth===1)).toBe(true);
});

test('quiz answers are checked server-side; wrong and partial answers cannot finish a level',async()=>{
  const h=setup();try{
    const route=(await h.request('/routes','POST',{name:'做题路线',nodeIds:['a','b','c']})).data.route;
    expect((await h.request(`/routes/${route.id}/progress`,'POST',{nodeId:'a',complete:true})).status).toBe(400);
    const quiz=(await h.request(`/routes/${route.id}/quiz`,'POST',{nodeId:'a'})).data;
    expect(quiz.questions.length).toBeGreaterThan(1);
    expect(JSON.stringify(quiz)).not.toContain('correctOptionId');
    expect(JSON.stringify(quiz)).not.toContain('explanation');
    const detail=(await h.request(`/routes/${route.id}/level?nodeId=a`)).data;
    const question=quiz.questions[0],correct=correctLearningOption(question,detail);
    const wrong=question.options.find((option:any)=>option.id!==correct).id;
    const failed=await h.request(`/routes/${route.id}/answer`,'POST',{attemptId:quiz.attemptId,questionId:question.id,optionId:wrong});
    expect(failed.data.correct).toBe(false);expect(failed.data.finished).toBe(false);expect(failed.data.route.completedCount).toBe(0);
    const partial=await h.request(`/routes/${route.id}/answer`,'POST',{attemptId:quiz.attemptId,questionId:question.id,optionId:correct});
    expect(partial.data.correct).toBe(true);expect(partial.data.route.completedCount).toBe(0);
    for(const next of quiz.questions.slice(1))await h.request(`/routes/${route.id}/answer`,'POST',{attemptId:quiz.attemptId,questionId:next.id,optionId:correctLearningOption(next,detail)});
    expect((await h.request(`/routes/${route.id}`)).data.route.completedIds).toEqual(['a']);
  }finally{h.db.close();}
});

test('quiz attempt is bound to the user/route and expires without changing progress',async()=>{
  const h=setup(),now=Date.now;try{
    const first=(await h.request('/routes','POST',{name:'一',nodeIds:['a']})).data.route;
    const quiz=(await h.request(`/routes/${first.id}/quiz`,'POST',{nodeId:'a'})).data;
    const answer={attemptId:quiz.attemptId,questionId:quiz.questions[0].id,optionId:quiz.questions[0].options[0].id};
    h.setUser({id:2,username:'two'});
    const second=(await h.request('/routes','POST',{name:'二',nodeIds:['a']})).data.route;
    expect((await h.request(`/routes/${second.id}/answer`,'POST',answer)).status).toBe(404);
    h.setUser({id:1,username:'one'});
    Date.now=()=>now()+31*60_000;
    expect((await h.request(`/routes/${first.id}/answer`,'POST',answer)).status).toBe(410);
    expect((await h.request(`/routes/${first.id}`)).data.route.completedCount).toBe(0);
  }finally{Date.now=now;h.db.close();}
});
