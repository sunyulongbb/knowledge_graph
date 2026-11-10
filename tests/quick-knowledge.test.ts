import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync('public/assets/scripts/quick-knowledge.js', 'utf8');
const splitTags = new Function(source.slice(source.indexOf('  function splitTags('), source.indexOf('  function categoryOptions(')) + ';return splitTags;')();
const categoryOptions = new Function(source.slice(source.indexOf('  function categoryOptions('), source.indexOf('  const dialog =')) + ';return categoryOptions;')();

const html = readFileSync('public/index.html', 'utf8');
const parseNode = new Function(html.slice(html.indexOf('    function parseComposerNodeText('), html.indexOf('    function formatComposerTagText(')) + '; return parseComposerNodeText;')();
const parseQuickComposer = new Function('window', source.slice(source.indexOf('  function splitTags('), source.indexOf('  function categoryOptions(')) + '; return parseQuickComposer;')({parseComposerNodeText:parseNode});

function setup(fetcher: Function) {
  let submit: Function;
  const values: any = Object.fromEntries(Object.entries({content:' 新想法（别名）\n\n描述 #灵感 ',category:'class-a',type:'type-a',tags:'灵感，阅读,灵感',link:'https://example.com',visibility:'private'}).map(([key,value])=>[key,{value,setCustomValidity(message:string){this.validationMessage=message;},reportValidity(){return !this.validationMessage;}}]));
  values.category.selectedOptions = [{value:'class-a',textContent:'分类 A'}];
  const refs = new Map<string, any>();
  const get = (key: string) => { if (!refs.has(key)) refs.set(key,{textContent:'',hidden:false,disabled:false,focus() {}}); return refs.get(key); };
  const form = {reportValidity:()=>true,addEventListener:(_: string, fn: Function)=>{submit=fn;}};
  const events: any[] = [], requests: any[] = [];
  const block = source.slice(source.indexOf("  form.addEventListener('submit'"),source.lastIndexOf('})();'));
  const state = new Function('form','fields','get','fetch','scopedUrl','window','parseQuickComposer','uploadAttachments','closeOntology', `let saving=false,saved=false;${block};return ()=>({saving,saved});`)(
    form,{namedItem:(name: string)=>values[name]},get,async (url: URL,options: any)=>{requests.push({url,options});return fetcher();},
    (path: string)=>new URL(path+'?db=demo','http://localhost'),{dispatchEvent:(event: any)=>events.push(event)},parseQuickComposer,async()=>({images:[],videos:[]}),()=>{},
  );
  return {submit:()=>submit!({preventDefault() {}}),get,state,events,requests,values};
}
test('quick create sends scoped canonical taxonomy, tags and visibility and stays on the current page', async () => {
  const h = setup(async ()=>({ok:true,text:async()=>JSON.stringify({node:{id:'Q1'},sync:'synced'})}));
  await h.submit();
  expect(h.requests[0].url.pathname).toBe('/api/kb/nodes');
  expect(h.requests[0].url.searchParams.get('db')).toBe('demo');
  expect(JSON.parse(h.requests[0].options.body)).toMatchObject({name:'新想法',description:'描述',aliases:['别名'],categoryIds:['class-a'],typeId:'type-a',tags:['灵感','阅读'],visibility:'private'});
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
  expect(h.values.content.value).toBe(' 新想法（别名）\n\n描述 #灵感 ');
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
  const upload = new Function('attachments','get','fetch','scopedUrl','prepareVideoCover',block+'; return uploadAttachments;')(
    attachments,()=>({textContent:''}),async (url: URL,options: any)=>{
      paths.push(url.pathname);
      expect(url.searchParams.get('db')).toBe('demo');
      expect(options.body.get('file')).toBeInstanceOf(File);
      return {ok:true,text:async()=>JSON.stringify({url:'/uploads/'+paths.length})};
    },(path: string)=>new URL(path+'?db=demo','http://localhost'), async (item: any)=> { item.cover='data:image/jpeg;base64,poster'; return item.cover; },
  );
  expect(await upload()).toEqual({images:['/uploads/1'],videos:['/uploads/2'],covers:['data:image/jpeg;base64,poster'],pdf:'/uploads/3'});
  expect(paths).toEqual(['/api/kb/upload-image','/api/kb/upload-video','/api/kb/upload-pdf']);
  await upload();
  expect(paths).toHaveLength(3);
});

test('home composer shares workspace parsing for paragraphs, aliases and inline tags', () => {
  const result = parseQuickComposer('知识图谱（Knowledge Graph、KG）\n\n第一段\n下一行\n\n第二段 #学习 #阅读', '阅读,灵感');
  expect(result).toEqual({name:'知识图谱',description:'第一段\n下一行\n\n第二段',aliases:['Knowledge Graph','KG'],tags:['阅读','灵感','学习']});
  expect(parseQuickComposer('标题\n\nC# 与 https://example.com/#anchor').tags).toEqual([]);
  expect(parseQuickComposer('标题\n\n#Deep Learning #AI','Deep Learning').tags).toEqual(['Deep Learning','AI']);
  expect(parseQuickComposer('标题\n\n#Deep Learning #AI','Deep Learning').description).toBe('');
});

test('invalid parsed title or oversized descriptions are rejected before uploads or create', async () => {
  const h=setup(()=>{throw Error('should not send');});
  for(const content of ['（只有别名）','超'.repeat(301),'标题\n\n'+'字'.repeat(10001)]) {
    h.values.content.value=content;
    await h.submit();
    expect(h.requests).toHaveLength(0);
    expect(h.state()).toEqual({saving:false,saved:false});
  }
});

test('video cover extraction is shared by preview and publishing, cached on retry and kept per file', async () => {
  const a:any={file:new File(['a'],'a.mp4')}, b:any={file:new File(['b'],'b.mp4')};
  let calls=0, resolve:Function;
  const block=source.slice(source.indexOf('  async function prepareVideoCover('),source.indexOf('  async function uploadAttachments('));
  const prepare=new Function('window','attachments','renderAttachments',block+';return prepareVideoCover;')(
    {captureVideoPoster:(file:File)=>{calls++;return file===a.file?new Promise(done=>{resolve=done;}):Promise.resolve('poster-b');}},[a,b],()=>{},
  );
  const first=prepare(a),second=prepare(a);
  expect(calls).toBe(1);
  expect(await prepare(b)).toBe('poster-b');
  resolve!('poster-a');
  expect(await first).toBe('poster-a');expect(await second).toBe('poster-a');
  expect(await prepare(a)).toBe('poster-a');
  expect(calls).toBe(2);expect(a.cover).toBe('poster-a');expect(b.cover).toBe('poster-b');
});

test('failed video extraction releases pending state and can be retried', async () => {
  const item:any={file:new File(['a'],'a.mp4')};let calls=0;
  const block=source.slice(source.indexOf('  async function prepareVideoCover('),source.indexOf('  async function uploadAttachments('));
  const prepare=new Function('window','attachments','renderAttachments',block+';return prepareVideoCover;')(
    {captureVideoPoster:async()=>{if(++calls===1)throw Error('decode failed');return 'poster';}},[item],()=>{},
  );
  await expect(prepare(item)).rejects.toThrow('decode failed');
  expect(item.coverPromise).toBeNull();expect(item.coverError).toContain('失败');
  expect(await prepare(item)).toBe('poster');expect(item.coverError).toBe('');
});

test('category tree preserves hierarchy and safely retains orphan/cyclic categories', () => {
  const block=source.slice(source.indexOf('  function buildCategoryTree('),source.indexOf('  const dialog ='));
  const build=new Function(block+';return buildCategoryTree;')();
  const roots=build([{id:'a',name:'根分类'},{id:'b',parent_id:'a'},{id:'orphan',parent_id:'missing'},{id:'cycle',parent_id:'cycle'}]);
  expect(roots.map((row:any)=>row.id)).toEqual(['a','orphan','cycle']);
  expect(roots[0].children[0].id).toBe('b');
  expect(build([{id:'a',children:[{id:'b'}]}])[0].children[0].parent_id).toBe('a');
});

test('multiple selected categories are submitted using canonical IDs', async () => {
  const h=setup(async()=>({ok:true,text:async()=>'{"node":{"id":"new"}}'}));
  h.values.category.selectedOptions=[{value:'class-a'},{value:'class-b'}];
  await h.submit();
  expect(JSON.parse(h.requests[0].options.body).categoryIds).toEqual(['class-a','class-b']);
});

function setupOntologyPicker(fetcher?: Function) {
  const refs=new Map<string,any>();
  const get=(key:string)=>{
    if(!refs.has(key))refs.set(key,{hidden:key==='#quickOntologyDropdown',value:'',style:{},offsetWidth:300,offsetHeight:300,textContent:'',focus(){},setAttribute(name:string,value:string){this[name]=value;},getBoundingClientRect:()=>({left:20,top:100,bottom:130}),append(){}});
    return refs.get(key);
  };
  const control:any={value:'',options:[{value:'',textContent:'暂不设置'}],add(option:any){this.options.push(option);}};
  const controllers:any[]=[],requests:string[]=[];
  const nodes=[{id:'parent',name:'上级本体',children:[{id:'child',name:'子本体'}]}];
  class Tree {
    constructor(public host:any,public options:any){controllers.push(this);}
    update(nodes:any,selected:string){Object.assign(this,{nodes,selected});}
    filter(query:string){Object.assign(this,{query});}
    destroy(){Object.assign(this,{destroyed:true});}
  }
  const block=source.slice(source.indexOf('  function closeOntology()'),source.indexOf('  async function loadOptions()'));
  const api=new Function('get','fields','window','dialog','fetch','scopedUrl','updateMeta','document','Option',`
    let saving=false,saved=false,ontologyVersion=0,ontologyItems=null,ontologyScope=null,ontologyController=null;
    ${block};return {open:openOntology,close:closeOntology};`)(
    get,{namedItem:()=>control},{innerWidth:1000,innerHeight:800,kbOntologyTreeModuleReady:Promise.resolve({OntologyTreeController:Tree})},{open:true},
    async(url:string)=>{requests.push(url);return fetcher?fetcher():{ok:true,json:async()=>({items:nodes})};},
    (path:string)=>new URL(path+'?db=demo','http://localhost'),()=>{}, {createElement:()=>({})},
    function(this:any,label:string,value:string){this.value=value;this.textContent=label;},
  );
  return {api,get,control,controllers,requests,nodes};
}

test('home ontology picker reuses workspace tree with hierarchy, selected ID and clear action', async()=>{
  const h=setupOntologyPicker();
  await h.api.open();
  expect(h.requests[0]).toBe('http://localhost/api/kb/ontology/tree?db=demo');
  expect(h.get('#quickOntologyDropdown').hidden).toBe(false);
  const tree=h.controllers[0];
  expect(tree.options).toMatchObject({allLabel:'不设置本体',showAllButton:true,enableDrag:false,enableContextMenu:false,disableReadonlyItems:false,toggleSelection:false});
  expect(tree.nodes).toEqual(h.nodes);
  tree.options.onSelect('child');
  expect(h.control.value).toBe('child');
  expect(h.control.options.at(-1)).toMatchObject({value:'child',textContent:'子本体'});
  expect(h.get('#quickOntologyDropdown').hidden).toBe(true);
  await h.api.open();
  expect(h.requests).toHaveLength(1);
  expect(h.controllers[1].selected).toBe('child');
  h.controllers[1].options.onSelect('');
  expect(h.control.value).toBe('');
  expect(h.get('[data-quick-ontology]')['aria-expanded']).toBe('false');
});

test('closing ontology popup while loading prevents a stale result from opening it again',async()=>{
  let resolve:Function;
  const h=setupOntologyPicker(()=>new Promise(done=>{resolve=done;}));
  const pending=h.api.open();h.api.close();
  resolve!({ok:true,json:async()=>({items:h.nodes})});await pending;
  expect(h.get('#quickOntologyDropdown').hidden).toBe(true);
  expect(h.controllers).toHaveLength(0);
});

test('right category tree toggles independent multiple selections and blocks changes during save',async()=>{
  const control:any={options:[{value:'parent',selected:false},{value:'child',selected:false}],get selectedOptions(){return this.options.filter((option:any)=>option.selected);}};
  const get=()=>({value:'',append(){},textContent:''});
  const controllers:any[]=[];let updates=0;
  class Tree {
    constructor(_host:any,public options:any){controllers.push(this);}
    update(){} filter(){}
  }
  const block=source.slice(source.indexOf('  async function renderCategoryTree('),source.indexOf('  function closeOntology('));
  const api=new Function('get','fields','window','dialog','scopedUrl','updateMeta','loadOptions','document',`
    let categoryController=null,categoryNodes=[{id:'parent',children:[{id:'child'}]}],categoryVersion=0,saving=false,saved=false;
    ${block};return {render:renderCategoryTree,setSaving:()=>{saving=true;}};`)(
    get,{namedItem:()=>control},{kbOntologyTreeModuleReady:Promise.resolve({OntologyTreeController:Tree})},{open:true},()=>new URL('http://localhost/?db=demo'),()=>{updates++;},()=>{}, {createElement:()=>({})},
  );
  await api.render();
  const tree=controllers[0];
  expect(tree.options).toMatchObject({showAllButton:false,nodeLabel:'分类',enableDrag:false,enableContextMenu:false});
  tree.options.onActivate('parent');await Promise.resolve();
  tree.options.onActivate('child');await Promise.resolve();
  expect(control.selectedOptions.map((option:any)=>option.value)).toEqual(['parent','child']);
  expect(tree.options.nodeIconFilled('child')).toBe(true);
  tree.options.onActivate('parent');await Promise.resolve();
  expect(control.selectedOptions.map((option:any)=>option.value)).toEqual(['child']);
  api.setSaving();tree.options.onActivate('child');
  expect(control.selectedOptions.map((option:any)=>option.value)).toEqual(['child']);
  expect(updates).toBe(3);
});
