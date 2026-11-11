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
    id='';textContent='';style:any={};className='';width=0;height=0;children:any[]=[];refs=new Map<string,Element>();
    append(child:any){this.children.push(child);child.parent=this;}
    parent:any;
    remove(){this.parent.children=this.parent.children.filter((child:any)=>child!==this);}
    listeners:Record<string,Function>={};paused=true;src='';poster='';open=false;
    pause(){this.paused=true;}play(){this.paused=false;return Promise.resolve();}load(){}removeAttribute(key:string){if(key==='src')this.src='';}
    showModal(){this.open=true;}close(){this.open=false;this.listeners.close?.();}
    setAttribute(){} addEventListener(name:string,fn:Function){this.listeners[name]=fn;} set innerHTML(_value:string){}
    querySelector(selector:string):any{if(!this.refs.has(selector))this.refs.set(selector,new Element());return this.refs.get(selector);}
    querySelectorAll(){return [];}
    getContext(){return new Proxy({}, {get:(_target,key)=>key==='measureText'?((text:string)=>({width:text.length*6})):(()=>{})});}
    getBoundingClientRect(){return {width:800,height:600};}
  }
  const root=new Element(),requests:URL[]=[];
  const listeners:Record<string,Function>={};
  const window:any={kbViewMode:'big_bang',matchMedia:()=>({matches:true}),addEventListener(name:string,fn:Function){listeners[name]=fn;},removeEventListener(){}};
  const document={createElement:()=>new Element(),getElementById:()=>root};
  const loadedImages:any[]=[];
  class TestImage {src='';onload:Function|undefined;onerror:Function|undefined;constructor(){loadedImages.push(this);}}
  const frames:Function[]=[];
  const Observer=class {constructor(private callback:Function){} observe(){this.callback();} disconnect(){}};
  new Function('window','document','location','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','fetch','Image',source)(window,document,{origin:'http://localhost',search:'?db=demo&explore_category=science'},Observer,(callback:Function)=>{frames.push(callback);return frames.length;},()=>{},async(url:URL)=>{requests.push(url);return {ok:true,json:async()=>({nodes:[{id:'video-node',videos:['/first.mp4','/second.mp4'],covers:['/poster.jpg','/fallback.jpg']}]})};},TestImage);
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(root.children[0].children).toHaveLength(1);
  expect(loadedImages[0].src).toBe('/poster.jpg');
  loadedImages[0].onerror();expect(loadedImages[0].src).toBe('/fallback.jpg');
  loadedImages[0].onerror();
  const beforeAuth=root.children[0].children[0];
  beforeAuth.querySelector('canvas').listeners.keydown({key:'Enter',preventDefault(){}});
  expect(beforeAuth.querySelector('[data-play]').hidden).toBe(false);
  expect(beforeAuth.children).toHaveLength(1); // Selecting a video card starts inline playback directly.
  beforeAuth.querySelector('[data-play]').onclick();
  frames.shift()!(performance.now()+2000);
  let modal=beforeAuth.children[0],player=modal.querySelector('video');
  expect(Number.parseFloat(modal.style.width)).toBeCloseTo(300);
  expect(Number.parseFloat(modal.style.left)).toBeCloseTo(250);
  expect(modal.className).toBe('big-bang-card-video');expect(modal.open).toBe(false);expect(player.src).toBe('/first.mp4');expect(player.poster).toBe('/poster.jpg');
  expect(player.paused).toBe(false);
  modal.querySelector('[data-video-next]').onclick();
  expect(player.src).toBe('/second.mp4');expect(player.poster).toBe('/fallback.jpg');
  expect(modal.querySelector('[data-video-next]').disabled).toBe(true);
  modal.querySelector('[data-video-close]').onclick();
  expect(player.paused).toBe(true);expect(player.src).toBe('');
  expect(beforeAuth.children).toHaveLength(0);
  expect(root.children[0].children[0]).toBe(beforeAuth);
  beforeAuth.querySelector('[data-play]').onclick();
  let stopped=beforeAuth.children[0].querySelector('video');
  beforeAuth.querySelector('[data-unfocus]').onclick();
  expect(stopped.paused).toBe(true);expect(beforeAuth.children).toHaveLength(0);
  beforeAuth.querySelector('canvas').listeners.keydown({key:'Enter',preventDefault(){}});
  modal=beforeAuth.children[0];player=modal.querySelector('video');

  listeners['kb-auth-change']!();await new Promise(resolve=>setTimeout(resolve,0));
  expect(root.children[0].children).toHaveLength(1);
  expect(root.children[0].children[0]).not.toBe(beforeAuth);
  expect(player.paused).toBe(true);expect(player.src).toBe('');
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

const imageSources=new Function(source.slice(source.indexOf('  function bigBangImageSources('),source.indexOf('  let active='))+';return bigBangImageSources;')();
test('video-only knowledge displays its covers as image candidates including saved data URLs',()=>{
  expect(imageSources({videos:['/clip.mp4'],covers:['','/poster.jpg'],cover:'/poster.jpg'})).toEqual(['/poster.jpg']);
  expect(imageSources({covers:'["/first.jpg","/second.jpg"]'})).toEqual(['/first.jpg','/second.jpg']);
  expect(imageSources({cover:'data:image/jpeg;base64,current-frame'})).toEqual(['data:image/jpeg;base64,current-frame']);
});
test('universe images keep their order, include video covers as fallback and remove duplicates',()=>{
  expect(imageSources({images:['/photo.jpg'],covers:['/photo.jpg','/poster.jpg']},[{kind:'image',url:'/photo.jpg'},{kind:'video',url:'/clip.mp4'}])).toEqual(['/photo.jpg','/poster.jpg']);
  expect(imageSources({covers:[{url:'/poster.jpg'},{src:'/other.jpg'}],cover:'javascript:alert(1)'})).toEqual(['/poster.jpg','/other.jpg']);
  expect(imageSources({covers:['','//untrusted.example/image.jpg','not-an-image']})).toEqual([]);
});

const videosFor=new Function(source.slice(source.indexOf('  function bigBangVideos('),source.indexOf('  let active='))+';return bigBangVideos;')();
test('universe playback pairs videos with their cover slots and only accepts playable URL sources',()=>{
  expect(videosFor({videos:'["/first.mp4","/second.mp4"]',covers:['','/second.jpg'],cover:'/unrelated.jpg'})).toEqual([{src:'/first.mp4',poster:''},{src:'/second.mp4',poster:'/second.jpg'}]);
  expect(videosFor({video:'/single.mp4',cover:'data:image/jpeg;base64,frame'})).toEqual([{src:'/single.mp4',poster:'data:image/jpeg;base64,frame'}]);
  expect(videosFor({videos:[{url:'/one.mp4'},'/one.mp4','javascript:alert(1)']},[{kind:'video',url:'/one.mp4'}])).toEqual([{src:'/one.mp4',poster:''}]);
  expect(videosFor({images:['/photo.jpg']})).toEqual([]);
});
