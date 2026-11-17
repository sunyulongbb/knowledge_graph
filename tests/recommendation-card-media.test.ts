import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
const source=readFileSync('public/assets/scripts/application-pages.js','utf8');
const card=source.slice(source.indexOf('  function homeWaterfallCard('),source.indexOf('  function homeKnowledgeCard('));
function render(db:string,node:any,index=0){
 return new Function('window','escape','firstImage','firstVideo','firstCover','knowledgeCardTags',card+';return homeWaterfallCard;')(
  {getCurrentDbParam:()=>db},(value:any)=>String(value),(row:any)=>row.image || '',(row:any)=>row.video || '',()=>'',()=>'',
 )(node,index);
}
test('recommendation cards prioritize the first images without preloading entire videos',()=>{
 const node={id:'Q1',name:'Example',image:'/image.png',owner_name:'Owner'};
 expect(render('default',node)).toContain('loading="eager" decoding="async"');
 expect(render('default',node)).toContain('fetchpriority="high"');
 expect(render('default',node,6)).toContain('loading="lazy"');
 const immediate=render('project_example',node);
 expect(immediate).toContain('loading="eager" decoding="auto"');
 expect(immediate).not.toContain('for-you-avatar');
 expect(render('project_example',node,6)).toContain('loading="lazy"');
 expect(immediate).not.toContain('preload="auto"');
 expect(render('project_example',{id:'Q1',name:'Video',video:'/video.mp4'})).toContain('preload="metadata"');
});
