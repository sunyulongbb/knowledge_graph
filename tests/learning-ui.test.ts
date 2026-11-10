import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createLearningHandler } from '../src/server/learning.ts';
import { documentKey } from '../src/server/arangodb.ts';
import { correctLearningOption } from './helpers/learning-quiz.ts';

const source=readFileSync('public/assets/scripts/knowledge-learning.js','utf8');
const pathLayout=new Function(source.slice(source.indexOf('  function learningPathLayout('),source.indexOf('  const panel ='))+';return learningPathLayout;')();
test('learning path is ordered, connected and differentiates completed/current/pending levels',()=>{
  const map=pathLayout(['a','b','c'],['a'],'b');
  expect(map.points.map((p:any)=>p.state)).toEqual(['completed','current','pending']);
  expect(map.points.map((p:any)=>p.y)).toEqual([76,224,372]);
  expect(map.path).toContain('M 92 76');expect(map.path).toContain('Q');
});

function setup() {
  const db=new Database(':memory:');
  let user:any={id:1,username:'learner'};
  const nodes=['a','b','c'].map(id=>({id,sqlite_id:id,_id:`entity/${documentKey(id)}`,name:`知识${id}`,description:`描述${id}`,visibility:'public'}));
  const store:any={
    require:async(_:string,id:string)=>nodes.find(node=>node.id===id),
    query:async(_:string,_query:string,params:any)=>params.keys?nodes.filter(node=>params.keys.includes(documentKey(node.id))):[
      {node:nodes[1],depth:1,relation:'关联'},{node:nodes[2],depth:2,relation:'扩展'}],
    attributes:async()=>[{id:'attr',key:'P1',datatype:'string',value:'"属性内容"'}],
    relations:async()=>[{source:nodes[0],target:nodes[2],edge:{property_name:'关联关系'}}],
  };
  const handler=createLearningHandler({db,store,getUser:()=>user,getKnowledgeUser:()=>user,getProject:()=>({id:7,name:'demo'})});
  const listeners:Record<string,Function>={},elements=new Map<string,any>();
  const attributes=new Map<string,string>();
  const panel:any={innerHTML:'',setAttribute(key:string,value:string){attributes.set(key,value);},addEventListener:(name:string,fn:Function)=>{listeners[name]=fn;},querySelector:(selector:string)=>{
    if(!elements.has(selector))elements.set(selector,{innerHTML:'',inert:false});return elements.get(selector);
  }};
  const dialog:any={innerHTML:'',open:false,setAttribute(){},showModal(){this.open=true;},close(){this.open=false;},addEventListener(){}};
  const location:any={origin:'http://localhost',href:'http://localhost/kb?db=demo#learning',search:'?db=demo'};
  const window:any={kbViewMode:'app_home',authUser:user,addEventListener:(name:string,fn:Function)=>{listeners[name]=fn;},history:{state:{},replaceState:(_:any,_b:any,url:URL)=>{location.href=url.href;location.search=url.search;}},confirm:()=>true};
  let timer:Function|undefined;
  const document={body:{append(){}},createElement:(tag:string)=>tag==='dialog'?dialog:panel,getElementById:()=>({append(){},click(){}})};
  let lastQuiz:any;
  const fetcher=async(url:URL,options:any)=>{
    if(url.pathname.startsWith('/api/kb/learning')){const response=(await handler(new Request(url,options),url))!;if(url.pathname.endsWith('/quiz'))lastQuiz=await response.clone().json();return response;}
    if(url.pathname==='/api/kb/entity_search')return Response.json({nodes});
    if(url.pathname==='/api/kb/node')return Response.json({node:nodes.find(node=>node.id===url.searchParams.get('id'))});
    if(url.pathname==='/api/kb/node/attributes')return Response.json([{property:'P1',value:'关联属性'}]);
    if(url.pathname==='/api/kb/node/graph')return Response.json({nodes,edges:[]});
    return Response.json({error:'unknown'}, {status:404});
  };
  new Function('window','document','location','fetch','setTimeout','clearTimeout',source)(window,document,location,fetcher,(fn:Function)=>{timer=fn;return 1;},()=>{timer=undefined;});
  window.kbViewMode='learning';
  return {db,window,panel,dialog,elements,listeners,location,attributes,quiz:()=>lastQuiz,
    detail:async(nodeId:string)=>{const row=db.query('SELECT id FROM learning_routes').get() as any;const url=new URL(`http://localhost/api/kb/learning/routes/${row.id}/level?db=demo&nodeId=${nodeId}`);return (await handler(new Request(url),url))!.json();},
    click:async(data:any)=>{await listeners.click!({target:{closest:()=>({dataset:data,disabled:false})}});await tick();},
    input:(selector:string,value:string)=>listeners.input!({target:{matches:(query:string)=>query===selector,value}}),
    search:async()=>{await timer?.();await tick();},setUser:(next:any)=>{user=next;window.authUser=next;},
  };
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function solveQuiz(h:ReturnType<typeof setup>,nodeId:string) {
  await h.click({learningStart:''});await tick();
  const quiz=h.quiz(),detail=await h.detail(nodeId);
  for(let index=0;index<quiz.questions.length;index++){
    await h.click({learningAnswer:correctLearningOption(quiz.questions[index],detail)});await tick();
    if(index<quiz.questions.length-1)await h.click({learningNextQuestion:''});
  }
}

test('manual learning UI adds/reorders/removes knowledge, saves, learns, browses related and resumes',async()=>{
  const h=setup();try{
    await h.window.loadKnowledgeLearning();expect(h.panel.innerHTML).toContain('创建第一条学习路线');
    await h.click({learningCreate:''});await h.click({learningMode:'manual'});
    h.input('[data-learning-search]','知识');await h.search();
    expect(h.elements.get('[data-learning-results]').innerHTML).toContain('知识a');
    await h.click({learningAdd:'a'});await h.click({learningAdd:'b'});
    h.input('[data-learning-name]','我的学习路线');
    await h.click({learningMove:'1',direction:'-1'});
    await h.click({learningRemove:'1'});await h.click({learningAdd:'a'});
    await h.click({learningSave:''});await tick();
    let row=h.db.query('SELECT * FROM learning_routes').get() as any;
    expect(JSON.parse(row.node_ids_json)).toEqual(['b','a']);
    expect(row.name).toBe('我的学习路线');
    expect(h.panel.innerHTML).toContain('学习地图');
    expect(h.panel.innerHTML).not.toContain('属性内容');expect(h.dialog.open).toBe(false);
    await h.click({learningLevel:'b'});await tick();
    expect(h.dialog.open).toBe(true);expect(h.dialog.innerHTML).toContain('属性内容');
    await solveQuiz(h,'b');
    row=h.db.query('SELECT * FROM learning_routes').get() as any;
    expect(JSON.parse(row.completed_ids_json)).toEqual(['b']);expect(row.current_node_id).toBe('a');
    await h.click({learningNextLevel:''});await tick();
    await h.click({learningRelated:'c'});await tick();
    expect(h.dialog.innerHTML).toContain('返回当前学习关卡');expect(h.dialog.innerHTML).toContain('描述c');
    expect((h.db.query('SELECT current_node_id FROM learning_routes').get() as any).current_node_id).toBe('a');
    await h.click({learningReturnLevel:''});await tick();
    expect(h.dialog.innerHTML).toContain('描述a');
    h.window.stopKnowledgeLearning();await h.window.loadKnowledgeLearning();
    expect(h.panel.innerHTML).not.toContain('描述a');expect(h.dialog.open).toBe(false);
    await h.click({learningLevel:'a'});await tick();await solveQuiz(h,'a');
    expect(h.panel.innerHTML).toContain('整条路线已完成');
    row=h.db.query('SELECT * FROM learning_routes').get() as any;
    expect(JSON.parse(row.completed_ids_json)).toEqual(['b','a']);
  }finally{h.db.close();}
});

test('automatic route UI generates editable candidates and persists only IDs',async()=>{
  const h=setup();try{
    await h.window.loadKnowledgeLearning();await h.click({learningCreate:''});
    h.input('[data-learning-search]','主题');await h.search();await h.click({learningAdd:'a'});
    expect(h.panel.innerHTML).toContain('关联距离不代表知识难度');
    await h.click({learningMove:'2',direction:'-1'});
    await h.click({learningSave:''});await tick();
    const row=h.db.query('SELECT * FROM learning_routes').get() as any;
    expect(JSON.parse(row.node_ids_json)).toEqual(['a','c','b']);
    expect(Object.keys(row)).not.toContain('description');
  }finally{h.db.close();}
});

test('switching accounts clears previously rendered personal learning routes',async()=>{
  const h=setup();try{
    await h.window.loadKnowledgeLearning();await h.click({learningCreate:''});await h.click({learningMode:'manual'});
    h.input('[data-learning-search]','知识');await h.search();await h.click({learningAdd:'a'});h.input('[data-learning-name]','私有路线标题');await h.click({learningSave:''});await tick();
    await h.click({learningHome:''});expect(h.panel.innerHTML).toContain('私有路线标题');
    h.setUser(null);h.listeners['kb-auth-change']!();await tick();
    expect(h.panel.innerHTML).not.toContain('私有路线标题');expect(h.panel.innerHTML).toContain('请先登录');
  }finally{h.db.close();}
});

test('map opens alone; node dialog starts exercises; wrong answers never complete the level',async()=>{
  const h=setup();try{
    await h.window.loadKnowledgeLearning();await h.click({learningCreate:''});await h.click({learningMode:'manual'});
    h.input('[data-learning-search]','知识');await h.search();await h.click({learningAdd:'a'});await h.click({learningAdd:'b'});
    await h.click({learningSave:''});await tick();
    expect(h.attributes.get('data-learning-screen')).toBe('learn');expect(h.dialog.open).toBe(false);
    expect(h.panel.innerHTML).not.toContain('主要属性');
    await h.click({learningLevel:'a'});await tick();expect(h.dialog.open).toBe(true);
    await h.click({learningStart:''});await tick();expect(h.dialog.open).toBe(false);
    expect(h.attributes.get('data-learning-screen')).toBe('quiz');
    const quiz=h.quiz(),question=quiz.questions[0],detail=await h.detail('a');
    const correct=correctLearningOption(question,detail),wrong=question.options.find((item:any)=>item.id!==correct).id;
    await h.click({learningAnswer:wrong});await tick();
    expect(h.panel.innerHTML).toContain('再试一次');
    expect((h.db.query('SELECT completed_ids_json FROM learning_routes').get() as any).completed_ids_json).toBe('[]');
    await h.click({learningQuizReference:''});await tick();expect(h.dialog.open).toBe(true);
    expect(h.dialog.innerHTML).toContain('描述a');expect(h.dialog.innerHTML).not.toContain('data-learning-start');
    await h.click({learningCloseNode:''});await h.click({learningAnswer:correct});await tick();
    expect(h.panel.innerHTML).toContain('答对了');
    await h.click({learningExitQuiz:''});expect(h.attributes.get('data-learning-screen')).toBe('learn');
    expect(h.dialog.open).toBe(false);
  }finally{h.db.close();}
});
