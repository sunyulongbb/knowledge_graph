import { expect, test, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { ArangoClient, ElasticsearchClient, documentKey } from '../src/server/arangodb.ts';
import { EnterpriseKnowledgeStore, ArangoElasticsearchSync } from '../src/server/enterprise-knowledge.ts';
import { importEnterpriseEntities } from '../src/server/enterprise-entity-import.ts';
import { createEnterpriseKnowledgeHandler } from '../src/server/routes/enterprise-knowledge.ts';
import { EnterpriseSqliteBackup } from '../src/server/enterprise-sqlite-backup.ts';

type Doc = Record<string, any>;
const user = { id: 42, username: 'member', memberProjectIds: [7] };
const reply = (body: any, status = 200) => Response.json(body, { status });

function fixture() {
  let tables: Record<string, Map<string, Doc>> = { entity: new Map(), link: new Map(), knowledge_schema: new Map() };
  let transaction: typeof tables | null = null;
  const collections = new Set(['entity', 'link']);
  const calls: Doc[] = [], indexed: Doc[] = [];
  let failCollection = '', failEs = false;
  const store = new EnterpriseKnowledgeStore(new ArangoClient({ url: 'http://arango', username: 'u', password: 'p' }, async (input, init) => {
    const path = new URL(String(input)).pathname.replace('/_db/app', '');
    const method = init?.method || 'GET', body = init?.body ? JSON.parse(String(init.body)) : {};
    const trx = new Headers(init?.headers).get('x-arango-trx-id');
    calls.push({ path, method, body, trx });
    const current = trx ? transaction! : tables;
    if (path === '/_api/collection' && method === 'POST') { collections.add(body.name); return reply({}); }
    if (path.startsWith('/_api/collection/')) return collections.has(path.split('/').at(-1)!) ? reply({}) : reply({ errorNum: 1203 }, 404);
    if (path === '/_api/transaction/begin') {
      expect(body.collections.exclusive).toEqual(['entity', 'link', 'knowledge_schema']);
      transaction = structuredClone(tables); return reply({ result: { id: 'trx' } });
    }
    if (path === '/_api/transaction/trx') {
      if (method === 'PUT') tables = transaction!;
      transaction = null; return reply({});
    }
    if (path.startsWith('/_api/document/')) {
      const [, , , collection, id] = path.split('/');
      if (method === 'GET') {
        const doc = current[collection!]?.get(id!);
        return doc ? reply(doc) : reply({ errorNum: collections.has(collection!) ? 1202 : 1203 }, 404);
      }
      if (Array.isArray(body)) return reply(body.map((doc, index) => {
        if (collection === failCollection && index === body.length - 1) return { error: true };
        current[collection!]!.set(doc._key, { ...doc, _id: `${collection}/${doc._key}`, _rev: String(calls.length) });
        return { _key: doc._key, error: false };
      }));
    }
    if (path === '/_api/cursor') {
      const { query, bindVars: vars } = body;
      let result: any[] = [];
      if (query.includes('RETURN { entity:')) result = [{ entity: [...current.entity!.values()], link: [...current.link!.values()],
        ...(query.includes('knowledge_schema:') ? { knowledge_schema: [...current.knowledge_schema!.values()] } : {}) }];
      else if (query.includes('doc._key > @after')) result = [...current.entity!.values()].filter(doc => doc._key > vars.after)
        .sort((a, b) => a._key.localeCompare(b._key)).slice(0, vars.limit).map(doc => ({ ...doc, _search_attributes: [...current.link!.values()]
          .filter(edge => edge._from === doc._id).map(edge => ({ property_id: edge.property_id, value_text: JSON.stringify(edge.value), revision: edge._rev })) }));
      else if (query.includes("DOCUMENT('entity', key)")) result = vars.keys.filter((id: string) => !current.entity!.has(id)).map((key: string) => ({ key }));
      else if (query.includes('LET names')) result = [...current.entity!.values()].filter(doc => {
        const names = [...Object.values(doc.labels || {}).map((value: any) => value.value), ...Object.values(doc.aliases || {}).flat().map((value: any) => value.value)];
        return names.some((name: string) => vars.labels.includes(name.trim().toLocaleLowerCase()));
      });
      else if (query.includes('REMOVE edge IN link')) {
        for (const [id, edge] of current.link!) if (edge._from === vars.vertex && vars.properties.includes(edge.property_id)) current.link!.delete(id);
      } else if (query.includes('FOR edge IN link')) result = [...current.link!.values()].filter(edge => edge._from === vars.vertex);
      else throw new Error(`Unexpected AQL: ${query}`);
      return reply({ result });
    }
    throw new Error(`Unexpected Arango request: ${method} ${path}`);
  }));
  const es = new ElasticsearchClient({ url: 'http://es' }, async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (failEs) return reply({ error: { reason: 'ES offline' } }, 503);
    if (path.endsWith('/_mget')) return reply({ docs: [] });
    if (path === '/_bulk') {
      expect(transaction).toBeNull();
      const lines = String(init?.body).trim().split('\n').map(line => JSON.parse(line));
      for (let i = 1; i < lines.length; i += 2) indexed.push(lines[i]);
      return reply({ errors: false, items: [{ index: { status: 201 } }] });
    }
    if (path.endsWith('/_pit') && init?.method === 'POST') return reply({ id: 'pit' });
    if (path === '/_search') return reply({ hits: { hits: [] } });
    return reply({});
  });
  const sync = new ArangoElasticsearchSync(store, es);
  let backups = 0;
  const handler = createEnterpriseKnowledgeHandler({ store, sync, getProject: () => ({ id: 7, name: 'app' }),
    getUser: () => user, canCreate: () => true, backup: { afterWrite: async () => { backups++; } } as any });
  return { store, sync, handler, calls, indexed, tables: () => tables, backups: () => backups,
    failWrite: (collection: string) => { failCollection = collection; }, failEs: (offline = true) => { failEs = offline; } };
}
async function enterprise(work: () => Promise<void>) {
  const previous = process.env.KNOWLEDGE_STORAGE_BACKEND; process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  try { await work(); } finally { if (previous === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND; else process.env.KNOWLEDGE_STORAGE_BACKEND = previous; }
}
const url = new URL('http://local/api/kb/entity/import?db=app');
const request = (body: unknown) => new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('array import commits graph and schema before ES indexing without immediate SQLite backup', () => enterprise(async () => {
  const f = fixture();
  const response = (await f.handler(request([
    { version: 1, entity: { id: 'a', name: '张三', type: '人物', categories: [{ name: '主体', tags: ['分类标签'], children: [{ name: '人员' }] }], attributes: [
      { id: 'related', name: '同事', datatype: 'wikibase-item', value: [{ label_zh: '李四' }, { label_zh: '北京' }, { label_zh: '北京' }] },
      { name: '出生日期', datatype: 'time', value: '1990-05-20' },
    ] } }, { id: 'b', name: '李四', type: '人物', attributes: [] },
  ]), url, 'POST'))!;
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ batch: true, created: 2, total: 2, sync: 'synced', referencedEntitiesCreated: 1, referencedEntitiesMatched: 2 });
  expect(f.tables().entity!.size).toBe(3);
  const node = f.tables().entity!.get(documentKey('a'))!;
  expect(node.owner_user_id).toBe(42); expect(node.class_ids).toHaveLength(2); expect(JSON.parse(node.tags)).toContain('分类标签');
  const attrs = await f.store.attributes('app', 'a');
  const refs = JSON.parse(attrs.find(row => row.key === 'related')!.value);
  expect(refs[0].id).toBe('b'); expect(refs[1].id).toBe(refs[2].id);
  const schema = await f.store.importSchema('app');
  expect(schema!.ontologies.map(row => row.name)).toEqual(['人物', '实体条目']); expect(schema!.classes.map(row => row.name)).toEqual(['主体', '人员']);
  expect(schema!.properties).toHaveLength(2); expect(schema!.ontology_properties).toHaveLength(2);
  expect(f.indexed).toHaveLength(3); expect(f.indexed.find(row => row.sqlite_id === 'a')!.search_attributes).toHaveLength(4); expect(f.backups()).toBe(0);
  const schemaUrl = new URL('http://local/api/kb/ontology/property?db=app&ontology_id=' + encodeURIComponent(schema!.ontologies[0]!.id));
  expect(await (await f.handler(new Request(schemaUrl), schemaUrl, 'GET'))!.json()).toMatchObject({ items: [{ name: '同事' }, { name: '出生日期' }] });
}));

test('updates replace incoming properties and preserve other values, categories and ownership', async () => {
  const f = fixture();
  await importEnterpriseEntities(f.store, 'app', 7, [{ id: 'a', name: '甲', type: '人物', categories: [{ name: '分类' }], attributes: [{ id: 'p', name: '职业', value: '教师' }, { id: 'q', name: '备注', value: '保留' }] }], user);
  const old = f.tables().entity!.get(documentKey('a'))!; old.wiki_md = '保留页面'; old.maintainer_ids = [123];
  const result = await importEnterpriseEntities(f.store, 'app', 7, [{ id: 'a', name: '新名称', type: '人物', attributes: [{ id: 'p', name: '职业', value: '工程师' }] }], user);
  expect(result).toMatchObject({ entityUpdated: true, attributesUpdated: 1, ontologyCreated: false });
  const node = f.tables().entity!.get(documentKey('a'))!;
  expect(node.class_ids).toEqual(old.class_ids); expect(node.wiki_md).toBe('保留页面'); expect(node.owner_user_id).toBe(42); expect(node.maintainer_ids).toEqual([123]);
  const attrs = await f.store.attributes('app', 'a'); expect(attrs).toHaveLength(2);
  expect(attrs.find(row => row.key === 'p')!.value).toBe('工程师'); expect(attrs.find(row => row.key === 'q')!.value).toBe('保留');
});

test('malformed, empty and duplicate batches fail before Arango requests', async () => {
  for (const input of [[], [{ name: '有效', type: '人物' }, { name: '', type: '人物' }], [{ id: 'a', name: '甲', type: '人物' }, { id: 'entity/a', name: '乙', type: '人物' }]]) {
    const f = fixture(); await expect(importEnterpriseEntities(f.store, 'app', 7, input, user)).rejects.toThrow(); expect(f.calls).toHaveLength(0);
  }
});

test('partial document errors roll back the entire import without indexing', () => enterprise(async () => {
  for (const collection of ['entity', 'link', 'knowledge_schema']) {
    const f = fixture(); f.failWrite(collection); const log = spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await f.handler(request([{ id: 'a', name: '甲', type: '人物', attributes: [{ name: '职业', value: '教师' }] }]), url, 'POST'))!.status).toBe(503);
      expect(f.tables().entity!.size).toBe(0); expect(f.tables().link!.size).toBe(0); expect(f.tables().knowledge_schema!.size).toBe(0);
      expect(f.calls.some(call => call.path === '/_api/transaction/trx' && call.method === 'DELETE')).toBe(true); expect(f.indexed).toHaveLength(0); expect(f.backups()).toBe(0);
    } finally { log.mockRestore(); }
  }
}));

test('ES outage reports committed data with pending retry and no synchronous backup', () => enterprise(async () => {
  const f = fixture(); f.failEs(); const log = spyOn(console, 'error').mockImplementation(() => {});
  try {
    const response = (await f.handler(request({ version: 1, entities: [{ id: 'a', name: '甲', type: '人物' }] }), url, 'POST'))!;
    expect(response.status).toBe(202); expect(await response.json()).toMatchObject({ ok: true, entityId: 'a', sync: 'pending', warning: expect.any(String) });
    expect(f.tables().entity!.size).toBe(1); expect(f.backups()).toBe(0);
    f.failEs(false); await f.sync.afterWrite('app');
    expect(f.indexed.map(row => row.sqlite_id)).toEqual(['a']); expect(f.sync.status('app').error).toBeNull();
  } finally { log.mockRestore(); }
}));

test('login, membership and ES configuration are checked before reading import data', () => enterprise(async () => {
  for (const [current, member, configured, status] of [[null, true, true, 401], [user, false, true, 403], [user, true, false, 503]] as const) {
    const f = fixture(); const handler = createEnterpriseKnowledgeHandler({ store: f.store, sync: configured ? f.sync : undefined,
      getProject: () => ({ id: 7, name: 'app' }), getUser: () => current, canCreate: () => member });
    const req = request([]); expect((await handler(req, url, 'POST'))!.status).toBe(status); expect(req.bodyUsed).toBe(false); expect(f.calls).toHaveLength(0);
  }
}));

test('import checks existing entity edit and visibility management permissions', async () => {
  const f = fixture(); await importEnterpriseEntities(f.store, 'app', 7, [{ id: 'a', name: '甲', type: '人物' }], user);
  await expect(importEnterpriseEntities(f.store, 'app', 7, [{ id: 'a', name: '乙', type: '人物' }], { id: 99, username: 'stranger' })).rejects.toThrow('无权修改');
  f.tables().entity!.get(documentKey('a'))!.maintainer_ids = [98];
  await expect(importEnterpriseEntities(f.store, 'app', 7, [{ id: 'a', name: '乙', type: '人物', visibility: 'private' }], { id: 98, username: 'maintainer' })).rejects.toThrow('仅管理者');
  expect(f.tables().entity!.get(documentKey('a'))!.labels.zh.value).toBe('甲');
});

test('scheduled SQLite snapshots include imported knowledge and schema', async () => {
  const f = fixture(); await importEnterpriseEntities(f.store, 'app', 7, [{ id: 'a', name: '甲', type: '人物' }], user);
  const db = new Database(':memory:');
  try {
    const backup = new EnterpriseSqliteBackup(db, f.store); expect(backup.status('app')).toBeNull(); await backup.flush('app');
    const saved = db.query('SELECT snapshot_json FROM enterprise_knowledge_backups').get() as any;
    expect(JSON.parse(saved.snapshot_json)).toMatchObject({ entity: [{ sqlite_id: 'a' }], knowledge_schema: [{ _key: 'definitions', ontologies: [{ name: '人物' }] }] });
  } finally { db.close(); }
});

test('legacy definitions seed Arango once, and subsequent imports use only the committed Arango definitions', async () => {
  const f = fixture(); let reads = 0;
  const legacy = { classes: [], ontologies: [{ id: 'old-type', name: '人物', status: 'deprecated' }],
    properties: [{ id: 'old-property', name: '职业', datatype: 'string' }], ontology_properties: [] };
  const seed = () => { reads++; return legacy; };
  const document = [{ name: '甲', type: '人物', attributes: [{ name: '职业', value: '教师' }] }];
  const first = await importEnterpriseEntities(f.store, 'app', 7, document, user, seed);
  await importEnterpriseEntities(f.store, 'app', 7, document, user, seed);
  expect(first).toMatchObject({ ontologyId: 'old-type', ontologyCreated: false, propertiesCreated: 0 });
  expect(reads).toBe(1); expect(legacy.ontologies[0]!.status).toBe('deprecated');
  expect((await f.store.importSchema('app'))!.ontologies[0]!.status).toBe('active');
});
