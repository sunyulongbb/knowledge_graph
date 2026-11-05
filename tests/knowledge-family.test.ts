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

test('family cards emphasize media and names without rendering relationship information', async () => {
  const r = runtime();
  r.window.knowledgeFamily.draw(r.host, [{ node: { id: 'one', name: 'One', type: 'god', typeLabel: 'God', images: ['/photo.png'], videos: ['/video.mp4'] }, relations: [{ node: { id: 'relative' }, propertyId: 'P40' }] }]);
  const nodes = all(r.host);
  expect(nodes.some(node => node.tag === 'h2' && node.textContent === 'God')).toBe(true);
  expect(nodes.some(node => node.tag === 'img')).toBe(true);
  expect(nodes.some(node => node.className === 'knowledge-family-video-badge')).toBe(true);
  expect(nodes.some(node => node.className === 'knowledge-family-relations')).toBe(false);
  nodes.find(node => node.className === 'knowledge-family-media')!.events.click!();
  expect(r.opened[0]).toEqual(['detail', { targetNodeId: 'one' }]);
  nodes.find(node => node.className === 'knowledge-family-name')!.events.click!();
  expect(r.opened[1]).toEqual(['detail', { targetNodeId: 'one' }]);
  r.window.knowledgeFamily.draw(r.host, [{ node: { id: 'empty', name: '<img onerror=bad>' } }]);
  expect(all(r.host).some(node => node.tag === 'img')).toBe(false);
  expect(all(r.host).some(node => node.className === 'knowledge-family-media')).toBe(false);
  expect(all(r.host).some(node => node.className.includes('knowledge-family-card-text'))).toBe(true);
});

test('family loader uses knowledge directly and ignores stale searches after switching modes', async () => {
  const requests: any[] = [];
  const r = runtime((...args: any[]) => { requests.push(args); });
  await r.window.renderKnowledgeFamily([{ id: 'one' }]);
  expect(requests).toHaveLength(0);
  let resolve: any;
  const stale = runtime(() => new Promise(done => { resolve = done; }));
  const pending = stale.window.renderKnowledgeFamily({});
  stale.window.knowledgeFamily.cancel(); stale.window.kbTableLayoutMode = 'list';
  resolve({ ok: true, json: async () => ({ total: 1, nodes: [{ id: 'stale', name: 'Stale content' }] }) });
  await pending;
  expect(all(stale.host).some(node => node.textContent === 'Stale content')).toBe(false);
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


test('family loads the complete filtered dataset independently of the table page and groups by ontology ancestry', async () => {
  const offsets: string[] = [], batches: number[] = [];
  const r = runtime(async (url: URL, init: RequestInit) => {
    if (url.pathname.endsWith('entity_search')) {
      offsets.push(url.searchParams.get('offset')!);
      expect(url.searchParams.get('class_id')).toBe('selected');
      expect(url.searchParams.get('q')).toBe('filter');
      const offset = Number(url.searchParams.get('offset'));
      return { ok: true, json: async () => ({ total: 501, nodes: Array.from({ length: offset ? 1 : 500 }, (_, i) => ({ id: String(offset + i), name: String(offset + i), type: 'child', categoryLabels: ['Category'] })) }) };
    }
    if (url.pathname.endsWith('ontology/tree')) return { ok: true, json: async () => ({ flat: [{ id: 'root', name: 'Root' }, { id: 'child', name: 'Child', parent_id: 'root' }] }) };
    const ids = JSON.parse(String(init.body)).ids;
    batches.push(ids.length);
    return { ok: true, json: async () => ({ items: ids.map((id: string) => ({ node: { id, name: id, type: 'child', categoryLabels: ['Category'] }, relations: [] })) }) };
  });
  await r.window.renderKnowledgeFamily({ offset: '48', limit: '24', class_id: 'selected', q: 'filter' });
  expect(offsets).toEqual(['0', '500']);
  expect(batches).toEqual([]);
  expect(all(r.host).filter(node => node.className.split(' ').includes('knowledge-family-card'))).toHaveLength(501);
  expect(all(r.host).some(node => node.tag === 'h2' && node.textContent === 'Root / Child')).toBe(true);
  expect(all(r.host).some(node => node.className === 'knowledge-family-category' && node.textContent === 'Category')).toBe(true);
});
