import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { EnterpriseKnowledgeStore } from '../src/server/enterprise-knowledge.ts';
import { ArangoClient, entityDocument } from '../src/server/arangodb.ts';
import { createEnterpriseKnowledgeHandler } from '../src/server/routes/enterprise-knowledge.ts';

class Element {
  children: Element[] = []; className = ''; textContent = ''; hidden = false; attrs: Record<string, string> = {}; events: Record<string, Function> = {};
  constructor(public tag: string) {}
  append(...nodes: Element[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: Element[]) { this.children = nodes; }
  setAttribute(key: string, value: string) { this.attrs[key] = value; }
  addEventListener(key: string, value: Function) { this.events[key] = value; }
  scrollIntoView() {}
}
const all = (root: Element): Element[] => [root, ...root.children.flatMap(all)];
function runtime(fetch: any = () => {}) {
  const host = new Element('div'), opened: any[] = [];
  const window: any = { kbTableLayoutMode: 'family', setViewMode: (...args: any[]) => opened.push(args) };
  const document = { createElement: (tag: string) => new Element(tag), getElementById: () => host };
  new Function('window', 'document', 'location', 'fetch', readFileSync('public/assets/scripts/knowledge-family.js', 'utf8'))(window, document, { origin: 'http://local', search: '?db=app' }, fetch);
  return { window, host, opened };
}

test('family semantics respect relationship direction and leave unrelated predicates generic', () => {
  const { window } = runtime(), kind = window.knowledgeFamily.kind;
  expect(kind({ propertyId: 'P22', direction: 'outgoing' })).toBe('parents');
  expect(kind({ propertyName: '母亲', direction: 'incoming' })).toBe('children');
  expect(kind({ propertyId: 'P40', direction: 'outgoing' })).toBe('children');
  expect(kind({ propertyName: '子女', direction: 'incoming' })).toBe('parents');
  expect(kind({ propertyId: 'P26', direction: 'incoming' })).toBe('partners');
  expect(kind({ propertyName: '父亲的新闻', direction: 'outgoing' })).toBe('other');
});

test('family cards group real types, deduplicate relatives, fold long lists and safely navigate', () => {
  const r = runtime();
  const children = Array.from({ length: 9 }, (_, index) => ({ node: { id: `child${index}`, name: `子女${index}` }, propertyId: 'P40', propertyName: '子女', direction: 'outgoing' }));
  r.window.knowledgeFamily.draw(r.host, [{ node: { id: 'zeus', name: '<img onerror=bad>', type: 'god', typeLabel: '奥林匹斯神', description: '简介' }, relations: [...children, children[0], { node: { id: 'place', name: '奥林匹斯山' }, propertyName: '居住地', propertyId: 'location', direction: 'outgoing' }] }]);
  const nodes = all(r.host);
  expect(nodes.some(node => node.tag === 'h2' && node.textContent === '奥林匹斯神')).toBe(true);
  expect(nodes.some(node => node.tag === 'h4' && node.textContent === '后代 · 9')).toBe(true);
  expect(nodes.some(node => node.tag === 'h4' && node.textContent === '其他关联 · 1')).toBe(true);
  expect(nodes.some(node => node.tag === 'img')).toBe(false);
  const chips = nodes.filter(node => node.className === 'knowledge-family-chip');
  expect(chips.filter(node => node.hidden)).toHaveLength(1);
  nodes.find(node => node.className === 'knowledge-family-more')!.events.click!();
  expect(chips.some(node => node.hidden)).toBe(false);
  chips[0]!.events.click!(); expect(r.opened[0][1].targetNodeId).toBe('child0');
});

test('family loader batches all page entities and ignores stale responses after a mode switch', async () => {
  const requests: any[] = [];
  const r = runtime(async (url: URL, init: RequestInit) => {
    requests.push({ url, body: JSON.parse(String(init.body)) });
    return { ok: true, json: async () => ({ items: [] }) };
  });
  await r.window.renderKnowledgeFamily(Array.from({ length: 105 }, (_, index) => ({ id: `id${index}` })));
  expect(requests.map(request => request.body.ids.length)).toEqual([100, 5]);
  expect(requests.every(request => request.url.searchParams.get('db') === 'app')).toBe(true);
  let resolve: any;
  const stale = runtime(() => new Promise(done => { resolve = done; }));
  const pending = stale.window.renderKnowledgeFamily([{ id: 'one' }]);
  stale.window.knowledgeFamily.cancel(); stale.window.kbTableLayoutMode = 'list';
  resolve({ ok: true, json: async () => ({ items: [{ node: { id: 'stale', name: '过期内容' }, relations: [] }] }) });
  await pending;
  expect(all(stale.host).some(node => node.textContent === '过期内容')).toBe(false);
});

test('Arango relationship cards use bounded adjacency traversal and filter both roots and neighbors', async () => {
  const visible = { id: 'one', _id: 'entity/one', visibility: 'public' }, hidden = { id: 'hidden', visibility: 'private', owner_user_id: 99 };
  let query: any;
  const store = new EnterpriseKnowledgeStore(new ArangoClient({ url: 'http://arango', username: 'u', password: 'p' }, async (_url, init) => {
    query = JSON.parse(String(init?.body));
    return Response.json({ result: [{ node: visible, relations: [{ node: hidden, edge: {} }, { node: visible, edge: {} }] }, { node: hidden, relations: [] }] });
  }));
  const rows = await store.relationshipCards('app', ['one'], null);
  expect(rows).toHaveLength(1); expect(rows[0]!.relations).toHaveLength(1);
  expect(query.query).toContain('1..1 ANY doc._id link'); expect(query.query).toContain('LIMIT 41');
  expect(query.query).toContain('doc.visibility'); expect(query.query).toContain('neighbor.visibility');
});

test('batch relationship endpoint formats actual direction and validates IDs before graph access', async () => {
  const previous = process.env.KNOWLEDGE_STORAGE_BACKEND; process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  try {
    let reads = 0;
    const root = { ...entityDocument({ id: 'child', name: '孩子' }), _id: 'entity/child' }, parent = entityDocument({ id: 'parent', name: '父亲' });
    const handler = createEnterpriseKnowledgeHandler({ store: { ensure: async () => {}, relationshipCards: async () => { reads++; return [{ node: root, truncated: false, relations: [{ node: parent, edge: { _from: root._id, property_id: 'P22', property_name: '父亲' } }] }]; } } as any,
      getProject: () => ({ id: 7, name: 'app' }), getUser: () => null, canCreate: () => false });
    const url = new URL('http://local/api/kb/entity/relationships?db=app');
    const run = (ids: unknown) => handler(new Request(url, { method: 'POST', body: JSON.stringify({ ids }) }), url, 'POST');
    const response = (await run(['child']))!;
    expect(response.status).toBe(200); expect((await response.json()).items[0].relations[0]).toMatchObject({ node: { id: 'parent' }, propertyId: 'P22', direction: 'outgoing' });
    for (const ids of [null, [''], [1], Array.from({ length: 101 }, () => 'one')]) expect((await run(ids))!.status).toBe(400);
    expect(reads).toBe(1);
  } finally { if (previous === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND; else process.env.KNOWLEDGE_STORAGE_BACKEND = previous; }
});
