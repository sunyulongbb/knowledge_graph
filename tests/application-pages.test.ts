import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

function setup() {
  const source = readFileSync(new URL('../public/assets/scripts/application-pages.js', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('  const byId'), source.indexOf('  window.loadApplicationHome'));
  const requests: URL[] = [];
  const location = { href: 'https://example.test/?db=demo&leftSidebar=closed&rightSidebar=open#view=app_search', origin: 'https://example.test', search: '?db=demo&leftSidebar=closed&rightSidebar=open' };
  const fetch = async (url: URL) => { requests.push(url); return { ok: true, json: async () => ({ nodes: [], total: 0 }) }; };
  const api = new Function('document', 'location', 'fetch', `${block}; return { api, card, nodeUrl, flatten };`)({}, location, fetch);
  return { ...api, requests };
}

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
  expect(new URLSearchParams(url.hash.slice(1)).get('node')).toBe('Q1');
  expect(flatten([{ id: 'root', name: 'Root', children: [{ id: 'child', name: 'Child' }] }]).map((item: any) => item.id)).toEqual(['root', 'child']);
});
