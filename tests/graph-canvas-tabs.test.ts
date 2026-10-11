import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

function setup(user: any = {id:1}) {
  class Element {
    textContent='';disabled=false;hidden=false;tabIndex=0;dataset:any={};style:any={display:'none'};children:any[]=[];listeners=new Map();
    classList={add(){},remove(){}};
    setAttribute(){} replaceChildren(){this.children=[];}append(item:any){this.children.push(item);}focus(){}querySelectorAll(){return this.children;}
    addEventListener(name:string,fn:any){this.listeners.set(name,fn);}click(){return this.listeners.get('click')?.({});}
  }
  const elements=new Map<string,Element>();const get=(id:string)=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)!;};
  const events = new Map<string,any>();
  const requests:any[]=[];const storage=new Map<string,string>();let next=0;
  const saved=new Map<string,any>();
  const context=createContext({module:{exports:{}},exports:{},console,performance,setTimeout:()=>1,clearTimeout(){},
    location:{search:'?db=mine',origin:'http://lan'},URL,URLSearchParams,
    document:{getElementById:get,createElement:()=>new Element(),activeElement:null},MutationObserver:class{observe(){}},
    localStorage:{getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)},
    confirm:()=>true,prompt:()=> '改名',fetch:async(url:any,init:any)=>{
      const path=new URL(url).pathname.split('/')[3];const body=init.body?JSON.parse(init.body):null;requests.push({path,method:init.method,body});
      if(init.method==='POST'){const item={id:'c'+(++next),name:body.name,revision:1,graph:{nodes:[],edges:[],zoom:1,pan:{x:0,y:0}}};saved.set(item.id,item);return Response.json(item);}
      if(init.method==='PUT'){const item={...body,id:path,revision:body.revision+1};saved.set(path,item);return Response.json(item);}
      if(init.method==='DELETE'){saved.delete(path);return Response.json({ok:true});}
      return Response.json(path?saved.get(path):{items:[...saved.values()]});
    },window:{authUser:user,addEventListener:(name:string,fn:any)=>events.set(name,fn)} });
  runInContext(readFileSync('public/js/cytoscape.min.js','utf8'),context);
  runInContext(`window.kbCy=module.exports({headless:true,elements:[{data:{id:'entity/a',label:'A'},position:{x:30,y:40}}],layout:{name:'preset'}});const nativeAdd=window.kbCy.add.bind(window.kbCy);window.kbCy.add=(elements)=>nativeAdd(JSON.parse(JSON.stringify(elements)));window.kbGraphConnect={cancel(){}};`,context);
  runInContext(readFileSync('public/assets/scripts/graph-canvases.js','utf8'),context);
  return {get,requests,saved,storage,events,window:runInContext('window',context)};
}
test('canvas tabs create an empty workspace, autosave layout, restore it, and delete only the canvas',async()=>{
  const h=setup();await new Promise(resolve=>setTimeout(resolve,0));
  const cy=h.window.kbCy;
  await h.get('graphCanvasNew').click();
  expect(h.window.kbGraphCanvases.activeId).toBe('c1');expect(cy.nodes().length).toBe(0);
  cy.add({data:{id:'entity/a',label:'A'},position:{x:123,y:456}});cy.zoom(1.5);cy.pan({x:7,y:8});
  await h.window.kbGraphCanvases.save();
  expect(h.saved.get('c1').graph.nodes[0].position).toEqual({x:123,y:456});
  await h.get('graphCanvasNew').click();expect(h.window.kbGraphCanvases.activeId).toBe('c2');expect(cy.nodes().length).toBe(0);
  await h.get('graphCanvasTabs').children[1].click();
  expect(cy.nodes().length).toBe(1);expect(cy.getElementById('entity/a').position()).toEqual({x:123,y:456});expect(cy.zoom()).toBe(1.5);
  await h.get('graphCanvasRename').click();expect(h.saved.get('c1').name).toBe('改名');
  await h.get('graphCanvasDelete').click();expect(h.saved.has('c1')).toBe(false);expect(h.window.kbGraphCanvases.activeId).toBeNull();
  expect(cy.nodes().length).toBe(1); // Original relationship browsing is restored.
  cy.destroy();
});

test('login with a legacy username-only response refreshes canvases and enables creation',async()=>{
  const h=setup(null);
  expect(h.get('graphCanvasNew').disabled).toBe(true);
  expect(h.get('graphCanvasStatus').textContent).toContain('登录');
  h.window.authUser={username:'member'};
  await h.events.get('kb-auth-change')();
  expect(h.get('graphCanvasNew').disabled).toBe(false);
  expect(h.get('graphCanvasStatus').textContent).toBe('关系浏览');
  await h.get('graphCanvasNew').click();
  expect(h.window.kbGraphCanvases.activeId).toBe('c1');
  expect([...h.storage.keys()].some(key=>key.includes('user:member'))).toBe(true);
  h.window.authUser=null;await h.events.get('kb-auth-change')();
  expect(h.get('graphCanvasNew').disabled).toBe(true);
  expect(h.window.kbGraphCanvases.activeId).toBeNull();
  h.window.kbCy.destroy();
});

test('refresh saves pending edits before reading the current canvas and keeps its layout',async()=>{
  const h=setup();await new Promise(resolve=>setTimeout(resolve,0));
  await h.get('graphCanvasNew').click();
  h.window.kbCy.add({data:{id:'entity/a',label:'A'},position:{x:42,y:65}});
  const start=h.requests.length;
  await h.get('graphCanvasRefresh').click();
  expect(h.requests.slice(start).map(r=>r.method)).toEqual(['PUT','GET','GET']);
  expect(h.window.kbGraphCanvases.activeId).toBe('c1');
  expect(h.window.kbCy.getElementById('entity/a').position()).toEqual({x:42,y:65});
  expect(h.get('graphCanvasStatus').textContent).toBe('已刷新');
  expect(h.get('graphCanvasRefresh').disabled).toBe(false);
  h.window.kbCy.destroy();
});
