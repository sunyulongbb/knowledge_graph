import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
const source=readFileSync('public/assets/scripts/application-pages.js','utf8');
const card=source.slice(source.indexOf('  function card('),source.indexOf('  function imageCandidates('));
const helpers=source.slice(source.indexOf('  function imageCandidates('),source.indexOf('  let homeDetailDrawer'));
const render=new Function('escape','highlighted','nodeUrl','knowledgeCardTags',helpers+card+';return card;')((value:any)=>String(value??'').replace(/"/g,'&quot;'),(value:string)=>value,()=>'/detail',()=>'');
test('search results display video covers before ordinary images, including saved current frames',()=>{
  expect(render({id:'video',videos:['/clip.mp4'],images:['/photo.jpg'],covers:['/poster.jpg']})).toContain('src="/poster.jpg"');
  expect(render({id:'video',video:'/clip.mp4',covers:'["","/poster.jpg"]'})).toContain('src="/poster.jpg"');
  expect(render({id:'video',video:'/clip.mp4',cover:'data:image/jpeg;base64,frame'})).toContain('src="data:image/jpeg;base64,frame"');
});
test('search image fallback supports existing image formats and keeps unsafe sources out',()=>{
  expect(render({id:'photo',images:'[{"url":"/photo.jpg"}]'})).toContain('src="/photo.jpg"');
  expect(render({id:'video',video:'/clip.mp4',images:['/photo.jpg']})).toContain('src="/photo.jpg"');
  expect(render({id:'text',cover:'javascript:alert(1)'})).not.toContain('<img');
});
