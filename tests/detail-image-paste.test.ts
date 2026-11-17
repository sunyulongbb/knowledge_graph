import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
test('visible knowledge detail accepts image paste without depending on the image tab',async()=>{
 const source=readFileSync('public/assets/scripts/detail-panel.js','utf8');
 const start=source.indexOf("        document.addEventListener('paste', async event =>",source.indexOf('const pasteDatabase'));
 const end=source.indexOf('}, {capture:true, signal:imageTabPasteController.signal});',start)+'}, {capture:true, signal:imageTabPasteController.signal});'.length;
 let listener:any;const requests:any[]=[];let refreshed=false;
 const document={getElementById:()=>({getClientRects:()=>[{}],closest:()=>null}),querySelector:()=>null,addEventListener:(_:any,callback:any)=>{listener=callback;}};
 const controller=new AbortController();const doc={id:'Q1',images:['/old.png']};
 new Function('document','window','doc','fullId','routeId','pasteStatus','pasteDatabase','location','pasteController','imageTabPasteController','fetch','showNodeDetailInline','preserveSidebarState','normalizeMediaStringList',
 'let uploadingImages=false;'+source.slice(start,end))(
 document,{kbActiveDetailNodeId:'Q1'},doc,'Q1','Q1',{},'project_a',{origin:'http://localhost'},controller,controller,
 async(url:any,options:any)=>{requests.push([url,options]);return {ok:true,json:async()=>url.pathname.endsWith('upload-image')?{url:'/new.png'}:{ok:true}};},async()=>{refreshed=true;},true,()=>[]);
 let prevented=false;
 await listener({target:{closest:()=>null},clipboardData:{items:[{type:'image/png',getAsFile:()=>new File(['test'],'image.png',{type:'image/png'})}]},preventDefault:()=>{prevented=true;}});
 expect(prevented).toBe(true);expect(requests).toHaveLength(2);
 expect(requests.every(([url])=>url.searchParams.get('db')==='project_a')).toBe(true);
 expect(JSON.parse(requests[1][1].body).images).toEqual(['/old.png','/new.png']);expect(refreshed).toBe(true);
});
