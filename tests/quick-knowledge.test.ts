import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync('public/assets/scripts/quick-knowledge.js', 'utf8');
const splitTags = new Function(source.slice(source.indexOf('  function splitTags('), source.indexOf('  function categoryOptions(')) + ';return splitTags;')();
const categoryOptions = new Function(source.slice(source.indexOf('  function categoryOptions('), source.indexOf('  const dialog =')) + ';return categoryOptions;')();

function setup(fetcher: Function) {
  let submit: Function;
  const values: any = Object.fromEntries(Object.entries({name:' 新想法 ',description:'描述',category:'class-a',type:'type-a',tags:'灵感，阅读,灵感',link:'https://example.com',visibility:'private'}).map(([key,value])=>[key,{value}]));
  const refs = new Map<string, any>();
  const get = (key: string) => { if (!refs.has(key)) refs.set(key,{textContent:'',hidden:false,disabled:false,focus() {}}); return refs.get(key); };
  const form = {reportValidity:()=>true,addEventListener:(_: string, fn: Function)=>{submit=fn;}};
  const events: any[] = [], requests: any[] = [];
  const block = source.slice(source.indexOf("  form.addEventListener('submit'"),source.lastIndexOf('})();'));
  const state = new Function('form','fields','get','fetch','scopedUrl','window','splitTags','uploadAttachments', `let saving=false,saved=false;${block};return ()=>({saving,saved});`)(
    form,{namedItem:(name: string)=>values[name]},get,async (url: URL,options: any)=>{requests.push({url,options});return fetcher();},
    (path: string)=>new URL(path+'?db=demo','http://localhost'),{dispatchEvent:(event: any)=>events.push(event)},splitTags,async()=>({images:[],videos:[]}),
  );
  return {submit:()=>submit!({preventDefault() {}}),get,state,events,requests,values};
}
test('quick create sends scoped canonical taxonomy, tags and visibility and stays on the current page', async () => {
  const h = setup(async ()=>({ok:true,text:async()=>JSON.stringify({node:{id:'Q1'},sync:'synced'})}));
  await h.submit();
  expect(h.requests[0].url.pathname).toBe('/api/kb/nodes');
  expect(h.requests[0].url.searchParams.get('db')).toBe('demo');
  expect(JSON.parse(h.requests[0].options.body)).toMatchObject({name:'新想法',categoryIds:['class-a'],typeId:'type-a',tags:['灵感','阅读'],visibility:'private'});
  expect(h.state().saved).toBe(true);
  expect(h.get('[data-quick-success]').hidden).toBe(false);
  expect(h.events[0].type).toBe('kb:knowledge-created');
});
test('double submit is blocked while saving and failure retains entered content', async () => {
  let resolve: Function;
  const h = setup(()=>new Promise(done=>{resolve=done;}));
  const saving = h.submit(); await h.submit();
  expect(h.requests).toHaveLength(1);
  resolve!({ok:false,status:403,text:async()=>'{"error":"需要应用成员权限"}'}); await saving;
  expect(h.get('[data-quick-message]').textContent).toBe('需要应用成员权限');
  expect(h.values.name.value).toBe(' 新想法 ');
  expect(h.state()).toEqual({saving:false,saved:false});
  expect(h.events).toHaveLength(0);
});
test('category choices include the full path and tolerate broken parent cycles', () => {
  expect(categoryOptions([{id:'a',name:'科学'},{id:'b',name:'天文',parent_id:'a'}])[1]).toEqual({id:'b',label:'科学 / 天文'});
  expect(categoryOptions([{id:'a',name:'A',parent_id:'b'},{id:'b',name:'B',parent_id:'a'}])).toHaveLength(2);
});

test('attachments upload to the existing scoped endpoints and retries reuse uploaded files', async () => {
  const attachments = [
    {kind:'image',file:new File(['image'],'a.png',{type:'image/png'}),url:''},
    {kind:'video',file:new File(['video'],'b.mp4',{type:'video/mp4'}),url:''},
    {kind:'pdf',file:new File(['pdf'],'c.pdf',{type:'application/pdf'}),url:''},
  ];
  const paths: string[] = [];
  const block = source.slice(source.indexOf('  async function uploadAttachments()'),source.indexOf('  function scopedUrl('));
  const upload = new Function('attachments','get','fetch','scopedUrl',block+'; return uploadAttachments;')(
    attachments,()=>({textContent:''}),async (url: URL,options: any)=>{
      paths.push(url.pathname);
      expect(url.searchParams.get('db')).toBe('demo');
      expect(options.body.get('file')).toBeInstanceOf(File);
      return {ok:true,text:async()=>JSON.stringify({url:'/uploads/'+paths.length})};
    },(path: string)=>new URL(path+'?db=demo','http://localhost'),
  );
  expect(await upload()).toEqual({images:['/uploads/1'],videos:['/uploads/2'],pdf:'/uploads/3'});
  expect(paths).toEqual(['/api/kb/upload-image','/api/kb/upload-video','/api/kb/upload-pdf']);
  await upload();
  expect(paths).toHaveLength(3);
});
