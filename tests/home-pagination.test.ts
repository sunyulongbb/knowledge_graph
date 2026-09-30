import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync('public/assets/scripts/application-pages.js','utf8');
function setup(api: Function) {
  const block = source.slice(source.indexOf('  async function loadHomePage('), source.indexOf('  function renderHome('));
  return new Function('api', `let homeVersion=0, homePage=1, homeTotal=0, homeBusy=false, homeError='', homeRetry={}, homeSelectedCategory='', homeNodes=[],homeVisibleNodes=[];
    const homePageSize=24; function renderHome() {} const byId=()=>({querySelector:()=>null});
    ${block}
    return {load:loadHomePage,state:()=>({homePage,homeTotal,homeSelectedCategory,homeNodes,homeBusy,homeError})};`)(api);
}
test('home pagination passes category and offset and clamps pages after data removal', async () => {
  const calls: any[]=[];
  const h=setup(async (_: string,p:any)=>{calls.push(p);return {total:25,nodes:[{id:'last'}]};});
  await h.load(3,'category-a');
  expect(calls.map(p=>p.offset)).toEqual([48,24]);
  expect(calls[1]).toMatchObject({limit:24,class_id:'category-a',defined_class_only:'1'});
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
