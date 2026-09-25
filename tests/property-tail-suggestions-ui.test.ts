import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../public/assets/scripts/attr-panel.js', import.meta.url), 'utf8');
function setup() {
  const status = { textContent: '' };
  const requests: { url: URL; resolve: (value: any) => void }[] = [];
  const renders: any[] = [];
  let scope = 'one';
  const start = source.indexOf('  async function loadEntitySuggestionsForProperty(');
  const end = source.indexOf('  if (typeof window !== "undefined")', start);
  const load = new Function('window', 'document', 'fetch', 'renderEntitySearchResults', 'attrEntitySearchStatus', `let entitySuggestionVersion=0, activeTailOntology=null; ${source.slice(start,end)}; return loadEntitySuggestionsForProperty;`)(
    { location: { origin: 'http://localhost' }, appendCurrentDbParam: (url: URL) => { url.searchParams.set('db', scope); return url; } },
    { getElementById: () => ({ value: 'entity/me' }) },
    (url: URL) => new Promise((resolve) => requests.push({ url, resolve: (data) => resolve({ ok: true, json: async () => data }) })),
    (items: any[]) => renders.push(items), status,
  );
  return { load, requests, renders, status, setScope: (value: string) => { scope = value; } };
}

test('property selection loads scoped recommendations immediately and reports tail ontology', async () => {
  const h = setup();
  const done = h.load('property/employer');
  expect(h.requests[0]!.url.searchParams.get('property')).toBe('property/employer');
  expect(h.requests[0]!.url.searchParams.get('entity_id')).toBe('entity/me');
  h.requests[0]!.resolve({ items: [{ id: 'org', label: '机构' }], source: 'tail_ontology', tailOntology: { name: '机构' } });
  await done;
  expect(h.status.textContent).toContain('推荐「机构」');
  expect(h.renders.at(-1)).toEqual([{ id: 'org', label: '机构' }]);
});

test('slower results from previous property or application cannot overwrite current suggestions', async () => {
  const h = setup();
  const first = h.load('old'); const second = h.load('new');
  h.requests[1]!.resolve({ items: [{ id: 'new' }] }); await second;
  h.requests[0]!.resolve({ items: [{ id: 'old' }] }); await first;
  expect(h.renders.at(-1)).toEqual([{ id: 'new' }]);
  const third = h.load('new'); h.setScope('two');
  h.requests[2]!.resolve({ items: [{ id: 'wrong-app' }] }); await third;
  expect(h.renders.at(-1)).toEqual([]);
});
