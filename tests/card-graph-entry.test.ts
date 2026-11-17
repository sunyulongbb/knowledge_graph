import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
test('shared graph entry skips cards that already render a graph button',()=>{
 const source=readFileSync('public/assets/scripts/knowledge-relation-page.js','utf8');
 const start=source.indexOf('  function addEntries()');const end=source.indexOf("  document.addEventListener('click'",start);
 let created=0;
 const document={querySelectorAll:()=>[{querySelector:(selector:string)=>selector.includes('[data-home-card-graph]')?{}:null}],createElement:()=>{created++;}};
 new Function('document',source.slice(start,end)+';addEntries();')(document);
 expect(created).toBe(0);
});
