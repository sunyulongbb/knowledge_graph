import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync('public/assets/scripts/manual-classify.js', 'utf8');
function setup(fail = false) {
  const calls: any[] = [];
  const saveSource = source.slice(source.indexOf('  async function save('), source.indexOf('  function create()'));
  const api = async (_route: string, _params: any, body: any) => { calls.push(body); if (fail && body.class_id === 'child') throw Error('网络错误'); };
  const state = new Function('api', `let saving = false, loaded = true, changed = false, assigned = 0, index = 0, shown = 0;
    const dialog = {open:true}, refs = {status:{}}, queue = ['entity-a','entity-b'];
    const classes = [{id:'root'}, {id:'child', parent_id:'root'}, {id:'second',parent_id:'root'}];
    const selected = new Set(['child','second']); const selection = () => selected; const outcomes = new Map();
    function updateTotals() { assigned = [...outcomes.values()].filter(value => value === 'assigned').length; }
    function controls() {} async function show() { shown++; }
    ${saveSource}
    return { save, state: () => ({saving, changed, assigned, index, shown, message:refs.status.textContent}) };`)(api);
  return { ...state, calls };
}
test('manual classification saves ancestors before advancing once', async () => {
  const h = setup(); await h.save('child');
  expect(h.calls).toEqual([{entity_id:'entity-a',class_id:'root'}, {entity_id:'entity-a',class_id:'child'}, {entity_id:'entity-a',class_id:'second'}]);
  expect(h.state()).toMatchObject({assigned:1,index:1,shown:1,saving:false});
});
test('failed save keeps current entity and makes retry available', async () => {
  const h = setup(true); await h.save('child');
  expect(h.state()).toMatchObject({assigned:0,index:0,shown:0,saving:false,changed:true});
  expect(h.state().message).toContain('保存失败');
});

test('navigation preserves per-entity multi-selection without submitting it', () => {
  const selectionSource = source.slice(source.indexOf('  const selection ='), source.indexOf('  const flatten ='));
  const navSource = source.slice(source.indexOf('  function navigate('), source.indexOf('  function renderKnowledge('));
  const h = new Function(`let picks = new Map(), queue = ['a','b'],index = 0,saving = false,loading = false; const visits = []; function show(direction) { visits.push(direction); }
    ${selectionSource} ${navSource}
    return {selection,navigate,block:()=>{saving=true},state:()=>({index,visits})};`)();
  h.selection().add('class-a'); h.selection().add('class-b');
  h.navigate(1); expect(h.selection().size).toBe(0);
  h.selection().add('class-c'); h.navigate(-1);
  expect([...h.selection()]).toEqual(['class-a','class-b']);
  h.navigate(-1); expect(h.state().index).toBe(0);
  h.block(); h.navigate(1); expect(h.state().index).toBe(0);
});

test('existing classes are restored per entity and merge with unsaved multi-selection', () => {
  const restoreSource = source.slice(source.indexOf('  function restoreExistingClasses('), source.indexOf('  const flatten ='));
  const h = new Function(`const picks = new Map(), existingClasses = new Map(); ${restoreSource} return {picks,existingClasses,restore:restoreExistingClasses};`)();
  h.picks.set('a', new Set(['draft']));
  h.restore('a', [{id:'saved'}, {id:'parent'}]);
  expect([...h.picks.get('a')]).toEqual(['draft','saved','parent']);
  h.restore('b', [{id:'other'}]);
  expect([...h.picks.get('b')]).toEqual(['other']);
  expect(h.existingClasses.get('b').has('saved')).toBe(false);
  h.restore('a', [{id:'saved'}, {id:'parent'}]);
  expect(h.picks.get('a').size).toBe(3);
});
