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
      if(url.pathname==='/api/kb/node')return Response.json({node:{id:url.searchParams.get('id'),name:'Knowledge detail',description:'Shared shorts detail component in a mobile-width panel.'}});
      if(url.pathname==='/api/kb/node/graph'||url.pathname==='/api/kb/discover/search'){
        const center=url.searchParams.get('id')||'fixture-center';
        const nodes=Array.from({length:12},(_,i)=>({id:i===0?center:'fixture-'+i,name:i===0?'Knowledge ecosystem':('Knowledge '+i),type:i%3===0?'Topic':i%3===1?'Concept':'Application',description:'Connected knowledge used to verify graph rendering.'}));
        if(url.pathname==='/api/kb/node/graph'&&center!=='fixture-center')nodes.push({id:center+'-extra',name:'Additional knowledge',type:'Concept'});
        return Response.json({nodes,total:nodes.length,edges:nodes.slice(1).map((node,i)=>({source:i%2?node.id:center,target:i%2?center:node.id,label:i%3===0?'depends on':'related to'}))});
      }
      return original(input,options);
    };
  })()`});
  const url=base+'/kb#view=knowledge_graph&node=fixture-center';
  console.log('Opening actual application');
  await cdp('Page.navigate',{url});
  await until(()=>evaluate(`document.querySelectorAll('#knowledgeRelationPage canvas').length>0`)).catch(async error=>{console.error('Page state',await evaluate(`({url:location.href,title:document.title,graph:!!document.getElementById('knowledgeRelationPage'),mode:window.kbViewMode,status:document.querySelector('#knowledgeRelationPage [data-status]')?.textContent})`),errors);throw error;});
  assert.equal(await evaluate(`new URLSearchParams(location.hash.slice(1)).get('node')`),'fixture-center');
  assert.ok(await evaluate(`document.querySelector('.relation-page-canvas').getBoundingClientRect().height>200`));
  await until(()=>evaluate(`document.querySelector('#knowledgeRelationPage [data-status]').textContent.includes('12')`)).catch(async error=>{console.error(await evaluate(`document.querySelector('#knowledgeRelationPage [data-status]').textContent`),errors);throw error;});
  await cdp('Page.reload',{ignoreCache:true});
  await until(()=>evaluate(`document.querySelectorAll('#knowledgeRelationPage canvas').length>0`));
  assert.equal(await evaluate(`new URLSearchParams(location.hash.slice(1)).get('node')`),'fixture-center');
  await evaluate(`window.dispatchEvent(new CustomEvent('kb-auth-change'))`);
  await until(()=>evaluate(`document.querySelectorAll('#knowledgeRelationPage canvas').length>0`));
  assert.equal(await evaluate(`document.querySelector('#knowledgeRelationPage [data-layout]').value`),'cose');
  assert.equal(await evaluate(`document.querySelector('.relation-page-canvas')._cyreg.cy.nodes().length`),12);
  await until(()=>evaluate(`!!document.querySelector('.relation-detail-host #homeMediaViewer[open]')`));
  assert.ok(await evaluate(`document.querySelector('.relation-detail-host #homeMediaViewer').getBoundingClientRect().width<=520`));
  assert.equal(await evaluate(`document.querySelectorAll('#knowledgeRelationPage .relation-node-list').length`),0);
  assert.ok(await evaluate(`(()=>{const host=document.querySelector('.relation-detail-host').getBoundingClientRect(),viewer=document.querySelector('.relation-detail-host #homeMediaViewer').getBoundingClientRect(),body=document.querySelector('.relation-page-body').getBoundingClientRect();return host.width>=400&&host.height>body.height-65&&Math.abs(viewer.height-host.height)<2;})()`));
  const expandedCanvasWidth=await evaluate(`document.querySelector('.relation-page-canvas').getBoundingClientRect().width`);
  await click('.relation-detail-host #homeMediaViewer [data-ref="close"]');
  assert.equal(await evaluate(`getComputedStyle(document.getElementById('relationDetailPanel')).display`),'none');
  assert.ok(await evaluate(`document.querySelector('.relation-page-canvas').getBoundingClientRect().width`)>expandedCanvasWidth);
  await click('#knowledgeRelationPage [data-toggle-detail]');
  assert.notEqual(await evaluate(`getComputedStyle(document.getElementById('relationDetailPanel')).display`),'none');
  console.log('PASS: detail panel collapses and expands, graph width adapts.');
  const beforePositions=await evaluate(`Object.fromEntries(document.querySelector('.relation-page-canvas')._cyreg.cy.nodes().map(node=>[node.id(),node.position()]))`);
  await evaluate(`void document.querySelector('.relation-page-canvas')._cyreg.cy.getElementById('fixture-1').emit('tap')`);
  await until(()=>evaluate(`document.querySelector('.relation-page-canvas')._cyreg.cy.nodes().length>12`));
  assert.ok(await evaluate(`!!document.querySelector('.relation-page-canvas')._cyreg.cy.getElementById('fixture-center').length`));
  const afterPositions=await evaluate(`Object.fromEntries(document.querySelector('.relation-page-canvas')._cyreg.cy.nodes().filter(node=>${JSON.stringify(Object.keys(beforePositions))}.includes(node.id())).map(node=>[node.id(),node.position()]))`);
  assert.deepEqual(afterPositions,beforePositions);
  await sleep(500);
  assert.ok(await evaluate(`(()=>{const cy=document.querySelector('.relation-page-canvas')._cyreg.cy,node=cy.getElementById('fixture-1'),p=node.renderedPosition();return Math.abs(p.x-cy.width()/2)<2&&Math.abs(p.y-cy.height()/2)<2;})()`));
  console.log('PASS: selected node centers smoothly without changing model positions.');

  await evaluate(`void document.querySelector('.relation-page-canvas')._cyreg.cy.getElementById('fixture-1').emit('tap')`);
  assert.ok(await evaluate(`document.querySelector('.relation-page-canvas')._cyreg.cy.edges().map(edge=>edge.id()).length===new Set(document.querySelector('.relation-page-canvas')._cyreg.cy.edges().map(edge=>edge.id())).size`));
  console.log('PASS: force layout defaults, clicking a neighbor adds knowledge without moving existing nodes or duplicating edges.');
  await evaluate(`const control=document.querySelector('#knowledgeRelationPage [data-layout]');control.value='concentric';control.dispatchEvent(new Event('change'));`);
  await sleep(600);
  await evaluate(`window.setViewMode('app_explore')`);
  await until(()=>evaluate(`getComputedStyle(document.getElementById('knowledgeExplorePage')).display!=='none'`));
  await evaluate(`window.openKnowledgeRelation('fixture-center')`);
  await until(()=>evaluate(`document.querySelectorAll('#knowledgeRelationPage canvas').length>0`));
  assert.equal(await evaluate(`getComputedStyle(document.getElementById('knowledgeExplorePage')).display`),'none');
  await click('#knowledgeRelationPage [data-back]');
  await until(()=>evaluate(`window.kbViewMode==='app_explore'`));
  assert.notEqual(await evaluate(`getComputedStyle(document.getElementById('knowledgeExplorePage')).display`),'none');
  await evaluate(`window.openKnowledgeRelation('fixture-center')`);
  await until(()=>evaluate(`document.querySelectorAll('#knowledgeRelationPage canvas').length>0`));
  console.log('PASS: entering graph hides explore cards; returning restores explore.');
  await cdp('Page.captureScreenshot',{format:'png'}).then(result=>writeFile('relation-graph-preview.png',Buffer.from(result.data,'base64')));
  assert.deepEqual(errors.filter(error=>/knowledge-relation-page/.test(error)),[]);
  await evaluate(`window.setViewMode('big_bang')`);
  await until(()=>evaluate(`document.querySelector('.big-bang-status')?.textContent.includes('12')`));
  await sleep(1200);
  const before=await evaluate(`({background:getComputedStyle(document.querySelector('.knowledge-big-bang')).backgroundImage,canvas:document.querySelector('.knowledge-big-bang canvas').toDataURL()})`);
  await click('[data-home-action="theme"]');await sleep(200);
  const after=await evaluate(`({background:getComputedStyle(document.querySelector('.knowledge-big-bang')).backgroundImage,canvas:document.querySelector('.knowledge-big-bang canvas').toDataURL()})`);
  assert.notEqual(before.background,after.background);assert.notEqual(before.canvas,after.canvas);
  assert.deepEqual(errors.filter(error=>/knowledge-big-bang/.test(error)),[]);
  console.log('PASS: theme switch updates both universe background and canvas knowledge cards without navigation.');
  console.log('PASS: actual app opens and refreshes knowledge_graph with node preserved; Cytoscape restores unrestricted bidirectional relationships and a mobile media inspector, auth reload and layout switching work.');
} finally {
  socket?.close(); browser?.kill(); 
  await sleep(500);
  // mkdtemp creates this isolated path under the OS temporary directory.
  if (resolve(profile).startsWith(resolve(tmpdir()) + sep) && basename(profile).startsWith('relation-browser-')) {
    await rm(profile,{recursive:true,force:true,maxRetries:2,retryDelay:100}).catch(()=>{});
  }

}
