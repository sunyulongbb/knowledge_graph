import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
const source=readFileSync('public/assets/scripts/knowledge-big-bang.js','utf8');
const points=new Function(source.slice(source.indexOf('  function bigBangPoints'),source.indexOf('  let active='))+';return bigBangPoints;')();
test('big bang distributes knowledge across a finite, repeatable three dimensional volume',()=>{
  expect(points(0)).toEqual([]);
  for(const count of [1,12,120]){
    const cloud=points(count);
    expect(cloud).toHaveLength(count);
    expect(cloud).toEqual(points(count));
    expect(new Set(cloud.map((p:any)=>JSON.stringify(p))).size).toBe(count);
    for(const p of cloud){
      expect([p.x,p.y,p.z].every(Number.isFinite)).toBe(true);
      expect(p.z).toBeGreaterThanOrEqual(-850);
      expect(p.z).toBeLessThan(3000);
    }
  }
});

test('embedded universe mounts, loads scoped knowledge and can reopen after leaving',async()=>{
  class Element {
    id='';textContent='';width=0;height=0;children:any[]=[];refs=new Map<string,Element>();
    append(child:any){this.children.push(child);child.parent=this;}
    parent:any;
    remove(){this.parent.children=this.parent.children.filter((child:any)=>child!==this);}
    setAttribute(){} addEventListener(){} set innerHTML(_value:string){}
    querySelector(selector:string):any{if(!this.refs.has(selector))this.refs.set(selector,new Element());return this.refs.get(selector);}
    querySelectorAll(){return [];}
    getContext(){return {};}
    getBoundingClientRect(){return {width:800,height:600};}
  }
  const root=new Element(),requests:URL[]=[];
  const listeners:Record<string,Function>={};
  const window:any={kbViewMode:'big_bang',matchMedia:()=>({matches:true}),addEventListener(name:string,fn:Function){listeners[name]=fn;},removeEventListener(){}};
  const document={createElement:()=>new Element(),getElementById:()=>root};
  const Observer=class {observe(){} disconnect(){}};
  new Function('window','document','location','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','fetch',source)(window,document,{origin:'http://localhost',search:'?db=demo&explore_category=science'},Observer,()=>1,()=>{},async(url:URL)=>{requests.push(url);return {ok:true,json:async()=>({nodes:[]})};});
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(root.children[0].children).toHaveLength(1);
  const beforeAuth=root.children[0].children[0];
  listeners['kb-auth-change']!();await new Promise(resolve=>setTimeout(resolve,0));
  expect(root.children[0].children).toHaveLength(1);
  expect(root.children[0].children[0]).not.toBe(beforeAuth);
  expect(root.children[0].id).toBe('knowledgeBigBangPage');
  expect(typeof window.loadKnowledgeBigBang).toBe('function');
  await window.loadKnowledgeBigBang();
  expect(root.children[0].children).toHaveLength(1);
  expect(requests[0]!.searchParams.get('class_id')).toBe('science');
  expect(requests[0]!.searchParams.get('db')).toBe('demo');
  window.closeKnowledgeBigBang();expect(root.children[0].children).toHaveLength(0);
  await window.loadKnowledgeBigBang();expect(root.children[0].children).toHaveLength(1);
  window.kbViewMode='app_explore';listeners['kb-auth-change']!();
  expect(root.children[0].children).toHaveLength(0);
});

const focus=new Function(source.slice(source.indexOf('  function bigBangFocusTarget'),source.indexOf('  let active='))+';return bigBangFocusTarget;')();
test('focus camera centers the selected knowledge at any rotation and gives it a readable size',()=>{
  for(const p of points(12))for(const yaw of [0,1,3])for(const pitch of [-1,0,1]){
    const scale=.6,target=focus(p,yaw,pitch,scale);
    const x=p.x*Math.cos(yaw)+p.z*Math.sin(yaw),z=p.z*Math.cos(yaw)-p.x*Math.sin(yaw);
    const y=p.y*Math.cos(pitch)-z*Math.sin(pitch),depth=p.y*Math.sin(pitch)+z*Math.cos(pitch);
    expect(Math.abs(x-target.x)).toBeLessThan(.001);
    expect(Math.abs(y-target.y)).toBeLessThan(.001);
    const size=150*scale*1100/(1500+depth-target.z);
    expect(Math.abs(size-300)).toBeLessThan(.001);
  }
});

test('overview fills wide and portrait viewports instead of a central sphere',()=>{
  for(const [width,height] of [[1600,800],[800,800],[400,800]]){
    const cloud=points(120,width,height),scale=Math.min(width,height)/1100;
    const projected=cloud.map((p:any)=>({x:width/2+p.x*scale*1100/(1500+p.z),y:height/2+p.y*scale*1100/(1500+p.z)}));
    const xs=projected.map((p:any)=>p.x),ys=projected.map((p:any)=>p.y);
    expect(Math.max(...xs)-Math.min(...xs)).toBeGreaterThan(width*.65);
    expect(Math.max(...ys)-Math.min(...ys)).toBeGreaterThan(height*.6);
    expect(projected.every((p:any)=>p.x>0&&p.x<width&&p.y>0&&p.y<height)).toBe(true);
    for(const horizontal of [false,true])for(const vertical of [false,true]){
      expect(projected.some((p:any)=>(p.x>width/2)===horizontal&&(p.y>height/2)===vertical)).toBe(true);
    }
  }
});

test('knowledge has broad depth variation without aligned rows or columns',()=>{
  const cloud=points(120),scale=800/1100;
  const xs=cloud.map((p:any)=>Math.round(p.x*scale*1100/(1500+p.z)));
  const ys=cloud.map((p:any)=>Math.round(p.y*scale*1100/(1500+p.z)));
  expect(new Set(xs).size).toBeGreaterThan(100);
  expect(new Set(ys).size).toBeGreaterThan(100);
  const distances=cloud.map((p:any)=>1500+p.z);
  expect(Math.max(...distances)/Math.min(...distances)).toBeGreaterThan(5);
});
