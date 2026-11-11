// Uses an isolated browser profile against RELATION_SMOKE_URL (default localhost:8080).
// Only the graph read endpoint is replaced with a fixture; no knowledge is written.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import assert from 'node:assert/strict';

const chrome = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium','/usr/bin/google-chrome'].find(existsSync);
if (!chrome) throw new Error('Set CHROME_PATH to an installed Chromium browser');
const profile = await mkdtemp(join(tmpdir(),'relation-browser-'));
let browser, socket;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn, timeout=15000) { const start=Date.now(); while(Date.now()-start<timeout) { const value=await fn(); if(value) return value; await sleep(80); } throw new Error('Timed out waiting for browser state'); }
try {
  const base=process.env.RELATION_SMOKE_URL || 'http://127.0.0.1:8080';
  browser=spawn(chrome,['--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1500,1000','about:blank'],{windowsHide:true,stdio:'ignore'});
  console.log('Starting headless browser');
  const port=await until(async()=>{try{return (await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{return null;}});
  console.log('Browser ready');
  const targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Browser socket timeout')),10000);socket.onopen=()=>{clearTimeout(timer);resolve();};socket.onerror=e=>{clearTimeout(timer);reject(e);};});
  let seq=0; const pending=new Map(), errors=[];
  socket.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result);}else if(msg.method==='Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);};
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Browser command timeout: '+method));},15000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;};
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const value=(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await cdp('Runtime.enable');await cdp('Page.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
    const original=window.fetch.bind(window);
    window.fetch=async(input,options)=>{
      const url=new URL(typeof input==='string'?input:input.url||input,location.origin);
      if(url.pathname==='/api/account/profile'){
        const counts={likes:28,favorites:16,history:128,applications:4,knowledge:36,comments:9};
        if(url.searchParams.get('section')==='summary')return Response.json({user:{displayName:'Knowledge explorer',username:'explorer',role:'user'},counts,activity:{year:2026,total:128,days:[{date:'2026-11-10',count:5}]}});
        return Response.json({items:Array.from({length:4},(_,i)=>({id:i+1,title:['Design notebook','Scientific discovery','Reading collection','Personal learning'][i],slug:'app-'+i,description:'Organize ideas and connect useful knowledge.',relationship:i%2?'member':'owner'})),total:4,totalPages:1});
      }
      if(url.pathname==='/api/kb/node/graph'||url.pathname==='/api/kb/discover/search'){
        const center=url.searchParams.get('id')||'fixture-center';
        const nodes=Array.from({length:12},(_,i)=>({id:i===0?center:'fixture-'+i,name:i===0?'Knowledge ecosystem':('Knowledge '+i),type:i%3===0?'Topic':i%3===1?'Concept':'Application',description:'Connected knowledge used to verify graph rendering.'}));
        return Response.json({nodes,total:nodes.length,edges:nodes.slice(1).map((node,i)=>({source:i%2?node.id:center,target:i%2?center:node.id,label:i%3===0?'depends on':'related to'}))});
      }
      return original(input,options);
    };
  })()`});
  await cdp('Page.navigate',{url:base+'/kb?profileTab=applications#profile'});
  await until(()=>evaluate(`document.querySelectorAll('.account-application-tile').length===4`));
  await sleep(300);
  assert.ok(await evaluate(`document.querySelector('.account-profile-overview').getBoundingClientRect().height>100`));
  assert.ok(await evaluate(`document.getElementById('userProfilePanel').scrollWidth<=document.getElementById('userProfilePanel').clientWidth`));
  await cdp('Page.captureScreenshot',{format:'png'}).then(result=>writeFile('profile-layout-preview.png',Buffer.from(result.data,'base64')));
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(300);
  assert.ok(await evaluate(`document.getElementById('userProfilePanel').scrollWidth<=document.getElementById('userProfilePanel').clientWidth`));
  assert.deepEqual(errors.filter(error=>/user-profile/.test(error)),[]);
  console.log('PASS: profile overview, activity and four application cards render; desktop and mobile layouts have no horizontal page overflow.');
} finally {
  socket?.close(); browser?.kill(); 
  await sleep(500);
  // mkdtemp creates this isolated path under the OS temporary directory.
  if (resolve(profile).startsWith(resolve(tmpdir()) + sep) && basename(profile).startsWith('relation-browser-')) {
    await rm(profile,{recursive:true,force:true,maxRetries:2,retryDelay:100}).catch(()=>{});
  }

}
