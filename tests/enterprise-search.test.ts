import { expect, test } from 'bun:test';
import { ArangoClient, ElasticsearchClient } from '../src/server/arangodb.ts';
import { EnterpriseKnowledgeStore } from '../src/server/enterprise-knowledge.ts';
import { EnterpriseKnowledgeSearch, buildEnterpriseSearchQuery, entitySearchProjection } from '../src/server/enterprise-search.ts';
import { createEnterpriseKnowledgeHandler } from '../src/server/routes/enterprise-knowledge.ts';
import { hiddenKnowledgeTypes } from '../src/server/ontology-filter.ts';
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const owner = { id: 42, username: 'owner' };

test('discovery supports bounded fuzzy matching, phrase/all/any modes and advanced filters without changing ACL', () => {
  const options = { q: 'scientsit', limit: 20, offset: 0, searchScope: 'name', excludeQuery: '排除', updatedFrom: '2026-10-01', updatedTo: '2026-10-30', includeTypes: ['parent', 'child'] };
  const fuzzy = buildEnterpriseSearchQuery(options, ['allowed']);
  expect(fuzzy.bool.filter).toContainEqual({ ids: { values: ['allowed'] } });
  expect(fuzzy.bool.filter).toContainEqual({ terms: { type: ['parent', 'child'] } });
  expect(fuzzy.bool.filter).toContainEqual({ range: { updated_at_sort: { gte: '2026-10-01T00:00:00.000Z', lte: '2026-10-30T23:59:59.999Z' } } });
  const clauses = fuzzy.bool.must[0].bool.should;
  expect(clauses[1].multi_match).toMatchObject({ fuzziness: 'AUTO', prefix_length: 1, max_expansions: 30 });
  expect(clauses[1].multi_match.fields).not.toContain('descriptions.*.value');
  expect(clauses[2].multi_match.type).toBe('bool_prefix');
  expect(fuzzy.bool.must_not[0].multi_match.query).toBe('排除');
  for (const mode of ['phrase', 'all', 'any']) {
    const query = buildEnterpriseSearchQuery({ ...options, matchMode: mode }, ['allowed']);
    expect(query.bool.must[0].multi_match.type).toBe(mode === 'phrase' ? 'phrase' : 'best_fields');
    expect(query.bool.must[0].multi_match).not.toHaveProperty('fuzziness');
  }
});

test('ES match fragments are requested with neutral markers and returned separately from source content', async () => {
  let request: any;
  const search = new EnterpriseKnowledgeSearch({ searchAccess: async () => [{ key: 'allowed', can_edit: false, can_manage: false }] } as any,
    new ElasticsearchClient({ url: 'http://es' }, async (_input, init) => {
      request = JSON.parse(String(init?.body));
      return reply({ hits: { total: { value: 1 }, hits: [{ _id: 'allowed', _source: { id: 'Q1', description: '原始内容' },
        highlight: { 'labels.zh.value': ['\uE000科学家\uE001'], 'descriptions.zh.value': ['<img onerror=bad>\uE000科学\uE001'], 'aliases.en.value': ['\uE000Scientist\uE001'] } }] } });
    }));
  const result = await search.search('app', owner, { q: '科学家', limit: 20, offset: 0 });
  expect(request.highlight.pre_tags).toEqual(['\uE000']); expect(request.highlight.post_tags).toEqual(['\uE001']);
  expect(result.nodes[0]!.description).toBe('原始内容');
  expect(result.nodes[0]!.searchHighlights).toMatchObject({ name: ['\uE000科学家\uE001'], aliases: ['\uE000Scientist\uE001'] });
});

test('discovery resolves ontology descendants and property names and rejects invalid date filters', async () => {
  const previous = process.env.KNOWLEDGE_STORAGE_BACKEND; process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  try {
    let options: any;
    const handler = createEnterpriseKnowledgeHandler({ store: { ensure: async () => {}, importSchema: async () => ({ classes: [], ontologies: [{ id: 'parent' }, { id: 'child', parent_id: 'parent' }], properties: [{ id: 'P1', name: '职业' }] }) } as any,
      search: { search: async (_db: string, _user: any, value: any) => { options = value; return { nodes: [], total: 0 }; } } as any,
      getUser: () => owner, getProject: () => ({ id: 7, name: 'app' }), canCreate: () => true });
    const url = new URL('http://local/api/kb/discover/search?db=app&type=parent&property_id=' + encodeURIComponent('职业') + '&match_mode=phrase&search_scope=name&exclude_q=bad');
    expect((await handler(new Request(url), url, 'GET'))!.status).toBe(200);
    expect(options).toMatchObject({ type: null, includeTypes: ['parent', 'child'], propertyId: 'P1', matchMode: 'phrase', searchScope: 'name', excludeQuery: 'bad' });
    for (const dates of ['updated_from=2026-02-31', 'updated_from=2026-10-30&updated_to=2026-10-01']) {
      const invalid = new URL('http://local/api/kb/discover/search?db=app&' + dates);
      expect((await handler(new Request(invalid), invalid, 'GET'))!.status).toBe(400);
    }
  } finally { if (previous === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND; else process.env.KNOWLEDGE_STORAGE_BACKEND = previous; }
});

test('discovery search uses ES relevance while home can explicitly keep latest-update ordering', async () => {
  const requests: any[] = [];
  const store = { searchAccess: async () => [{ key: 'allowed', can_edit: true, can_manage: true }] } as any;
  const es = new ElasticsearchClient({ url: 'http://es' }, async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return reply({ hits: { total: { value: 0 }, hits: [] } });
  });
  const search = new EnterpriseKnowledgeSearch(store, es);
  await search.search('app', owner, { q: '科学家', limit: 20, offset: 0, order: 'relevance' });
  expect(requests[0].sort[0]).toEqual({ _score: 'desc' });
  await search.search('app', owner, { q: '科学家', limit: 20, offset: 0, order: 'modified_desc' });
  expect(requests[1].sort[0]).toHaveProperty('updated_at_sort');
});

test('knowledge list hidden types include imported IDs, legacy aliases and default IDs without hiding ordinary types', () => {
  const hidden = hiddenKnowledgeTypes([
    { id: 'imported-item', name: '实体条目' },
    { id: 'alias-item', name: '引用', alias: '["Wikibase Item"]' },
    { id: 'array-item', name: '引用', alias: ['实体条目'] },
    { id: 'legacy-item', name: '引用', description: '由实体导入中的 wikibase-item 属性值自动创建' },
    { id: 'ordinary', name: '人物' },
  ]);
  for (const id of ['imported-item', 'alias-item', 'array-item', 'legacy-item', 'ontology/wikibase-item', '实体条目']) expect(hidden).toContain(id);
  expect(hidden).not.toContain('ordinary');
});

test('discovery excludes item types in the ES query when requested', async () => {
  const before = process.env.KNOWLEDGE_STORAGE_BACKEND;
  process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  try {
    const queries: any[] = [];
    const store = { ensure: async () => {}, importSchema: async () => ({ classes: [], properties: [], ontologies: [{ id: 'imported-item', name: '实体条目' }] }),
      searchAccess: async () => [{ key: 'allowed', can_edit: true, can_manage: true }] } as any;
    const es = new ElasticsearchClient({ url: 'http://es' }, async (_input, init) => {
      const query = JSON.parse(String(init?.body)).query;
      queries.push(query);
      return reply({ hits: { total: { value: query.bool.must_not ? 0 : 1 }, hits: [] } });
    });
    const handler = createEnterpriseKnowledgeHandler({ store, search: new EnterpriseKnowledgeSearch(store, es),
      getUser: () => owner, getProject: () => ({ id: 7, name: 'app' }), canCreate: () => true });
    for (const flag of ['1', 'true', '']) {
      const url = new URL('http://local/api/kb/discover/search?db=app&hide_entity=' + flag);
      const response = (await handler(new Request(url), url, 'GET'))!;
      expect(response.status).toBe(200);
      expect((await response.json()).total).toBe(flag ? 0 : 1);
      if (flag) expect(queries.at(-1).bool.must_not[0].terms.type).toContain('imported-item');
      else expect(queries.at(-1).bool.must_not).toBeUndefined();
    }
  } finally { if (before === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND; else process.env.KNOWLEDGE_STORAGE_BACKEND = before; }
});

test('ES predicates preserve category/media/type filters and keep property and value in one nested attribute', () => {
  const query = buildEnterpriseSearchQuery({ limit: 20, offset: 0, q: '知识', classIds: ['class/a'], definedTypes: ['Thing'], hasMedia: true, propertyId: 'P2', propertyValue: 'A*B?' }, ['allowed']);
  const filter = query.bool.filter;
  expect(filter).toContainEqual({ ids: { values: ['allowed'] } });
  expect(filter).toContainEqual({ terms: { class_ids: ['class/a'] } });
  expect(filter).toContainEqual({ term: { has_media: true } });
  const nested = filter.find((part: any) => part.nested).nested;
  expect(nested.query.bool.filter).toContainEqual({ term: { 'search_attributes.property_id': 'P2' } });
  expect(nested.query.bool.filter[1].wildcard['search_attributes.value_text'].value).toBe('*A\\*B\\?*');
  expect(buildEnterpriseSearchQuery({ limit: 20, offset: 0 }, [])).toEqual({ match_none: {} });
});
test('search content comes only from ES while current Arango ACL excludes stale deleted/private copies', async () => {
  const aql: any[] = [], queries: any[] = [];
  const store = new EnterpriseKnowledgeStore(new ArangoClient({ url: 'http://arango', username: 'u', password: 'p' }, async (input, init) => {
    aql.push(JSON.parse(String(init?.body)));
    return reply({ result: [{ _key: 'allowed', id: 'Q1', owner_user_id: 42, visibility: 'public', project_id: 7 }] });
  }));
  const es = new ElasticsearchClient({ url: 'http://es' }, async (input, init) => {
    queries.push(JSON.parse(String(init?.body)));
    return reply({ hits: { total: { value: 1 }, hits: [{ _id: 'allowed', _source: { id: 'Q1', labels: { zh: { value: 'ES中的知识内容' } }, owner_user_id: 99 } }] } });
  });
  const result = await new EnterpriseKnowledgeSearch(store, es).search('app', owner, { limit: 20, offset: 0 });
  expect(result.nodes[0]?.labels.zh.value).toBe('ES中的知识内容');
  expect(result.nodes[0]?._current_permissions.can_edit).toBe(true);
  expect(result.total).toBe(1);
  expect(queries[0].query.bool.filter[0]).toEqual({ ids: { values: ['allowed'] } });
  expect(aql).toHaveLength(1);
  expect(aql[0].query).not.toContain('doc.labels');
  expect(aql[0].query).not.toContain('CONTAINS');
});
test('link changes invalidate the ES projection even when the entity revision is unchanged', () => {
  const source = { _key: 'key', _rev: 'same', images: '[]', videos: '["/video.mp4"]', _search_attributes: [{ property_id: 'P2', value_text: 'before', revision: 'old' }] };
  const first = entitySearchProjection(source);
  const next = entitySearchProjection({ ...source, _search_attributes: [{ property_id: 'P2', value_text: 'after', revision: 'new' }] });
  expect(first._search_revision).not.toBe(next._search_revision);
  expect(first.has_media).toBe(true);
  expect(first.has_images).toBe(false);
  expect(next.search_attributes).toEqual([{ property_id: 'P2', value_text: 'after' }]);
  expect(first).not.toHaveProperty('_id');
});
test('deep ES paging uses PIT/search_after and preserves total hits', async () => {
  const store = { searchAccess: async () => [{ key: 'allowed', can_edit: false, can_manage: false }] } as any;
  const requests: any[] = [];
  let reads = 0;
  const es = new ElasticsearchClient({ url: 'http://es' }, async (input, init) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    requests.push({ path: url.pathname, body });
    if (url.pathname.endsWith('/_pit') && init?.method === 'POST') return reply({ id: 'pit' });
    if (url.pathname === '/_search') {
      reads++;
      // Ten full skipped pages + one skipped hit followed by the requested page.
      return reply({ hits: { total: { value: 10003 }, hits: reads <= 10 ? Array.from({ length: 1000 }, (_, i) => ({ sort: [reads * 1000 + i] })) : reads === 11 ? [{ sort: [10001] }] : [{ _id: 'allowed', _source: { id: 'Q1' }, sort: [10002] }] } });
    }
    return reply({});
  });
  const result = await new EnterpriseKnowledgeSearch(store, es).search('app', null, { limit: 1, offset: 10001 });
  expect(result.total).toBe(10003);
  expect(result.nodes[0]?.id).toBe('Q1');
  expect(requests.some(request => request.body.search_after)).toBe(true);
  expect(requests.at(-1).path).toBe('/_pit');
});
test('home/discovery endpoint reports ES and returns 503 on ES failure without an Arango list fallback', async () => {
  const before = process.env.KNOWLEDGE_STORAGE_BACKEND;
  process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  try {
    const store = { ensure: async () => {}, list: () => { throw new Error('Arango list must not be called'); } } as any;
    let fail = false;
    const search = { search: async () => { if (fail) throw new Error('ES offline'); return { nodes: [{ id: 'Q1', labels: { zh: { value: 'ES结果' } } }], total: 1 }; } } as any;
    const handler = createEnterpriseKnowledgeHandler({ store, search, getUser: () => owner, getProject: () => ({ name: 'app', id: 7 }), canCreate: () => true });
    const url = new URL('http://localhost/api/kb/discover/search?db=app');
    const ok = await handler(new Request(url), url, 'GET');
    expect(ok?.headers.get('X-Knowledge-Search')).toBe('elasticsearch');
    expect((await ok!.json()).searchBackend).toBe('elasticsearch');
    fail = true;
    const originalError = console.error;
    console.error = () => {};
    try { expect((await handler(new Request(url), url, 'GET'))?.status).toBe(503); }
    finally { console.error = originalError; }
  } finally { if (before === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND; else process.env.KNOWLEDGE_STORAGE_BACKEND = before; }
});

test('writes commit to Arango first and ES failure leaves a successful save marked pending', async () => {
  const mode = process.env.KNOWLEDGE_STORAGE_BACKEND;
  process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  try {
    const steps: string[] = [];
    const node = { id: 'Q1', sqlite_id: 'Q1', owner_user_id: 42, labels: { zh: { value: 'saved' } } };
    const store = { ensure: async () => {}, require: async () => node,
      update: async () => { steps.push('arango-committed'); return node; } } as any;
    const sync = { afterWrite: async () => { steps.push('es-attempted'); throw new Error('offline'); } } as any;
    const handler = createEnterpriseKnowledgeHandler({ store, sync, getUser: () => owner, getProject: () => ({ id: 7, name: 'app' }), canCreate: () => true });
    const url = new URL('http://localhost/api/kb/nodes/update?db=app');
    const originalError = console.error;
    console.error = () => {};
    try {
      const response = await handler(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'Q1', name: 'saved' }) }), url, 'POST');
      expect(response?.status).toBe(200);
      expect((await response!.json()).sync).toBe('pending');
      expect(steps).toEqual(['arango-committed', 'es-attempted']);
    } finally { console.error = originalError; }
  } finally { if (mode === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND; else process.env.KNOWLEDGE_STORAGE_BACKEND = mode; }
});
