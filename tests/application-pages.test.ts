import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

function setup() {
  const source = readFileSync(new URL('../public/assets/scripts/application-pages.js', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('  const byId'), source.indexOf('  window.loadApplicationHome'));
  const requests: URL[] = [];
  const location = { href: 'https://example.test/?db=demo&leftSidebar=closed&rightSidebar=open#view=app_search', origin: 'https://example.test', search: '?db=demo&leftSidebar=closed&rightSidebar=open' };
  const fetch = async (url: URL) => { requests.push(url); return { ok: true, json: async () => ({ nodes: [], total: 0 }) }; };
  const api = new Function('document', 'location', 'fetch', 'window', `${block}; return { api, card, nodeUrl, flatten, groupIncomingEntities, pickHomeInspiration, setPortraitPool(nodes) { homeNodes = [{ id: 'outside' }]; homeVisibleNodes = nodes; } };`)({}, location, fetch, { addEventListener() {} });
  return { ...api, requests };
}

test('default portrait groups incoming relations by source entity and deduplicates properties', () => {
  const { groupIncomingEntities } = setup();
  const source = { id: 'A', name: '关联实体' };
  expect(groupIncomingEntities([
    { source, propertyId: 'P1', propertyName: '引用' },
    { source: { ...source, id: 'entity/A' }, propertyId: 'P1', propertyName: '引用' },
    { source, propertyId: 'P2', propertyName: '包含' },
    { source: { id: 'B' }, propertyName: '支持' },
    { source: { id: 'entity/target' }, propertyName: '自身' },
    { propertyName: '缺失来源' },
  ], 'target')).toEqual([
    { source, relations: ['引用', '包含'] },
    { source: { id: 'B' }, relations: ['支持'] },
  ]);
  expect(groupIncomingEntities(undefined, 'target')).toEqual([]);
});

test('portrait draws stay within visible results, avoid immediate repeats and never fall back on empty filters', () => {
  const h = setup();
  h.setPortraitPool([{ id: 'filtered-a' }, { id: 'filtered-b' }]);
  const first = h.pickHomeInspiration();
  expect(['filtered-a', 'filtered-b']).toContain(first.id);
  const next = h.pickHomeInspiration(true);
  expect(next.id).not.toBe(first.id);
  expect(['filtered-a', 'filtered-b']).toContain(next.id);
  h.setPortraitPool([{ id: 'only' }]);
  expect(h.pickHomeInspiration(true).id).toBe('only');
  h.setPortraitPool([]);
  expect(h.pickHomeInspiration()).toBeNull();
});

test('application search sends all advanced filters within the current application', async () => {
  const { api, requests } = setup();
  await api('/api/kb/entity_search', { q: 'hello & world', type: 'parent', property_id: 'P31', property_value: 'Q5', has_image: '1', order: 'hot', limit: 20, offset: 20 });
  expect(Object.fromEntries(requests[0].searchParams)).toEqual({ db: 'demo', q: 'hello & world', type: 'parent', property_id: 'P31', property_value: 'Q5', has_image: '1', order: 'hot', limit: '20', offset: '20' });
  await api('/api/kb/entity_search', { q: '', type: '' });
  expect(requests[1].searchParams.has('type')).toBe(false);
});

test('home and search render safe entity links and preserve application and sidebar route state', () => {
  const { card, nodeUrl, flatten } = setup();
  const node = { id: 'Q1', name: '<script>bad</script>', description: '<img onerror=bad>', image: 'javascript:bad' };
  const html = card(node);
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('src="javascript:');
  const url = new URL(nodeUrl(node));
  expect(url.searchParams.get('db')).toBe('demo');
  expect(url.searchParams.get('leftSidebar')).toBe('closed');
  const route = new URLSearchParams(url.hash.slice(1));
  expect(route.get('view')).toBe('knowledge_detail');
  expect(route.get('node')).toBe('Q1');
  expect(flatten([{ id: 'root', name: 'Root', children: [{ id: 'child', name: 'Child' }] }]).map((item: any) => item.id)).toEqual(['root', 'child']);
});
