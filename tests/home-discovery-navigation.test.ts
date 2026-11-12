import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync('public/assets/scripts/application-pages.js', 'utf8');
const block = 'function writeHomeFeedRoute() {}\n'+source.slice(source.indexOf("  byId('applicationHomePanel').addEventListener('click'"), source.indexOf('  function writeSearchRoute()'));

test('home navigation opens existing views and account/theme controls', () => {
  const views: string[] = [], clicked: string[] = [];
  let click: Function;
  const byId = (id: string) => id === 'applicationHomePanel'
    ? { addEventListener: (_: string, handler: Function) => { click = handler; } }
    : { click: () => clicked.push(id) };
  new Function('byId', 'window', block)(byId, { setViewMode: (view: string) => views.push(view), openQuickKnowledge: () => clicked.push('quick-create') });
  for (const action of ['shorts', 'app_explore', 'create', 'applications', 'account', 'theme']) {
    click!({ target: { closest: (selector: string) => selector === '[data-home-action]' ? { dataset: { homeAction: action } } : null } });
  }
  expect(views).toEqual(['shorts', 'app_explore', 'applications']);
  expect(clicked).toEqual(['quick-create', 'btnAuth', 'btnTheme']);
});

test('signed-in sidebar avatar opens profile instead of the login dialog',()=>{
  let click:Function;const views:string[]=[];
  new Function('byId','window',block)(()=>({addEventListener:(_:string,handler:Function)=>{click=handler;}}),{authUser:{id:1},setViewMode:(view:string)=>views.push(view)});
  click!({target:{closest:(selector:string)=>selector==='[data-home-action]'?{dataset:{homeAction:'account'}}:null}});
  expect(views).toEqual(['profile']);
});

test('changing home feed resets category and pagination before requesting new content', () => {
  const harness = new Function('byId', 'window', `
    let homeFeed='for-you', homeSelectedCategory='category', homeNodes=[1],homeVisibleNodes=[1],homePage=4,homeTotal=100;
    let loads=[];function syncHomeNavigation(){}function loadHomePage(page,category){loads.push([page,category,homeFeed]);}
    ${block}
    return ()=>({homeFeed,homeSelectedCategory,homePage,homeTotal,homeNodes,loads});
  `);
  let click: Function;
  const state = harness(() => ({ addEventListener: (_: string, handler: Function) => { click = handler; } }), { kbViewMode: 'app_home' });
  click!({ target: { closest: (selector: string) => selector === '[data-home-feed]' ? ({ dataset: { homeFeed: 'popular' } }) : null } });
  expect(state()).toMatchObject({homeFeed:'popular',homeSelectedCategory:'',homePage:1,homeTotal:0,homeNodes:[],loads:[[1,'','popular']]});
});

test('feed navigation from Short returns to the homepage content instead of loading behind the player', () => {
  let click: Function;
  const views: string[] = [];
  const byId = () => ({ addEventListener: (_: string, handler: Function) => { click = handler; } });
  new Function('byId', 'window', `let homeFeed='for-you'; ${block}`)(byId, {
    kbViewMode: 'shorts', setViewMode: (view: string) => views.push(view),
  });
  click!({ target: { closest: (selector: string) => selector === '[data-home-feed]' ? ({ dataset: { homeFeed: 'for-you' } }) : null } });
  expect(views).toEqual(['app_home']);
});


test('workspace menus open a new tab in the current application without changing the home view', () => {
  let click:Function;
  const opened:any[]=[];
  const views:string[]=[];
  const location={href:'http://localhost/?db=demo&view=app_home&node=Q1#view=app_home'};
  new Function('byId','window','location',block)(()=>({addEventListener:(_:string,handler:Function)=>{click=handler;}}),
    {open:(...args:any[])=>opened.push(args),setViewMode:(view:string)=>views.push(view)},location);
  for (const view of ['table','vis','applications']) {
    click!({target:{closest:(selector:string)=>selector==='[data-home-new-tab]'?{dataset:{homeAction:view}}:null}});
  }
  expect(views).toEqual([]);
  expect(opened.map(([href,target,features])=>{
    const url=new URL(href);
    expect(url.searchParams.get('db')).toBe('demo');
    expect(url.searchParams.has('node')).toBe(false);
    expect(target).toBe('_blank');
    expect(features).toBe('noopener,noreferrer');
    return new URLSearchParams(url.hash.slice(1)).get('view');
  })).toEqual(['table','vis','applications']);
});

test('sidebar shows login when signed out and profile plus logout when signed in',()=>{
  const controls:any=Object.fromEntries(['homeDiscoveryLogin','homeDiscoveryLogout','homeDiscoveryAccountButton'].map(id=>[id,{hidden:false}]));
  const window:any={authUser:null};
  const sync=new Function('byId','window',source.slice(source.indexOf('  function syncHomeAuthActions('),source.indexOf('  function syncHomeNavigation('))+';return syncHomeAuthActions;')((id:string)=>controls[id],window);
  sync();expect(controls.homeDiscoveryLogin.hidden).toBe(false);expect(controls.homeDiscoveryLogout.hidden).toBe(true);expect(controls.homeDiscoveryAccountButton.hidden).toBe(true);
  window.authUser={username:'admin'};sync();
  expect(controls.homeDiscoveryLogin.hidden).toBe(true);expect(controls.homeDiscoveryLogout.hidden).toBe(false);expect(controls.homeDiscoveryAccountButton.hidden).toBe(false);
  window.authUser=null;sync();expect(controls.homeDiscoveryLogin.hidden).toBe(false);expect(controls.homeDiscoveryLogout.hidden).toBe(true);
});

test('sidebar login and logout use the existing authentication handlers',()=>{
  let click:Function;const actions:string[]=[];
  new Function('byId','window',block)((id:string)=>id==='applicationHomePanel'?{addEventListener:(_:string,handler:Function)=>{click=handler;}}:{click:()=>actions.push(id)},{logout:()=>actions.push('logout')});
  for(const action of ['login','logout'])click!({target:{closest:(selector:string)=>selector==='[data-home-action]'?{dataset:{homeAction:action}}:null}});
  expect(actions).toEqual(['btnAuth','logout']);
});

test('clicking the current For You or Shorts menu refreshes its recommended feed',()=>{
  let click:Function;const refreshed:string[]=[];
  const window:any={kbViewMode:'app_home',loadApplicationHome:()=>refreshed.push('for-you'),refreshShortsPage:()=>refreshed.push('shorts')};
  new Function('byId','window',`let homeFeed='for-you';${block}`)(()=>({addEventListener:(_:string,handler:Function)=>{click=handler;}}),window);
  click!({target:{closest:(selector:string)=>selector==='[data-home-feed]'?{dataset:{homeFeed:'for-you'}}:null}});
  window.kbViewMode='shorts';
  click!({target:{closest:(selector:string)=>selector==='[data-home-action]'?{dataset:{homeAction:'shorts'}}:null}});
  expect(refreshed).toEqual(['for-you','shorts']);
});
