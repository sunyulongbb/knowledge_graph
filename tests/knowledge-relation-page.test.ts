import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
const source=readFileSync('public/assets/scripts/knowledge-relation-page.js','utf8');
const elements=new Function('window',source.slice(source.indexOf('  const clean='),source.indexOf('  const panel='))+';return relationElements;')({});
test('relation view normalizes entity ids and keeps only accessible relation endpoints',()=>{
 const graph=elements({nodes:[{id:'entity/a',name:'A'},{id:'b',name:'B'}],edges:[{source:'entity/a',target:'b',label:'knows'},{source:'a',target:'hidden'}]},'a');
 expect(graph).toHaveLength(3);
 expect(graph[0].data).toMatchObject({id:'a',center:true,label:'A'});
 expect(graph[2].data).toMatchObject({source:'a',target:'b',label:'knows'});
 expect(elements({nodes:[{id:'a'}]},'a')).toHaveLength(1);
});
function setup(){
 class Element{
  id='';textContent='';children:any[]=[];refs=new Map<string,any>();dataset:any={};onclick:any;value='';style={setProperty(){}};
  set innerHTML(_value:string){} append(item:any){this.children.push(item);} replaceChildren(){this.children=[];}
  querySelector(key:string):any{if(!this.refs.has(key))this.refs.set(key,new Element());return this.refs.get(key);}
  querySelectorAll(){return [];}setAttribute(){}
 }
 const root=new Element(),listeners:Record<string,Function>={},requests:URL[]=[],charts:any[]=[],routes:any[]=[];
 const window:any={kbViewMode:'knowledge_graph',addEventListener:(name:string,fn:Function)=>listeners[name]=fn,setViewMode:(...args:any[])=>routes.push(args),cytoscape:(options:any)=>{const collection:any={length:0,removeClass(){return this;},not(){return this;},addClass(){return this;}};const chart={elements:()=>collection,nodes:()=>({filter:()=>collection}),options,destroyed:false,handlers:{} as any,on(name:string,_selector:string,fn:Function){this.handlers[name]=fn;},destroy(){this.destroyed=true;},fit(){}};charts.push(chart);return chart;}};
 const document={createElement:()=>new Element(),getElementById:()=>root,querySelectorAll:()=>[],addEventListener(){}};
 const Observer=class{observe(){}};
 new Function('window','document','location','MutationObserver','getComputedStyle','fetch',source)(window,document,{origin:'http://localhost',search:'?db=demo',hash:'#view=knowledge_graph&node=a'},Observer,()=>({getPropertyValue:()=>''}),async(url:URL)=>{requests.push(url);return {ok:true,json:async()=>({nodes:[{id:url.searchParams.get('id'),name:'Center'}],edges:[]})};});
 return {root,window,listeners,requests,charts,routes};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
test('relation view restores node on refresh, preserves application scope and reloads after auth',async()=>{
 const h=setup();await tick();
 expect(h.requests[0]!.searchParams.get('db')).toBe('demo');
 expect(h.requests[0]!.searchParams.get('id')).toBe('a');
 expect(h.charts[0].options.elements).toHaveLength(1);
 expect(h.root.children[0].querySelector('[data-status]').textContent).toContain('1');
 await h.window.loadKnowledgeRelation('b');expect(h.charts[0].destroyed).toBe(true);
 expect(h.requests.at(-1)!.searchParams.get('id')).toBe('b');
 h.listeners['kb-auth-change']!();await tick();expect(h.requests.at(-1)!.searchParams.get('id')).toBe('b');
 h.window.closeKnowledgeRelation();expect(h.charts.at(-1).destroyed).toBe(true);
});
test('relation node selection offers the selected knowledge detail',async()=>{
 const h=setup();await tick();
 h.charts[0].handlers.tap({target:{data:()=>({id:'b',label:'Related',description:'Description'})}});
 h.root.children[0].querySelector('[data-detail]').onclick();
 expect(h.routes[0]).toEqual(['knowledge_detail',{targetNodeId:'b'}]);
});

test('actual application startup preserves graph node for deferred page scripts',()=>{
 const html=readFileSync('public/index.html','utf8');
 const start=html.indexOf('(function initView() {');
 const init=html.slice(start,html.indexOf('})();',start)+5);
 for(const queryMode of [false,true]){
   const setCalls:any[]=[],syncCalls:any[]=[];
   new Function('getRouteStateFromHash','getUrlParams','normalizeViewModeInput','setViewMode','syncHashForView','clearRouteNodeCenterLock',init)(
     ()=>queryMode?{view:'',node:''}:{view:'knowledge_graph',node:'a'},
     ()=>queryMode?{view:'knowledge_graph',node:'a'}:{},
     (value:string)=>value||'',(...args:any[])=>setCalls.push(args),(...args:any[])=>syncCalls.push(args),()=>{});
   expect(setCalls[0]).toEqual(['knowledge_graph',{skipRouteUpdate:!queryMode,replaceRoute:queryMode,targetNodeId:'a'}]);
   expect(syncCalls).toEqual([]);
 }
});

test('incremental payloads keep stable edge ids and category colors regardless of result order',()=>{
 const a={id:'a',type:'Topic'},b={id:'b',type:'Concept'},c={id:'c',type:'Topic'};
 const relation={source:'a',target:'b',type:'related',label:'Related'};
 const first=elements({nodes:[a,b],edges:[relation]},'a');
 const next=elements({nodes:[c,b,a],edges:[{source:'c',target:'a',label:'Other'},relation]},'a');
 expect(first.find((item:any)=>item.data.source)?.data.id).toBe(next.find((item:any)=>item.data.source==='a')?.data.id);
 expect(first.find((item:any)=>item.data.id==='a')?.data.color).toBe(next.find((item:any)=>item.data.id==='a')?.data.color);
 expect(first.find((item:any)=>item.data.id==='b')?.data.color).toBe(next.find((item:any)=>item.data.id==='b')?.data.color);
});

const placeExpansion=new Function(source.slice(source.indexOf('  function expansionPositions'),source.indexOf('  const panel='))+';return expansionPositions;')();
const overlaps=(a:any,b:any)=>a.x1<b.x2&&a.x2>b.x1&&a.y1<b.y2&&a.y2>b.y1;
test('incremental placement avoids existing nodes, long labels and reserved animation destinations',()=>{
 const occupied=[{x1:-100,x2:100,y1:-100,y2:130},{x1:120,x2:340,y1:-100,y2:160},{x1:-340,x2:-120,y1:-150,y2:180}];
 const snapshot=JSON.stringify(occupied);
 const first=placeExpansion({x:0,y:0},Array.from({length:25},()=>({width:220,height:180})),occupied);
 const second=placeExpansion({x:190,y:0},Array.from({length:12},()=>({width:260,height:240})),[...occupied,...first.map((item:any)=>item.box)]);
 const boxes=[...occupied,...first.map((item:any)=>item.box),...second.map((item:any)=>item.box)];
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)expect(overlaps(boxes[i],boxes[j])).toBe(false);
 expect(JSON.stringify(occupied)).toBe(snapshot);
 expect(placeExpansion({x:0,y:0},[],occupied)).toEqual([]);
});
