// Uses a separate headless browser profile and an in-memory server. No production data.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import assert from 'node:assert/strict';

const chrome = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium','/usr/bin/google-chrome'].find(existsSync);
if (!chrome) throw new Error('Set CHROME_PATH to an installed Chromium browser');
const profile = await mkdtemp(join(tmpdir(),'pipeline-browser-'));
const server = spawn('bun',['scripts/pipeline-smoke-server.ts'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser, socket, stderr='';
server.stderr.on('data',chunk=>stderr+=chunk);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn, timeout=15000) { const start=Date.now(); while(Date.now()-start<timeout) { const value=await fn(); if(value) return value; await sleep(80); } throw new Error('Timed out waiting for browser state'); }
try {
  const base=await new Promise((resolve,reject)=>{ let output=''; const timer=setTimeout(()=>reject(new Error('Server start timeout: '+stderr)),15000); server.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/PIPELINE_SMOKE_URL=(http:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});server.on('exit',code=>{clearTimeout(timer);reject(new Error('Server exited '+code+': '+stderr));}); });
  browser=spawn(chrome,['--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1500,1000','about:blank'],{windowsHide:true,stdio:'ignore'});
  const port=await until(async()=>{try{return (await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{return null;}});
  const targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Browser socket timeout')),10000);socket.onopen=()=>{clearTimeout(timer);resolve();};socket.onerror=e=>{clearTimeout(timer);reject(e);};});
  let seq=0; const pending=new Map(), errors=[];
  socket.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result);}else if(msg.method==='Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);};
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Browser command timeout: '+method));},15000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;};
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const value=(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const idle=()=>until(()=>evaluate(`![...document.querySelectorAll('.pipeline-root')].some(r=>r.dataset.busy==='true')`));
  const message=()=>evaluate(`document.querySelector('#cleanPanel [data-message]').textContent`);
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Page.navigate',{url:base});
  await until(()=>evaluate(`!!document.querySelector('[data-action="read-file"]')`));
  console.log('Browser page loaded');
  const csv='id,name,birthday,country,occupation,aliases,description,tags\n1,张三,1990-01-01,中国,工程师,老张;张工,人物介绍,人物;工程师\n2,李四,1988-05-20,中国,教师,小李,教师介绍,人物;教师';
  await evaluate(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(csv)}],'people.csv',{type:'text/csv'}));const input=document.querySelector('[data-file]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await click('[data-action="read-file"]'); await idle();
  assert.equal(await evaluate(`document.querySelectorAll('[data-column]').length`),8);
  assert.ok(await evaluate(`(()=>{const r=document.querySelector('#entryPanel .pipeline-root');return r.getBoundingClientRect().bottom<=innerHeight+1 && r.scrollHeight<=r.clientHeight+1 && document.querySelector('[data-table-preview]').clientHeight>100})()`));
  if(process.env.PIPELINE_SCREENSHOT) {const shot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(process.env.PIPELINE_SCREENSHOT.replace('.png','-entry.png'),Buffer.from(shot.data,'base64'));}
  await click('[data-action="save-table"]'); await idle();
  console.log('Entity table saved');
  assert.ok(await evaluate(`!!document.querySelector('[data-table-clean]')`));
  await click('[data-table-clean]'); await idle();
  await until(()=>evaluate(`!!document.querySelector('#cleanPanel [data-node="ontology"]') && document.getElementById('cleanPanel').style.display!=='none'`));
  await click('[data-select-node="ontology"]'); await idle();
  await click('[data-ontology-tree]');
  await until(()=>evaluate(`!!document.querySelector('#pipelineOntologyPopup [data-dhx-id="person"]')`));
  await evaluate(`(()=>{const input=document.querySelector('#pipelineOntologyPopup input');input.value='人物';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await until(()=>evaluate(`!!document.querySelector('#pipelineOntologyPopup [data-dhx-id="person"]')`));
  await click('#pipelineOntologyPopup [data-dhx-id="person"]'); await idle();
  assert.equal(await evaluate(`document.querySelector('[data-config-key="ontologyId"]').value`),'person');
  assert.equal(await evaluate(`!!document.getElementById('pipelineOntologyPopup')`),false);
  assert.equal(await evaluate(`document.querySelector('[data-ontology-tree]').textContent.trim()`),'人物');
  const checkLayout=async()=>{
    assert.ok(await evaluate(`(()=>{const root=document.querySelector('#cleanPanel .pipeline-root'),r=root.getBoundingClientRect();return r.height>250 && r.bottom<=innerHeight+1 && root.scrollHeight<=root.clientHeight+1 && document.documentElement.scrollHeight<=innerHeight+1})()`),'cleaning page must stay inside viewport');
    assert.ok(await evaluate(`document.querySelector('.pipeline-canvas-scroll').clientHeight>120`));
  };
  await checkLayout();
  await click('[data-action="zoom-out"]'); await idle();
  await click('[data-action="fit-canvas"]'); await idle();
  for(const [width,height] of [[1024,768],[720,640],[480,700],[1500,1000]]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await sleep(150); await checkLayout();
  }
  if(process.env.PIPELINE_SCREENSHOT) {const shot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(process.env.PIPELINE_SCREENSHOT,Buffer.from(shot.data,'base64'));}
  await click('[data-select-node="properties"]'); await idle();
  for (const [key,column] of [['idField','id'],['nameField','name'],['aliasesField','aliases'],['descriptionField','description'],['tagsField','tags']]) {
    assert.equal(await evaluate(`document.querySelector('[data-config-key="${key}"]').value`),column);
  }
  assert.equal(await evaluate(`document.querySelectorAll('[data-map-field]').length`),3);
  for(const [field,property] of [['birthday','birthday'],['country','country'],['occupation','job']]) {await value('[data-map-field="'+field+'"]',property);await idle();}
  await click('[data-select-node="alignment"]'); await idle();
  await click('[data-action="delete-node"]'); await idle();
  assert.equal(await evaluate(`document.querySelectorAll('[data-node]').length`),5);
  await evaluate(`(()=>{const canvas=document.querySelector('[data-canvas]'), rect=canvas.getBoundingClientRect(), transfer=new DataTransfer();transfer.setData('text/plain','alignment');canvas.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer,clientX:rect.left+36,clientY:rect.top+176}));})()`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-node]').length`),6);
  await click('[data-action="disconnect"]'); await idle();
  await click('[data-action="preview"]'); await idle();
  assert.match(await message(),/完整连接/);
  const chain=['input','ontology','properties','alignment','fusion','output'];
  for(let i=0;i<chain.length-1;i++){await click('[data-port-out="'+chain[i]+'"]');await idle();await click('[data-port-in="'+chain[i+1]+'"]');await idle();}
  await click('[data-action="preview"]'); await idle();
  console.log('Preview:',await message());
  assert.equal(await evaluate(`document.querySelector('[data-dock]').dataset.dock`),'results');
  await checkLayout();
  assert.match(await message(),/预览完成/);
  assert.equal((await (await fetch(base+'/test/counts')).json()).nodes.count,1);
  assert.ok(await evaluate(`!!document.querySelector('[data-decision="0"]')`));
  await value('[data-decision="0"]','link:existing'); await idle();
  await click('[data-action="full"]'); await idle();
  assert.match(await message(),/全量计算完成/);
  assert.equal(await evaluate(`document.querySelector('[data-action="confirm"]').disabled`),false);
  await evaluate('window.confirm=()=>true'); await click('[data-action="confirm"]'); await idle();
  assert.match(await message(),/知识库保存完成/);
  const counts=await (await fetch(base+'/test/counts')).json();
  assert.equal(counts.nodes.count,3); assert.equal(counts.attributes.count,6);
  assert.deepEqual(counts.entities.find(n=>n.name==='张三'),{name:'张三',aliases:'["老张","张工"]',description:'人物介绍',tags:'["人物","工程师"]'});
  await click('[data-action="full"]'); await idle();
  assert.match(await message(),/全量计算完成/);
  await click('[data-tab="runs"]'); await idle();
  assert.match(await evaluate(`document.querySelector('#cleanPanel [data-body]').textContent`),/已入库/);
  await cdp('Page.navigate',{url:base+'/sparql?db=demo'});
  await until(()=>evaluate(`document.querySelectorAll('.sparql-filter-predicate').length===2`));
  assert.equal(await evaluate(`new URL(document.getElementById('backToEntry').href).searchParams.get('db')`),'demo');
  assert.notEqual(await evaluate(`getComputedStyle(document.getElementById('sparqlImportView')).display`),'none');
  assert.ok(await evaluate(`document.getElementById('sparqlImportView').getBoundingClientRect().height > 100`));
  await click('#btnSparqlAddFilter');
  assert.equal(await evaluate(`document.querySelectorAll('.sparql-filter-predicate').length`),3);
  assert.equal(await evaluate(`!!document.getElementById('entryManagerView')`),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: standalone SPARQL initializes and filter controls work without legacy entry code.');
  console.log('PASS: browser file → table → drag/delete/connect/config → preview → resolve match → full preview → confirm → rerun → history; no uncaught page errors.');
} finally {
  socket?.close(); browser?.kill(); server.kill();
  await sleep(500);
  // mkdtemp creates this isolated path under the OS temporary directory.
  if (resolve(profile).startsWith(resolve(tmpdir()) + sep) && basename(profile).startsWith('pipeline-browser-')) {
    await rm(profile,{recursive:true,force:true,maxRetries:2,retryDelay:100}).catch(()=>{});
  }
  server.stdout.destroy(); server.stderr.destroy();
}
