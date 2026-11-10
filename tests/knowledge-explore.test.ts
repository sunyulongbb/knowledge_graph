import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync('public/assets/scripts/knowledge-explore.js', 'utf8');
const build = new Function(source.slice(source.indexOf('  function buildExploreTree('), source.indexOf('  const panel =')) + '; return buildExploreTree;')();

test('explore follows actual parent IDs, preserves backend order and retains orphan categories', () => {
  const tree = build([{id:'root',name:'科学'}, {id:'child',parent_id:'root'}, {id:'leaf',parent:'child'}, {id:'orphan',parent_id:'missing'}]);
  expect(tree.roots.map((row: any) => row.id)).toEqual(['root','orphan']);
  expect(tree.children.get('root')[0].id).toBe('child');
  expect(tree.children.get('child')[0].id).toBe('leaf');
});

test('invalid cyclic parent data does not hide categories or recurse forever', () => {
  const tree = build([{id:'a',parent_id:'b'}, {id:'b',parent_id:'a'}, {id:'self',parent_id:'self'}]);
  expect(tree.byId.size).toBe(3);
  expect(tree.roots.map((row: any) => row.id)).toContain('a');
  expect(tree.roots.map((row: any) => row.id)).toContain('self');
});

function setup(fetcher: Function, search='?db=demo') {
  let click: Function;
  const listeners: Record<string, Function> = {};
  const panel: any = {setAttribute() {},innerHTML:'',scrollTop:0,addEventListener: (type: string, handler: Function) => { listeners[type] = handler; if(type === 'click') click = handler; }};
  const views: any[] = [], requests: URL[] = [];
  const location:any={origin:'http://localhost',search,href:'http://localhost/kb'+search+'#app_explore'};
  const windowEvents: Record<string, Function> = {};
  const window: any = {kbViewMode:'app_home',history:{state:{},replaceState:(_a:any,_b:any,url:URL)=>{location.href=url.href;location.search=url.search;}},addEventListener:(type: string, fn: Function)=>{ windowEvents[type] = fn; },setViewMode:(...args: any[])=>views.push(args)};
  const document = {createElement:()=>panel,getElementById:()=>({append() {}})};
  new Function('window','document','location','fetch',source)(window,document,location,async (url: URL)=>{
    requests.push(url);
    return {ok:true,json:async()=>fetcher(url)};
  });
  window.kbViewMode = 'app_explore';
  return {window,panel,views,requests,location,emit:(type:string)=>windowEvents[type]?.(),scroll:()=>listeners.scroll!(),click:(selector: string,dataset: any)=>click!({target:{closest:(query: string)=>query===selector?{dataset}:null}})};
}
const rows = [{id:'science',name:'科学',instance_count:5},{id:'space',name:'天文学',parent_id:'science',instance_count:2,description:'认识宇宙'}];
const tick = () => new Promise(resolve=>setTimeout(resolve,0));

test('explore renders real category cards and opens scoped knowledge without the search page', async () => {
  const h = setup((url: URL)=>url.pathname.endsWith('/classes')?rows:{nodes:[{id:'Q1',name:'月球'}],total:1});
  await h.window.loadKnowledgeExplore();
  expect(h.panel.innerHTML).toContain('天文学');
  expect(h.panel.innerHTML).toContain('认识宇宙');
  expect(h.requests[0]?.searchParams.get('db')).toBe('demo');
  h.click('[data-explore-category]',{exploreCategory:'space'}); await tick();
  expect(h.requests[1]?.pathname).toBe('/api/kb/discover/search');
  expect(h.requests[1]?.searchParams.get('class_id')).toBe('space');
  expect(h.panel.innerHTML).toContain('月球');
  h.click('[data-explore-node]',{exploreNode:'Q1'});
  expect(h.views).toEqual([['shorts',{targetNodeId:'Q1'}]]);
  expect(h.window.kbShortsLaunch.category).toBe('天文学');
});

test('an older category request cannot replace a newer selection', async () => {
  let resolve: Function;
  const h = setup((url: URL)=>{
    if (url.pathname.endsWith('/classes')) return rows;
    if (url.searchParams.get('class_id')==='science') return new Promise(done=>{resolve=done;});
    return {nodes:[{id:'new',name:'新分类内容'}],total:1};
  });
  await h.window.loadKnowledgeExplore();
  h.click('[data-explore-category]',{exploreCategory:'science'});
  h.click('[data-explore-category]',{exploreCategory:'space'}); await tick();
  resolve!({nodes:[{id:'old',name:'过期内容'}],total:1}); await tick();
  expect(h.panel.innerHTML).toContain('新分类内容');
  expect(h.panel.innerHTML).not.toContain('过期内容');
});

test('empty classifications show an explicit empty state', async () => {
  const h = setup(()=>[]);
  await h.window.loadKnowledgeExplore();
  expect(h.panel.innerHTML).toContain('还没有分类');
  expect(h.views).toEqual([]);
});

test('clicking a category writes the address, updates the heading, and can return to all categories',async()=>{
  const h=setup((url:URL)=>url.pathname.endsWith('/classes')?rows:{nodes:[],total:0});
  await h.window.loadKnowledgeExplore();
  expect(h.panel.innerHTML).toContain('data-explore-category="science">科学</button></h2>');
  h.click('[data-explore-category]',{exploreCategory:'space'});await tick();
  expect(new URL(h.location.href).searchParams.get('explore_category')).toBe('space');
  expect(h.panel.innerHTML).toContain('<h1>天文学</h1>');
  h.click('[data-explore-category]',{exploreCategory:''});
  expect(new URL(h.location.href).searchParams.has('explore_category')).toBe(false);
});

test('refresh restores the selected category and page while retaining application scope',async()=>{
  const h=setup((url:URL)=>url.pathname.endsWith('/classes')?rows:{nodes:[{id:'Q'+url.searchParams.get('offset'),name:'恢复内容'}],total:30},'?db=demo&explore_category=space&explore_page=2');
  await h.window.loadKnowledgeExplore();await tick();
  expect(h.requests[1]?.searchParams.get('class_id')).toBe('space');
  expect(h.requests.slice(1).map(url=>url.searchParams.get('offset'))).toEqual(['0','12']);
  expect(new URL(h.location.href).searchParams.get('db')).toBe('demo');
  expect(h.panel.innerHTML).toContain('<h1>天文学</h1>');expect(h.panel.innerHTML).toContain('恢复内容');
});

test('a deleted bookmarked category safely resets to all categories',async()=>{
  const h=setup(()=>rows,'?db=demo&explore_category=deleted&explore_page=3');
  await h.window.loadKnowledgeExplore();
  expect(new URL(h.location.href).searchParams.has('explore_category')).toBe(false);
  expect(new URL(h.location.href).searchParams.has('explore_page')).toBe(false);
  expect(h.requests).toHaveLength(1);
});


test('tag exploration restores exact tag filtering without requiring classifications', async () => {
  const h = setup((url: URL) => url.pathname.endsWith('/classes') ? [] : { nodes: [{id:'Q1',name:'Tagged knowledge'}], total:1 }, '?db=demo&explore_tag=physics');
  await h.window.loadKnowledgeExplore(); await tick();
  expect(h.requests[1]?.searchParams.get('tag')).toBe('physics');
  expect(h.requests[1]?.searchParams.get('class_id')).toBe('');
  expect(h.panel.innerHTML).toContain('#physics');
  expect(h.panel.innerHTML).toContain('Tagged knowledge');
  expect(h.location.search).toContain('explore_tag=physics');
  h.click('[data-explore-detail]', { exploreDetail:'Q1' });
  expect(h.views).toEqual([['knowledge_detail', {targetNodeId:'Q1'}]]);
  h.click('[data-explore-category]', {exploreCategory:''});
  expect(h.location.search).not.toContain('explore_tag');
});

test('bottom scroll appends knowledge, retains previous cards and stops at the total', async () => {
  const h = setup((url: URL) => url.pathname.endsWith('/classes') ? rows : {
    total: 24, nodes: Array.from({length:12}, (_, i) => ({id:`Q${Number(url.searchParams.get('offset')) + i}`, name:`知识${Number(url.searchParams.get('offset')) + i}`}))
  });
  await h.window.loadKnowledgeExplore();
  h.click('[data-explore-category]', {exploreCategory:'space'}); await tick();
  Object.assign(h.panel, {clientHeight:600,scrollHeight:1800,scrollTop:200});
  h.scroll(); await new Promise(resolve=>setTimeout(resolve,150));
  expect(h.requests).toHaveLength(2);
  h.panel.scrollTop = 1200;
  for(let i=0;i<5;i++) h.scroll();
  await new Promise(resolve=>setTimeout(resolve,150));
  expect(h.requests).toHaveLength(3);
  expect(h.requests[2]?.searchParams.get('offset')).toBe('12');
  expect(h.panel.innerHTML).toContain('知识0');
  expect(h.panel.innerHTML).toContain('知识23');
  expect(h.panel.innerHTML).toContain('已经看完全部知识');
  expect(h.panel.scrollTop).toBe(1200);
  h.scroll(); await new Promise(resolve=>setTimeout(resolve,150));
  expect(h.requests).toHaveLength(3);
});

test('failed append keeps cards and retries the same next page', async () => {
  let attempts=0;
  const h=setup((url:URL)=>{
    if(url.pathname.endsWith('/classes'))return rows;
    if(url.searchParams.get('offset')==='0')return {nodes:[{id:'first',name:'第一条'}],total:36};
    if(++attempts===1)throw Error('offline');
    return {nodes:[{id:'second',name:'第二条'}],total:36};
  });
  await h.window.loadKnowledgeExplore();
  h.click('[data-explore-category]',{exploreCategory:'space'});await tick();
  h.click('[data-explore-load-more]',{});h.click('[data-explore-load-more]',{});await tick();
  expect(attempts).toBe(1);expect(h.panel.innerHTML).toContain('第一条');
  expect(h.panel.innerHTML).toContain('offline');
  h.click('[data-explore-retry-items]',{});await tick();
  expect(h.requests.slice(-2).map(url=>url.searchParams.get('offset'))).toEqual(['12','12']);
  expect(h.panel.innerHTML).toContain('第一条');expect(h.panel.innerHTML).toContain('第二条');
});

const pagedKnowledge = (url: URL) => ({total:48,nodes:Array.from({length:12},(_,i)=>({id:`item-${Number(url.searchParams.get('offset'))+i}`,name:`Card ${Number(url.searchParams.get('offset'))+i}`}))});
const cardCount = (html: string) => (html.match(/<article class="explore-knowledge-card/g) || []).length;

test('returning from viewer or details retains all appended knowledge, DOM and scroll position', async () => {
  for (const selector of ['[data-explore-node]', '[data-explore-detail]']) {
    const h=setup((url:URL)=>url.pathname.endsWith('/classes')?rows:pagedKnowledge(url));
    await h.window.loadKnowledgeExplore();
    h.click('[data-explore-category]',{exploreCategory:'space'});await tick();
    h.click('[data-explore-load-more]',{});await tick();
    h.click('[data-explore-load-more]',{});await tick();
    expect(cardCount(h.panel.innerHTML)).toBe(36);
    h.panel.scrollTop=1234;
    h.click(selector,{exploreNode:'item-30',exploreDetail:'item-30'});
    h.window.kbViewMode=selector==='[data-explore-node]'?'shorts':'knowledge_detail';
    const html=h.panel.innerHTML, requests=h.requests.length;
    h.panel.scrollTop=0; // Hidden panels may report zero scroll offsets.
    h.window.kbViewMode='app_explore';await h.window.loadKnowledgeExplore();
    expect(h.requests).toHaveLength(requests);
    expect(h.panel.innerHTML).toBe(html);
    expect(h.panel.scrollTop).toBe(1234);
    h.click('[data-explore-load-more]',{});await tick();
    expect(h.requests.at(-1)?.searchParams.get('offset')).toBe('36');
    expect(cardCount(h.panel.innerHTML)).toBe(48);
  }
});

test('append finishing while the viewer is open is kept on return despite the older URL page', async () => {
  let resolve: Function;
  const h=setup((url:URL)=>url.pathname.endsWith('/classes')?rows:url.searchParams.get('offset')==='12'?new Promise(done=>{resolve=()=>done(pagedKnowledge(url));}):pagedKnowledge(url));
  await h.window.loadKnowledgeExplore();
  h.click('[data-explore-category]',{exploreCategory:'space'});await tick();
  h.click('[data-explore-load-more]',{});await tick();
  h.panel.scrollTop=900;
  h.click('[data-explore-node]',{exploreNode:'item-0'});h.window.kbViewMode='shorts';
  h.panel.scrollTop=0;
  resolve!();await tick();
  expect(h.location.search).not.toContain('explore_page');
  h.window.kbViewMode='app_explore';const count=h.requests.length;
  await h.window.loadKnowledgeExplore();
  expect(h.requests).toHaveLength(count);
  expect(cardCount(h.panel.innerHTML)).toBe(24);
  expect(h.panel.scrollTop).toBe(900);
  expect(h.location.search).toContain('explore_page=2');
});

test('refresh restores all pages of the infinite list including tags', async () => {
  const h=setup((url:URL)=>url.pathname.endsWith('/classes')?rows:pagedKnowledge(url),'?db=demo&explore_tag=physics&explore_page=3');
  await h.window.loadKnowledgeExplore();
  expect(h.requests.slice(1).map(url=>url.searchParams.get('offset'))).toEqual(['0','12','24']);
  expect(h.requests.slice(1).every(url=>url.searchParams.get('tag')==='physics')).toBe(true);
  expect(cardCount(h.panel.innerHTML)).toBe(36);
  expect(h.location.search).toContain('explore_page=3');
});

test('cached explore lists are invalidated by database, filter and authentication changes', async () => {
  const h=setup((url:URL)=>url.pathname.endsWith('/classes')?rows:pagedKnowledge(url),'?db=demo&explore_category=space');
  await h.window.loadKnowledgeExplore();
  const change=async(search:string)=>{h.location.search=search;h.location.href='http://localhost/kb'+search+'#app_explore';await h.window.loadKnowledgeExplore();};
  await change('?db=other&explore_category=space');
  expect(h.requests.at(-1)?.searchParams.get('db')).toBe('other');
  await change('?db=other&explore_tag=physics');
  expect(h.requests.at(-1)?.searchParams.get('tag')).toBe('physics');
  const count=h.requests.length;h.emit('kb-auth-change');await tick();await tick();
  expect(h.requests.length).toBeGreaterThan(count);
  const countAfter=h.requests.length;
  await h.window.loadKnowledgeExplore({force:true});
  expect(h.requests.length).toBeGreaterThan(countAfter);
});
