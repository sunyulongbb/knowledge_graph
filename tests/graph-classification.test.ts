import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../public/assets/scripts/graph-classification.js',import.meta.url),'utf8');
function setup() {
  const events:any[]=[],writes:any[]=[],reads:any[]=[];
  const location={search:'?db=app1',origin:'http://lan'};
  const window:any={kbViewMode:'vis',dispatchEvent:(event:any)=>events.push(event.detail),
    setEntityClass:async(...args:any[])=>writes.push(['add',...args]),clearEntityClass:async(...args:any[])=>writes.push(['remove',...args])};
  new Function('window','document','location','fetch','CustomEvent',source)(window,{getElementById:()=>null},location,(url:URL)=>new Promise(resolve=>reads.push({url,resolve})),class {detail:any;constructor(_:string,options:any){this.detail=options.detail;}});
  const resolve=(index:number,ids:string[],ok=true)=>reads[index].resolve({ok,status:ok?200:403,json:async()=>({items:ids.map(id=>({id})),error:ok?'':'拒绝访问'})});
  return {api:window.kbGraphClassification,events,writes,reads,resolve,location};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
test('classification is scoped to graph selection; supports adding and removing explicit categories',async()=>{
  const h=setup();const load=h.api.sync('Q1');
  expect(h.reads[0].url.searchParams.get('id')).toBe('entity/Q1');
  expect(h.reads[0].url.searchParams.get('db')).toBe('app1');
  h.resolve(0,['C1']);await load;expect(h.api.has('C1')).toBe(true);
  const add=h.api.toggle('C2');await tick();
  expect(h.writes).toEqual([['add','entity/Q1','C2']]);
  h.resolve(1,['C1','C2']);await add;expect(h.api.has('C2')).toBe(true);
  const remove=h.api.toggle('C2');await tick();
  expect(h.writes.at(-1)).toEqual(['remove','entity/Q1','C2']);
  h.resolve(2,['C1']);await remove;expect(h.api.has('C2')).toBe(false);
});
test('late response from the previous node cannot replace current classification',async()=>{
  const h=setup();const first=h.api.sync('Q1'),second=h.api.sync('Q2');
  h.resolve(1,['C2']);await second;h.resolve(0,['C1']);await first;
  expect(h.api.assignedIds()).toEqual(['C2']);
  expect(h.events.at(-1).entityId).toBe('Q2');
  await h.api.sync('');expect(h.api.assignedIds()).toEqual([]);
  await h.api.toggle('C3');expect(h.writes).toHaveLength(0);
});
test('classification blocks duplicates while loading and never writes using an old application scope',async()=>{
  const h=setup();const first=h.api.sync('Q1');await h.api.sync('Q1');
  await h.api.toggle('C1');expect(h.writes).toHaveLength(0);expect(h.reads).toHaveLength(1);
  h.resolve(0,[]);await first;h.location.search='?db=app2';
  await h.api.toggle('C1');expect(h.writes).toHaveLength(0);expect(h.api.assignedIds()).toEqual([]);
});
