import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const source=readFileSync('public/assets/scripts/detail-panel.js','utf8');
const block=source.slice(source.indexOf('          const captureDetailVideoCover'),source.indexOf('          if (doc?.can_edit || canEditDefaultApplication()) {',source.indexOf('          const captureDetailVideoCover')));
function setup(fetcher?:Function) {
  const requests:any[]=[],timers:Function[]=[];
  class Video {readyState=2;videoWidth=1920;videoHeight=1080;currentTime=7;poster='';}
  const doc:any={id:'entity/record',can_edit:true,covers:['first','','third']};
  const coverList=[...doc.covers],videoUrls=['/a.mp4','/b.mp4','/c.mp4'];
  const cached:any={id:'record',covers:[...coverList]};
  const window:any={location:{origin:'http://localhost'},kbTableNodes:[cached],kbShortsNodes:[],appendCurrentDbParam:(url:URL)=>{url.searchParams.set('db','demo');return url;}};
  const document={createElement:()=>{let frame='';return {getContext:()=>({drawImage:(video:Video)=>{frame=`jpeg-frame-${video.currentTime}`;}}),toDataURL:()=>frame};}};
  const api=new Function('doc','coverList','videoUrls','window','document','HTMLVideoElement','fetch','setTimeout',`
    let detailCoverSaveQueue=Promise.resolve(),detailVideoDeleting=false;
    const fullId='record',canEditDefaultApplication=()=>false,playlistNav=null;
    ${source.slice(source.indexOf('          const normalizeDetailCoverSlots'),source.indexOf('          const coverList ='))}
    ${block}
    return {update:updateDetailVideoCover,setDeleting:()=>{detailVideoDeleting=true;}};
  `)(doc,coverList,videoUrls,window,document,Video,async(url:string,options:any)=>{
    const body=JSON.parse(options.body);requests.push({url,body});
    return fetcher?fetcher(body):{ok:true,json:async()=>({ok:true,node:{covers:body.covers}})};
  },(fn:Function)=>{timers.push(fn);});
  return {api,Video,doc,coverList,cached,requests,timers};
}
test('manual cover uses the click-time frame and only replaces the matching slot, then updates caches',async()=>{
  const h=setup(),video=new h.Video(),item={index:1};
  const pending=h.api.update(item,video,{manual:true});
  video.currentTime=20; // Network delay or continued playback must not change the captured frame.
  await pending;
  expect(h.requests).toHaveLength(1);
  expect(new URL(h.requests[0].url).searchParams.get('db')).toBe('demo');
  expect(h.requests[0].body).toEqual({id:'record',covers:['first','jpeg-frame-7','third']});
  expect(video.poster).toBe('jpeg-frame-7');expect(h.cached.covers).toEqual(h.doc.covers);
  video.currentTime=30;await h.api.update(item,video,{manual:true});
  expect(h.requests[1].body.covers).toEqual(['first','jpeg-frame-30','third']);
});
test('late automatic validation cannot overwrite a manually selected frame',async()=>{
  const h=setup(),video=new h.Video(),item={index:0};
  video.readyState=0;const automatic=h.api.update(item,video);
  expect(h.timers).toHaveLength(1);
  video.readyState=2;video.currentTime=15;
  await h.api.update(item,video,{manual:true});
  h.timers.shift()!();await automatic;
  expect(h.requests).toHaveLength(1);expect(h.doc.covers[0]).toBe('jpeg-frame-15');
});
test('queued cover updates for different videos retain both changes',async()=>{
  const h=setup(),a=new h.Video(),b=new h.Video();a.currentTime=3;b.currentTime=4;
  await Promise.all([h.api.update({index:0},a,{manual:true}),h.api.update({index:2},b,{manual:true})]);
  expect(h.requests.at(-1).body.covers).toEqual(['jpeg-frame-3','','jpeg-frame-4']);
});
test('unready video, server errors and read-only records cannot report a successful save',async()=>{
  const h=setup(),video=new h.Video();video.readyState=1;
  await expect(h.api.update({index:0},video,{manual:true})).rejects.toThrow('尚未就绪');
  expect(h.requests).toHaveLength(0);
  video.readyState=2;h.doc.can_edit=false;
  await expect(h.api.update({index:0},video,{manual:true})).rejects.toThrow('权限');
  expect(h.requests).toHaveLength(0);
  const failed=setup(async()=>({ok:false,status:403,json:async()=>({error:'不允许修改'})}));
  await expect(failed.api.update({index:0},new failed.Video(),{manual:true})).rejects.toThrow('不允许修改');
  expect(failed.doc.covers).toEqual(['first','','third']);
});

test('playing a video with a saved cover preserves it across later playback',async()=>{
  const h=setup(),video=new h.Video();
  await h.api.update({index:1,poster:'previously-saved-manual-cover'},video);
  expect(h.requests).toHaveLength(0);
  expect(h.doc.covers).toEqual(['first','','third']);
});
