import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
const source=readFileSync('public/assets/scripts/application-pages.js','utf8');
const functions=source.slice(source.indexOf('  function readHomeFeed()'),source.indexOf('  function homeFeedOrder()'));
test('popular and news persist in the address and restore on refresh',()=>{
  for(const feed of ['popular','news']){
    const location:any={href:'http://localhost/kb?db=demo#app_home',search:'?db=demo'};
    const window={history:{state:{},replaceState:(_:any,_b:any,url:URL)=>{location.href=url.href;location.search=url.search;}}};
    const api=new Function('location','window','homeFeed',functions+';return {save:writeHomeFeedRoute,read:readHomeFeed};')(location,window,feed);
    api.save();expect(api.read()).toBe(feed);expect(new URL(location.href).searchParams.get('db')).toBe('demo');
  }
});
test('For You clears the stored feed and invalid feed values fall back safely',()=>{
  const location:any={href:'http://localhost/kb?db=demo&home_feed=popular#app_home',search:'?db=demo&home_feed=popular'};
  const window={history:{state:{},replaceState:(_:any,_b:any,url:URL)=>{location.href=url.href;location.search=url.search;}}};
  const api=new Function('location','window','homeFeed',functions+';return {save:writeHomeFeedRoute,read:readHomeFeed};')(location,window,'for-you');
  api.save();expect(api.read()).toBe('for-you');expect(new URL(location.href).searchParams.has('home_feed')).toBe(false);
  location.search='?home_feed=invalid';expect(api.read()).toBe('for-you');
});
