import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
test('same-view type navigation reloads the requested type instead of returning silently',()=>{
 const html=readFileSync('public/index.html','utf8');
 const start=html.indexOf('      if (kbViewModeInitialized && previousMode === normalized) {');
 const end=html.indexOf("        if (normalized === 'knowledge_graph')",start);
 const branch=html.slice(start,end)+'}';
 for(const normalized of ['joined_type','app_explore']){
  let calls=0;
  new Function('window','normalized','previousMode','kbViewModeInitialized',branch)({loadKnowledgeExplore:()=>calls++},normalized,normalized,true);
  expect(calls).toBe(1);
 }
});
