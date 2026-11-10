import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const html=readFileSync('public/index.html','utf8');
const block=html.slice(html.indexOf('    async function captureVideoPoster('),html.indexOf('    const fType =',html.indexOf('    async function captureVideoPoster(')));
function setup() {
  const events:Record<string,Function>={};let timeout:Function,revoked=0,cleared=0,loaded=0;
  const video:any={readyState:0,duration:10,videoWidth:1920,videoHeight:1080,seeking:false,
    addEventListener:(key:string,fn:Function)=>{events[key]=fn;},removeEventListener:(key:string)=>{delete events[key];},
    removeAttribute(){},load(){loaded++;}};
  const canvas:any={getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,frame'};
  const capture=new Function('document','URL','setTimeout','clearTimeout',block+';return captureVideoPoster;')(
    {createElement:(tag:string)=>tag==='video'?video:canvas},
    {createObjectURL:()=> 'blob:local',revokeObjectURL:()=>{revoked++;}},
    (fn:Function)=>{timeout=fn;return 1;},()=>{cleared++;},
  );
  return {capture,video,canvas,events,timeout:()=>timeout!(),counts:()=>({revoked,cleared,loaded})};
}
test('video frame capture scales the poster and releases all listeners, timers and object URLs', async()=>{
  const h=setup();const pending=h.capture(new File(['video'],'video.mp4'));
  h.events.loadedmetadata!();expect(h.video.currentTime).toBe(0.5);
  h.video.readyState=2;h.events.seeked!();
  expect(await pending).toBe('data:image/jpeg;base64,frame');
  expect(h.canvas.width).toBe(1280);expect(h.canvas.height).toBe(720);
  expect(h.counts()).toEqual({revoked:1,cleared:1,loaded:1});
  expect(Object.keys(h.events)).toHaveLength(0);
  h.timeout();expect(h.counts().revoked).toBe(1);
});
test('unsupported videos and decoding timeouts reject and release resources', async()=>{
  for(const event of ['error','timeout']) {
    const h=setup();const pending=h.capture(new File(['video'],'video.mp4'));
    if(event==='error')h.events.error!();else h.timeout();
    await expect(pending).rejects.toThrow(event==='error'?'无法读取视频':'超时');
    expect(h.counts().revoked).toBe(1);expect(Object.keys(h.events)).toHaveLength(0);
  }
});
