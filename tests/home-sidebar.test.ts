import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
function clock(){let next=0;const tasks=new Map<number,Function>();return {setTimeout:(fn:Function)=>{tasks.set(++next,fn);return next;},clearTimeout:(id:number)=>tasks.delete(id),flush:()=>{const pending=[...tasks.values()];tasks.clear();pending.forEach(fn=>fn());}};}
function element(){return {title:'',attributes:{} as Record<string,string>,listeners:{} as Record<string,Function>,setAttribute(key:string,value:string){this.attributes[key]=value;},addEventListener(type:string,fn:Function){this.listeners[type]=fn;}};}
const event=(detail=1)=>({detail,preventDefault(){},stopPropagation(){}});
test('homepage logo single-click toggles persistently, double-click switches without toggling',()=>{
  const html=readFileSync('public/index.html','utf8');
  expect(html).not.toContain('id="homeSidebarToggle"');
  expect(html).toContain('aria-controls="homeDiscoverySidebar appLogoSwitcher"');
  const brand=element(),root={dataset:{} as Record<string,string>},body={dataset:{} as Record<string,string>};
  const saved=new Map([['kb:home-sidebar','expanded']]);let switched=0;const timer=clock();
  new Function('document','window','localStorage','setTimeout','clearTimeout',readFileSync('public/assets/scripts/home-sidebar.js','utf8'))(
    {documentElement:root,body,getElementById:()=>brand},{showAppLogoSwitcher:()=>{switched++;},matchMedia:()=>({matches:false,addEventListener(){}})},
    {getItem:(key:string)=>saved.get(key),setItem:(key:string,value:string)=>saved.set(key,value)},timer.setTimeout,timer.clearTimeout,
  );
  brand.listeners.click!(event());expect(root.dataset.homeSidebar).toBe('expanded');timer.flush();
  expect(root.dataset.homeSidebar).toBe('collapsed');expect(saved.get('kb:home-sidebar')).toBe('collapsed');expect(brand.attributes['aria-expanded']).toBe('false');
  brand.listeners.click!(event());brand.listeners.click!(event(2));brand.listeners.dblclick!(event(2));timer.flush();
  expect(switched).toBe(1);expect(root.dataset.homeSidebar).toBe('collapsed');
  brand.listeners.click!(event(0));expect(root.dataset.homeSidebar).toBe('expanded');
});
test('workspace logo supports the same single and double-click behavior while the name opens home',()=>{
  const source=readFileSync('public/assets/scripts/sidebar-panel.js','utf8');
  const start=source.indexOf('    // The application logo toggles on click and switches apps');
  const block=source.slice(start,source.indexOf('    // sidebar collapse/expand state',start));
  const logo=element(),name=element();let collapsed=false;const actions:string[]=[];const timer=clock();
  new Function('document','window','setTimeout','clearTimeout',block)(
    {getElementById:(id:string)=>id==='headerProjectAvatar'?logo:id==='headerProjectName'?name:{classList:{contains:()=>collapsed}}},
    {setSidebarCollapsed:(value:boolean)=>{collapsed=value;},showAppLogoSwitcher:()=>actions.push('switch'),setViewMode:(view:string)=>actions.push(view)},timer.setTimeout,timer.clearTimeout,
  );
  logo.listeners.click!(event());timer.flush();expect(collapsed).toBe(true);
  logo.listeners.click!(event());logo.listeners.click!(event(2));logo.listeners.dblclick!(event(2));timer.flush();
  expect(collapsed).toBe(true);expect(actions).toEqual(['switch']);
  logo.listeners.click!(event(0));expect(collapsed).toBe(false);
  name.listeners.click!(event());expect(actions).toEqual(['switch','app_home']);
});
