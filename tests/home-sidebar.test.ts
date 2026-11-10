import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

test('brand toggles the sidebar, persists state and never delegates navigation', () => {
  const html = readFileSync('public/index.html', 'utf8');
  const markup = html.match(/<button[^>]*id="homeSidebarBrandToggle"[^>]*>/)?.[0];
  expect(markup).toBeDefined();
  expect(markup).not.toContain('data-home-action');
  expect(html).not.toContain('id="homeSidebarToggle"');
  const element = () => ({ title:'', attributes:{} as Record<string,string>, click:null as any,
    setAttribute(key:string,value:string) { this.attributes[key]=value; },
    addEventListener(_type:string,handler:any) { this.click=handler; } });
  const brand=element(), button=element();
  const root={dataset:{} as Record<string,string>}, body={dataset:{} as Record<string,string>};
  const saved=new Map([['kb:home-sidebar','expanded']]);
  const document={documentElement:root,body,getElementById:(id:string)=>id==='homeSidebarToggle'?button:brand};
  const window={matchMedia:()=>({matches:false,addEventListener() {}})};
  const localStorage={getItem:(key:string)=>saved.get(key),setItem:(key:string,value:string)=>saved.set(key,value)};
  new Function('document','window','localStorage',readFileSync('public/assets/scripts/home-sidebar.js','utf8'))(document,window,localStorage);
  let stopped=0;
  brand.click({preventDefault() {},stopPropagation() { stopped++; }});
  expect(root.dataset.homeSidebar).toBe('collapsed');
  expect(saved.get('kb:home-sidebar')).toBe('collapsed');
  expect(brand.attributes['aria-expanded']).toBe('false');
  brand.click({preventDefault() {},stopPropagation() { stopped++; }});
  expect(root.dataset.homeSidebar).toBe('expanded');
  expect(stopped).toBe(2);
});
