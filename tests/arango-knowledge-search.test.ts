import { expect, test, spyOn } from 'bun:test';
import { readFileSync } from 'node:fs';
import { ArangoClient, entityDocument } from '../src/server/arangodb.ts';
import { EnterpriseKnowledgeStore } from '../src/server/enterprise-knowledge.ts';
import { ArangoKnowledgeSearch } from '../src/server/arango-knowledge-search.ts';
import { createEnterpriseKnowledgeHandler } from '../src/server/routes/enterprise-knowledge.ts';

function fixture() {
  const calls: any[] = [];
  let missingView = true, fail = false;
  const document = { ...entityDocument({ id: 'one', name: '中国科学家', aliases: ['Scientist'], description: '知识内容' }), _id: 'entity/one' };
  const store = new EnterpriseKnowledgeStore(new ArangoClient({ url: 'http://arango', username: 'u', password: 'p' }, async (input, init) => {
    const path = new URL(String(input)).pathname.replace('/_db/app', ''), method = init?.method || 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ path, method, body });
    if (path === '/_api/document/knowledge_schema/definitions') return Response.json({ classes: [{ id: 'parent' }, { id: 'child', parent_id: 'parent' }], properties: [], ontologies: [{ id: 'reference', name: '实体条目' }] });
    if (path.startsWith('/_api/collection/')) return Response.json({});
    if (path === '/_api/view/knowledge_search/properties') return missingView ? Response.json({ errorNum: 1203 }, { status: 404 }) : Response.json({ links: { entity: { fields: { search_text: { analyzers: ['text_zh', 'text_en'] } } } } });
    if (path === '/_api/view') { missingView = false; return Response.json({}); }
    if (path === '/_api/cursor') {
      if (body.query.includes('UPDATE doc')) return Response.json({ result: [] });
      if (fail) return Response.json({ errorMessage: 'index offline' }, { status: 503 });
      return Response.json({ result: [document], extra: { stats: { fullCount: 7 } } });
    }
    throw new Error(`Unexpected request: ${method} ${path}`);
  }));
  return { store, calls, fail: () => { fail = true; } };
}
test('native search prepares a Chinese/English search view and joins current ACL and graph attribute values', async () => {
  const f = fixture(), search = new ArangoKnowledgeSearch(f.store);
  const result = await search.search('app', { id: 42, username: 'member', memberProjectIds: [7] }, {
    q: '科学家', limit: 20, offset: 40, classIds: ['parent', 'child'], propertyId: 'P1', propertyValue: '中国', hasImage: true, excludeTypes: ['reference'] });
  expect(result.total).toBe(7); expect(result.nodes[0]!.labels.zh.value).toBe('中国科学家');
  const configured = f.calls.find(call => call.path === '/_api/view')!.body;
  expect(configured.links.entity.fields.search_text.analyzers).toEqual(['text_zh', 'text_en']);
  const request = f.calls.filter(call => call.body.query?.includes('FOR doc IN knowledge_search'))[0].body;
  expect(request.query).toContain("PHRASE(doc.search_text, @q, 'text_zh')"); expect(request.query).toContain('BM25(doc) DESC');
  expect(request.query).toContain('LET current = DOCUMENT(doc._id)'); expect(request.query).toContain('current.visibility');
  expect(request.query).toContain('FOR edge IN link'); expect(request.query).toContain('edge.property_id == @property');
  expect(request.query).not.toContain('waitForSync');
  expect(request.bindVars).toMatchObject({ q: '科学家', classes: ['parent', 'child'], property: 'P1', value: '中国', excluded: ['reference'], offset: 40, projects: [7] });
  expect(request.options.fullCount).toBe(true);
  await search.search('app', null, { limit: 5, offset: 0, order: 'modified_desc' });
  expect(f.calls.filter(call => call.path === '/_api/view')).toHaveLength(1);
  const last = f.calls.at(-1)!.body;
  expect(last.query).toContain('SEARCH true'); expect(last.bindVars).not.toHaveProperty('q');
});

test('entity projections include searchable text for imported and edited multilingual knowledge', () => {
  const original = entityDocument({ id: 'a', name: '中文', aliases: ['English'], description: '简介' });
  expect(original.search_text).toContain('中文'); expect(original.search_text).toContain('English');
  const f = fixture();
  const changed = f.store.patch(original, { name: '新名称' }, 7, { id: 42, username: 'member' });
  expect(changed.search_text).toContain('新名称'); expect(changed.search_text).not.toContain('中文');
});

test('knowledge queries run without ES and keep subtree and hidden-type filtering; failures never switch engines', async () => {
  const previous = process.env.KNOWLEDGE_STORAGE_BACKEND; process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  try {
    const f = fixture(); let esCalls = 0;
    const handler = createEnterpriseKnowledgeHandler({ store: f.store, search: { search: () => { esCalls++; throw new Error('ES must not be used'); } } as any,
      getUser: () => null, getProject: () => ({ id: 7, name: 'app' }), canCreate: () => false });
    const url = new URL('http://local/api/kb/entity_search?db=app&q=科学家&class_id=parent&hide_entity=1');
    const response = (await handler(new Request(url), url, 'GET'))!;
    expect(response.status).toBe(200); expect(response.headers.get('X-Knowledge-Search')).toBe('arangosearch');
    expect((await response.json()).searchBackend).toBe('arangosearch'); expect(esCalls).toBe(0);
    const request = f.calls.find(call => call.body.query?.includes('FOR doc IN knowledge_search'))!.body;
    expect(request.bindVars.classes).toEqual(['parent', 'child']); expect(request.bindVars.excluded).toContain('reference');
    f.fail(); const log = spyOn(console, 'error').mockImplementation(() => {});
    try { expect((await handler(new Request(url), url, 'GET'))!.status).toBe(503); expect(esCalls).toBe(0); }
    finally { log.mockRestore(); }
    const withoutEs = createEnterpriseKnowledgeHandler({ store: f.store, getUser: () => null, getProject: () => ({ id: 7, name: 'app' }), canCreate: () => false });
    const discovery = new URL('http://local/api/kb/discover/search?db=app');
    expect((await withoutEs(new Request(discovery), discovery, 'GET'))!.status).toBe(503);
  } finally { if (previous === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND; else process.env.KNOWLEDGE_STORAGE_BACKEND = previous; }
});

test('home and standalone search use their ES endpoint while knowledge pickers retain native search', () => {
  const app = readFileSync('public/assets/scripts/application-pages.js', 'utf8');
  expect(app).not.toContain("api('/api/kb/entity_search'");
  expect(app.match(/api\('\/api\/kb\/discover\/search'/g)).toHaveLength(3);
  for (const script of ['table-panel.js', 'attr-panel.js', 'schema-panel.js', 'vis-ontology-panel.js']) {
    const source = readFileSync('public/assets/scripts/' + script, 'utf8');
    expect(source).toContain('/api/kb/entity_search'); expect(source).not.toContain('/api/kb/discover/search');
  }
});
