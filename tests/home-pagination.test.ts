import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync('public/assets/scripts/application-pages.js','utf8');
function setup(api: Function, feed = 'for-you') {
  const block = source.slice(source.indexOf('  async function loadHomePage('), source.indexOf('  function renderHome('));
  const order = source.slice(source.indexOf('  function homeFeedOrder()'), source.indexOf('  function syncHomeNavigation()'));
  const appended: string[] = [];
  return new Function('api', 'homeFeed', 'window', `let homeVersion=0, homePage=1, homeTotal=0, homeBusy=false, homeError='', homeRetry={}, homeSelectedCategory='', homeNodes=[],homeVisibleNodes=[],homeFeedExhausted=false;
    const homePageSize=24; function renderHome() {} const byId=()=>({querySelector:()=>null});
    function updateHomeInfiniteStatus() {} function homeWaterfallCard(node) {return node.id;}
    ${order}
    ${block}
    return {load:loadHomePage,state:()=>({homePage,homeTotal,homeSelectedCategory,homeNodes,homeBusy,homeError}),appended:window.appended};`)(api, feed, {appended,homeWaterfall:{append:(html: string)=>appended.push(html)}});
}

test('popular and news request server sorting on every page', async () => {
  for (const [feed, order] of [['popular', 'popular'], ['news', 'created_desc']]) {
    const calls: any[] = [];
    const h = setup(async (_: string, params: any) => { calls.push(params); return { total: 50, nodes: [] }; }, feed);
    await h.load(2);
    expect(calls[0]).toMatchObject({ order, offset: 24, limit: 24 });
  }
});
test('home pagination passes category and offset and clamps pages after data removal', async () => {
  const calls: any[]=[];
  const h=setup(async (_: string,p:any)=>{calls.push(p);return {total:25,nodes:[{id:'last'}]};});
  await h.load(3,'category-a');
  expect(calls.map(p=>p.offset)).toEqual([48,24]);
  expect(calls[1]).toMatchObject({order:'richness',limit:24,class_id:'category-a',defined_class_only:'1'});
  expect(h.state()).toMatchObject({homePage:2,homeTotal:25,homeSelectedCategory:'category-a',homeBusy:false});
});
test('newer category request wins and failed request retains visible knowledge', async () => {
  let first: Function;
  const h=setup(async (_:string,p:any)=>{if(p.class_id==='old') return new Promise(r=>first=r);if(p.class_id==='fail') throw Error('加载失败');return {total:1,nodes:[{id:'new'}]};});
  const stale=h.load(1,'old');await h.load(1,'new');first!({total:90,nodes:[{id:'old'}]});await stale;
  expect(h.state().homeNodes).toEqual([{id:'new'}]);
  await h.load(2,'fail');
  expect(h.state()).toMatchObject({homeSelectedCategory:'new',homePage:1,homeError:'加载失败',homeNodes:[{id:'new'}]});
});

test('infinite scrolling appends unique cards and keeps the previous content', async () => {
  const h = setup(async (_:string,p:any)=>({total:72,nodes:p.offset===0?[{id:'one'},{id:'two'}]:[{id:'two'},{id:'three'}]}));
  await h.load(1);
  await h.load(2,'',true);
  expect(h.state().homeNodes.map((node:any)=>node.id)).toEqual(['one','two','three']);
  expect(h.appended).toEqual(['three']);
  expect(h.state().homePage).toBe(2);
});

test('only one next-page request runs at a time and a failed append can be retried', async () => {
  let resolve:Function; let attempts=0;
  const h=setup(async (_:string,p:any)=>{
    if(!p.offset)return {total:72,nodes:[{id:'one'}]};
    attempts++;
    if(attempts===1)return new Promise(done=>{resolve=done;});
    if(attempts===2)throw Error('offline');
    return {total:72,nodes:[{id:'three'}]};
  });
  await h.load(1);
  const pending=h.load(2,'',true);await h.load(2,'',true);
  expect(attempts).toBe(1);
  resolve!({total:72,nodes:[{id:'two'}]});await pending;
  await h.load(3,'',true);
  expect(h.state().homePage).toBe(2);
  expect(h.state().homeNodes.map((node:any)=>node.id)).toEqual(['one','two']);
  await h.load(3,'',true);
  expect(h.state().homeNodes.map((node:any)=>node.id)).toEqual(['one','two','three']);
});
