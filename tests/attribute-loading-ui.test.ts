import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

function setup() {
  const source = readFileSync(new URL('../public/assets/scripts/attr-panel.js', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('  const attributeRequests ='), source.indexOf('  async function performLoadAttributes'));
  const network: Array<{ resolve: (value: any) => void }> = [];
  const loads: Array<{ resolve: () => void }> = [];
  const window: any = { authUser: { id: 1 }, kbAttrLoadRequestSeq: 0 };
  const location = { search: '?db=demo' };
  const fetch = () => new Promise((resolve) => network.push({ resolve }));
  const perform = () => { window.kbAttrLoadRequestSeq++; return new Promise<void>((resolve) => loads.push({ resolve })); };
  const api = new Function('window', 'location', 'fetch', 'performLoadAttributes', 'attrList', 'URLSearchParams', `${block}\nreturn { fetchAttributeData, loadAttributes };`)(window, location, fetch, perform, { removeAttribute() {} }, URLSearchParams);
  return { api, network, loads, window, location };
}

test('attribute data requests share in-flight reads but forced and subsequent reads stay fresh', async () => {
  const { api, network } = setup();
  const first = api.fetchAttributeData('/attributes?id=one');
  expect(api.fetchAttributeData('/attributes?id=one')).toBe(first);
  expect(network.length).toBe(1);
  const forced = api.fetchAttributeData('/attributes?id=one', true);
  expect(network.length).toBe(2);
  network[0]!.resolve({ ok: true, json: async () => ({ items: ['old'] }) });
  await first;
  expect(api.fetchAttributeData('/attributes?id=one')).toBe(forced);
  network[1]!.resolve({ ok: true, json: async () => ({ items: ['new'] }) });
  expect(await forced).toEqual({ items: ['new'] });
  const fresh = api.fetchAttributeData('/attributes?id=one');
  expect(network.length).toBe(3);
  network[2]!.resolve({ ok: true, json: async () => ({ items: [] }) });
  await fresh;
});

test('repeated entity loads coalesce while entity switches and forced refreshes do not', async () => {
  const { api, loads, location } = setup();
  const first = api.loadAttributes('one');
  expect(api.loadAttributes('entity/one')).toBe(first);
  location.search = '?db=demo&leftSidebar=open';
  expect(api.loadAttributes('one')).toBe(first);
  const second = api.loadAttributes('two');
  const third = api.loadAttributes('one');
  expect(loads.length).toBe(3);
  loads[0]!.resolve(); loads[1]!.resolve(); await Promise.all([first, second]);
  expect(api.loadAttributes('one')).toBe(third);
  const forced = api.loadAttributes('one', { force: true });
  expect(loads.length).toBe(4);
  loads[2]!.resolve(); loads[3]!.resolve(); await Promise.all([third, forced]);
});
