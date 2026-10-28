import { expect, test } from 'bun:test';
import { ArangoClient, ElasticsearchClient, documentKey, entityDocument, edgeDocuments } from '../src/server/arangodb.ts';
import { EnterpriseKnowledgeStore, ArangoElasticsearchSync, arangoNodeResponse, canUseArangoKnowledge } from '../src/server/enterprise-knowledge.ts';
import { createEnterpriseKnowledgeHandler } from '../src/server/routes/enterprise-knowledge.ts';
import { enterpriseKnowledgeEnabled } from '../src/server/knowledge-mode.ts';

const owner = { id: 42, username: 'owner' };
const stranger = { id: 43, username: 'other' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test('Lite mode remains explicit even with Arango environment configured', () => {
  expect(enterpriseKnowledgeEnabled({})).toBe(false);
  expect(enterpriseKnowledgeEnabled({ ARANGO_URL: 'http://arango' })).toBe(true);
  expect(enterpriseKnowledgeEnabled({ ARANGO_URL: 'http://arango', KNOWLEDGE_STORAGE_BACKEND: 'sqlite' })).toBe(false);
  expect(() => enterpriseKnowledgeEnabled({ KNOWLEDGE_STORAGE_BACKEND: 'typo' })).toThrow();
});
test('Arango permissions protect private documents and preserve owner/member maintenance rules', () => {
  const node = { project_id: 7, owner_user_id: 42, visibility: 'private', maintainer_ids: [44] };
  expect(canUseArangoKnowledge(node, null)).toBe(false);
  expect(canUseArangoKnowledge(node, stranger)).toBe(false);
  expect(canUseArangoKnowledge(node, owner, 'manage')).toBe(true);
  expect(canUseArangoKnowledge(node, { id: 44, username: 'maintainer' }, 'edit')).toBe(true);
  expect(canUseArangoKnowledge(node, { id: 44, username: 'maintainer' }, 'manage')).toBe(false);
  expect(canUseArangoKnowledge(node, { ...stranger, memberProjectIds: [7] }, 'edit')).toBe(true);
  expect(canUseArangoKnowledge({ visibility: 'public' }, null)).toBe(true);
});
test('formatting and patching Arango documents do not query SQLite knowledge tables', () => {
  const store = new EnterpriseKnowledgeStore(new ArangoClient({ url: 'http://arango', username: 'u', password: 'p' }));
  const first = store.patch(null, { id: 'Q1', name: '名称', description: '描述', aliases: ['别名'], categoryIds: ['class/a'], images: ['/a.png'] }, 7, owner);
  const updated = store.patch(first, { description: '新描述' }, 7, owner);
  const result = arangoNodeResponse(updated, owner);
  expect(result.name).toBe('名称');
  expect(result.description).toBe('新描述');
  expect(result.aliases).toEqual(['别名']);
  expect(result.categories).toEqual(['class/a']);
  expect(result.image).toBe('/a.png');
  expect(result.can_edit).toBe(true);
  expect(updated.owner_user_id).toBe(owner.id);
});
test('JSON scalar text from the composer survives Arango creation and editing', () => {
  const store = new EnterpriseKnowledgeStore(new ArangoClient({ url: 'http://arango', username: 'u', password: 'p' }));
  for (const name of ['123', '0', 'true', 'false', 'null', '1.25']) {
    const first = store.patch(null, { id: 'text', name, description: name, aliases: name }, 7, owner);
    expect(first.labels.zh.value).toBe(name);
    expect(first.descriptions.zh.value).toBe(name);
    expect(first.aliases.zh[0].value).toBe(name);
    const updated = store.patch(first, { description: '456' }, 7, owner);
    expect(arangoNodeResponse(updated, owner).name).toBe(name);
    expect(arangoNodeResponse(updated, owner).description).toBe('456');
  }
});

test('AQL cursor pagination consumes every page and cleans the cursor', async () => {
  const calls: string[] = [];
  const store = new EnterpriseKnowledgeStore(new ArangoClient({ url: 'http://arango', username: 'u', password: 'p' }, async (input, init) => {
    const method = init?.method || 'GET'; calls.push(method);
    return reply(method === 'POST' ? { result: [{ id: 1 }], hasMore: true, id: 'cursor' } : { result: [{ id: 2 }], hasMore: false });
  }));
  expect(await store.query('app', 'RETURN 1')).toEqual([{ id: 1 }, { id: 2 }]);
  expect(calls).toEqual(['POST', 'PUT', 'DELETE']);
});
test('a graph write failure rolls back the entity/link transaction without creating auxiliary collections', async () => {
  const calls: string[] = [];
  const store = new EnterpriseKnowledgeStore(new ArangoClient({ url: 'http://arango', username: 'u', password: 'p' }, async (input, init) => {
    const path = new URL(String(input)).pathname, method = init?.method || 'GET';
    calls.push(`${method} ${path}`);
    if (path.endsWith('/transaction/begin')) {
      expect(JSON.parse(String(init?.body)).collections.exclusive).toEqual(['entity', 'link']);
      return reply({ result: { id: 'trx' } });
    }
    if (path.includes('/document/entity/')) return reply({ errorMessage: 'not found' }, 404);
    if (path.endsWith('/document/entity')) return reply({ errorMessage: 'write failed' }, 500);
    return reply({});
  }));
  await expect(store.create('app', 7, { id: 'Q1', name: 'test' }, owner)).rejects.toThrow('write failed');
  expect(calls).toContain('DELETE /_db/app/_api/transaction/trx');
  expect(calls).not.toContain('PUT /_db/app/_api/transaction/trx');
  expect(calls).not.toContain('POST /_db/app/_api/collection');
});
test('ES failure is retried by rescanning entity and never triggers deletion after an incomplete source copy', async () => {
  const entity = { _key: 'key1', _rev: 'rev1', id: 'Q1', labels: {} };
  let sourceReads = 0, fail = true;
  const arangoCalls: string[] = [], esCalls: string[] = [];
  const store = new EnterpriseKnowledgeStore(new ArangoClient({ url: 'http://arango', username: 'u', password: 'p' }, async (input, init) => {
    const path = new URL(String(input)).pathname;
    arangoCalls.push(path);
    if (path.endsWith('/cursor')) {
      const binds = JSON.parse(String(init?.body)).bindVars;
      sourceReads++;
      return reply({ result: binds.after === '' ? [entity] : [] });
    }
    return reply({});
  }));
  const es = new ElasticsearchClient({ url: 'http://es' }, async (input, init) => {
    const url = new URL(String(input)); esCalls.push(url.pathname);
    if (url.pathname.endsWith('/_mget')) return reply({ docs: [] });
    if (url.pathname === '/_bulk') {
      if (fail) return reply({ error: { reason: 'offline' } }, 503);
      const lines = String(init?.body).trim().split('\n').map(line => JSON.parse(line));
      expect(lines[1]._arango_rev).toBe('rev1');
      expect(lines[1]._rev).toBeUndefined();
      return reply({ errors: false, items: [{ index: { status: 201 } }] });
    }
    if (url.pathname.endsWith('/_pit') && init?.method === 'POST') return reply({ id: 'pit' });
    if (url.pathname === '/_search') return reply({ hits: { hits: [] } });
    return reply({});
  });
  const sync = new ArangoElasticsearchSync(store, es);
  await expect(sync.flush('app')).rejects.toThrow('offline');
  expect(esCalls).not.toContain('/_search');
  fail = false;
  expect(await sync.flush('app')).toBe(1);
  expect(sourceReads).toBeGreaterThanOrEqual(3);
  expect(arangoCalls.every(path => !path.includes('knowledge_sync') && !path.includes('knowledge_attributes'))).toBe(true);
  expect(sync.status('app').error).toBeNull();
});
test('Enterprise node endpoint reads ArangoDB and never invokes the SQLite permission guard', async () => {
  const oldMode = process.env.KNOWLEDGE_STORAGE_BACKEND;
  process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  try {
    const node = entityDocument({ id: 'Q1', name: '图数据库知识', owner_user_id: 42, visibility: 'private' });
    const store = new EnterpriseKnowledgeStore(new ArangoClient({ url: 'http://arango', username: 'u', password: 'p' }, async (input) => {
      const path = new URL(String(input)).pathname;
      return reply(path.includes('/document/entity/') ? node : path.endsWith('/cursor') ? { result: [] } : {});
    }));
    const handler = createEnterpriseKnowledgeHandler({ store, getProject: () => ({ id: 7, name: 'app' }), getUser: () => owner, canCreate: () => true });
    const url = new URL('http://localhost/api/kb/node?db=app&id=Q1');
    const response = await handler(new Request(url), url, 'GET');
    expect(response?.status).toBe(200);
    expect((await response!.json()).node.name).toBe('图数据库知识');
    const unsupported = new URL('http://localhost/api/kb/nodes/clear?db=app');
    expect((await handler(new Request(unsupported, { method: 'DELETE' }), unsupported, 'DELETE'))?.status).toBe(501);
    process.env.KNOWLEDGE_STORAGE_BACKEND = 'sqlite';
    expect(await handler(new Request(url), url, 'GET')).toBeNull();
  } finally {
    if (oldMode === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND; else process.env.KNOWLEDGE_STORAGE_BACKEND = oldMode;
  }
});

test('Enterprise media append preserves existing videos and their positional cover pairs', () => {
  const store = new EnterpriseKnowledgeStore(new ArangoClient({ url: 'http://arango', username: 'u', password: 'p' }));
  const first = store.patch(null, { id: 'Q1', videos: ['/v1.mp4'], covers: [''] }, 7, owner);
  const next = store.patch(first, { videos: ['/v2.mp4'], covers: ['/cover2.png'], appendVideos: true, appendCovers: true }, 7, owner);
  expect(JSON.parse(next.videos)).toEqual(['/v1.mp4', '/v2.mp4']);
  expect(JSON.parse(next.covers)).toEqual(['', '/cover2.png']);
  const response = arangoNodeResponse({ ...next, maintenance_requests: { 43: { message: 'private application' } } }, null);
  expect(response.maintenance_requests).toBeUndefined();
});


test('an explicitly cleared classification is marked and must not be backfilled from an old backup', () => {
  const store = new EnterpriseKnowledgeStore(new ArangoClient({ url: 'http://arango', username: 'u', password: 'p' }));
  const first = store.patch(null, { id: 'Q1', categoryIds: ['class/a'] }, 7, owner);
  const cleared = store.patch(first, { categoryIds: [] }, 7, owner);
  expect(cleared.class_ids).toEqual([]);
  expect(cleared.classification_initialized).toBe(true);
});

test('direct entity reconciliation only deletes ES documents absent from entity and uses concurrency checks', async () => {
  let searches = 0;
  const deletions: any[] = [];
  const store = new EnterpriseKnowledgeStore(new ArangoClient({ url: 'http://arango', username: 'u', password: 'p' }, async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/cursor')) {
      const query = JSON.parse(String(init?.body)).query;
      return reply({ result: query.includes('FOR key IN @keys') ? [{ key: 'gone' }] : [] });
    }
    return reply({});
  }));
  const es = new ElasticsearchClient({ url: 'http://es' }, async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/_pit') && init?.method === 'POST') return reply({ id: 'pit' });
    if (path === '/_search') return reply({ hits: { hits: searches++ === 0 ? [
      { _id: 'gone', _seq_no: 8, _primary_term: 2, sort: [1] },
      { _id: 'exists', _seq_no: 9, _primary_term: 2, sort: [2] },
    ] : [] } });
    if (path === '/_bulk') {
      deletions.push(...String(init?.body).trim().split('\n').map(line => JSON.parse(line)));
      return reply({ errors: false, items: [{ delete: { status: 200 } }] });
    }
    return reply({});
  });
  await new ArangoElasticsearchSync(store, es).flush('app');
  expect(deletions).toEqual([{ delete: { _index: 'entity-app', _id: 'gone', if_seq_no: 8, if_primary_term: 2 } }]);
});


test('link documents preserve complete attribute values, qualifiers and sources without a separate collection', async () => {
  const statement = { datatype: 'string', snaktype: 'value', rank: 'preferred', property: 'P2',
    datavalue: { type: 'string', value: ['single array item'] }, qualifiers: { P3: [{ value: 'qualifier' }] }, references: [{ snaks: { P4: [{ value: 'source' }] } }] };
  const attribute = { id: 'attr/one', node_id: 'Q1', key: 'P2', datatype: 'string', value: JSON.stringify(statement.datavalue.value),
    property_name_snapshot: '测试属性', statement_json: JSON.stringify(statement), created_at: '2026-10-28' };
  const edges = edgeDocuments({ id: 'Q1' }, [attribute]);
  const calls: string[] = [];
  const store = new EnterpriseKnowledgeStore(new ArangoClient({ url: 'http://arango', username: 'u', password: 'p' }, async (input) => {
    calls.push(String(input));
    return reply({ result: edges });
  }));
  const result = await store.attributes('app', 'Q1');
  expect(result).toHaveLength(1);
  expect(JSON.parse(result[0]!.value)).toEqual(['single array item']);
  expect(JSON.parse(result[0]!.statement_json)).toEqual(statement);
  expect(calls).toHaveLength(1);
  expect(calls[0]).not.toContain('knowledge_attributes');
});
