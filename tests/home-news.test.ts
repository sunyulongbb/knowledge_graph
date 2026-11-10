import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
const source=readFileSync('public/assets/scripts/application-pages.js','utf8');
const block=source.slice(source.indexOf('  function homeNewsTimeline('),source.indexOf('  function homePopularRow('));
const render=new Function('escape','firstImage','firstCover','firstVideo',block+';return homeNewsTimeline;')((value:any)=>String(value??''),()=>'',()=>'',()=>'');
test('news timeline groups creation dates and displays Shanghai local time',()=>{
  const html=render([{id:'a',name:'较新',created_at:'2026-11-10T17:30:00Z'},{id:'b',name:'同一天',created_at:'2026-11-10 16:00:00'},{id:'c',name:'较早',created_at:'2026-11-10T03:00:00Z'}]);
  expect((html.match(/class="home-news-day"/g)||[])).toHaveLength(2);
  expect(html).toContain('2026-11-11');expect(html).toContain('01:30');expect(html).toContain('00:00');
  expect(html.indexOf('较新')).toBeLessThan(html.indexOf('较早'));
});
test('undated knowledge is explicitly marked without inventing a date',()=>{
  const html=render([{id:'a',name:'无时间'},{id:'b',name:'无效时间',created_at:'invalid'}]);
  expect((html.match(/class="home-news-day"/g)||[])).toHaveLength(1);
  expect(html).toContain('日期未记录');expect(html).not.toContain('1970');
});
