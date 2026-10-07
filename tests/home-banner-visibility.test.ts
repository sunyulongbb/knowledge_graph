import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
const source=readFileSync('public/assets/scripts/application-pages.js','utf8');
const block=source.slice(source.indexOf('  function applicationBanner()'),source.indexOf('  function applicationSidebarBrand()'));
const render=(project:any)=>new Function('homeApplication','byId','escape',block+';return applicationBanner();')(project,()=>null,(s:string)=>s);
test('home banner is absent without a usable cover and visible when configured',()=>{
 expect(render({title:'App'})).toBe('');expect(render({banner_image:'   '})).toBe('');expect(render({banner_image:'javascript:bad'})).toBe('');expect(render({banner_image:'/static/uploads/banner.jpg'})).toContain('app-home-banner-background');
});
