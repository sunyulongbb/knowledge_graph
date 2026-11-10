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
  const panel: any = {setAttribute() {},innerHTML:'',scrollTop:0,addEventListener: (_: string, handler: Function) => { click = handler; }};
  const views: any[] = [], requests: URL[] = [];
  const location:any={origin:'http://localhost',search,href:'http://localhost/kb'+search+'#app_explore'};
  const window: any = {kbViewMode:'app_home',history:{state:{},replaceState:(_a:any,_b:any,url:URL)=>{location.href=url.href;location.search=url.search;}},addEventListener() {},setViewMode:(...args: any[])=>views.push(args)};
  const document = {createElement:()=>panel,getElementById:()=>({append() {}})};
  new Function('window','document','location','fetch',source)(window,document,location,async (url: URL)=>{
    requests.push(url);
    return {ok:true,json:async()=>fetcher(url)};
  });
  window.kbViewMode = 'app_explore';
  return {window,panel,views,requests,location,click:(selector: string,dataset: any)=>click!({target:{closest:(query: string)=>query===selector?{dataset}:null}})};
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
  const h=setup((url:URL)=>url.pathname.endsWith('/classes')?rows:{nodes:[{id:'Q1',name:'恢复内容'}],total:30},'?db=demo&explore_category=space&explore_page=2');
  await h.window.loadKnowledgeExplore();await tick();
  expect(h.requests[1]?.searchParams.get('class_id')).toBe('space');
  expect(h.requests[1]?.searchParams.get('offset')).toBe('12');
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
