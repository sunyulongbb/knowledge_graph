import { EnterpriseKnowledgeSearch } from '../src/server/enterprise-search.ts';
import { createEnterpriseKnowledgeHandler } from '../src/server/routes/enterprise-knowledge.ts';
/** Uses an isolated, disposable database/index. Never reads or changes production knowledge. */
import { strict as assert } from 'node:assert';
import { ArangoClient, ElasticsearchClient, documentKey, elasticsearchEntityIndexName } from '../src/server/arangodb.ts';
import { EnterpriseKnowledgeStore, ArangoElasticsearchSync } from '../src/server/enterprise-knowledge.ts';

const name = `codex_verify_${Date.now()}`;
const arango = new ArangoClient({
  url: process.env.TEST_ARANGO_URL || 'http://127.0.0.1:8529',
  username: process.env.ARANGO_USERNAME || 'root',
  password: process.env.ARANGO_PASSWORD || process.env.ARANGO_ROOT_PASSWORD || '',
});
const es = new ElasticsearchClient({ url: process.env.TEST_ELASTICSEARCH_URL || 'http://127.0.0.1:9200' });
const store = new EnterpriseKnowledgeStore(arango);
const sync = new ArangoElasticsearchSync(store, es);
const owner = { id: 42, username: 'verification-owner' };
let created = false;
try {
  await arango.system('/_api/database', { method: 'POST', body: JSON.stringify({ name }) });
  created = true;
  for (const [collection, type] of [['entity', 2], ['link', 3]] as const) {
    await arango.database(name, '/_api/collection', { method: 'POST', body: JSON.stringify({ name: collection, type }) });
  }
  await store.create(name, 7, { id: 'source', name: '知识测试', description: '首个版本', visibility: 'private', categoryIds: ['class/a'] }, owner);
  await store.create(name, 7, { id: 'target', name: '关系目标', images: ['/static/uploads/node-images/test.png'] }, owner);
  await store.update(name, 'target', { name: '123', description: 'true' }, owner);
  assert.equal((await store.get(name, 'target'))?.labels.zh.value, '123');
  assert.equal((await store.get(name, 'target'))?.descriptions.zh.value, 'true');
  await sync.afterWrite(name);
  assert.equal((await new EnterpriseKnowledgeSearch(store, es).search(name, owner, { q: '123', limit: 20, offset: 0 })).total, 1);
  await store.update(name, 'target', { name: '关系目标', description: '' }, owner);
  assert.equal(await store.mediaReadable(name, '/static/uploads/node-images/test.png', null), true);
  const summary = await store.summary(name, owner);
  assert.equal(summary.entities, 2);
  assert.equal((await store.list(name, owner, { limit: 20, offset: 0, q: '知识测试' })).total, 1);
  await store.classify(name, 'target', 'class/b', false, owner);
  assert.equal((await store.get(name, 'target'))?.class_ids[0], 'class/b');
  await store.classify(name, 'target', 'class/b', true, owner);
  const maintainer = { id: 43, username: 'maintainer' };
  await store.maintenance(name, 'target', 'request', { message: '维护申请' }, maintainer);
  await store.maintenance(name, 'target', 'review', { user_id: 43, decision: 'approve' }, owner);
  await store.update(name, 'target', { description: '维护者编辑' }, maintainer);
  await store.maintenance(name, 'target', 'remove', { user_id: 43 }, owner);
  await assert.rejects(() => store.update(name, 'target', { description: '撤权后' }, maintainer));
  assert.equal((await store.list(name, null, { limit: 20, offset: 0 })).total, 1);
  assert.equal((await store.list(name, owner, { limit: 20, offset: 0, classId: 'class/a' })).total, 1);
  await assert.rejects(() => store.update(name, 'source', { name: 'unauthorized' }, { id: 43, username: 'stranger' }));
  await store.update(name, 'source', { description: '修改后的描述' }, owner);
  const attr = await store.saveAttribute(name, { node_id: 'source', property: 'P1', datatype: 'wikibase-item', value: { id: 'target' } }, owner);
  assert.equal((await store.attributes(name, 'source')).length, 1);
  assert.equal((await store.relations(name, 'source', owner)).length, 1);
  const literal = await store.saveAttribute(name, { node_id: 'source', property: 'P2', datatype: 'string', value: '测试属性' }, owner);
  const search = new EnterpriseKnowledgeSearch(store, es);
  await sync.flush(name);
  assert.equal((await search.search(name, owner, { limit: 20, offset: 0, q: '知识测试' })).total, 1);
  assert.equal((await search.search(name, null, { limit: 20, offset: 0 })).total, 1);
  assert.equal((await search.search(name, owner, { limit: 20, offset: 0, propertyId: 'P2', propertyValue: '测试' })).total, 1);
  assert.equal((await search.search(name, owner, { limit: 20, offset: 0, propertyId: 'P1', propertyValue: '测试' })).total, 0);
  assert.equal((await search.search(name, owner, { limit: 20, offset: 0, hasMedia: true })).total, 1);
  assert.equal((await search.search(name, owner, { limit: 20, offset: 0, classIds: ['class/a'] })).total, 1);
  // Recreating an ES index while the synchronizer is running must restore its search mappings.
  await es.send(`/${elasticsearchEntityIndexName(name)}`, { method: 'DELETE' });
  await sync.flush(name);
  assert.equal((await search.search(name, owner, { limit: 20, offset: 0, propertyId: 'P2', propertyValue: '测试' })).total, 1);
  const deep = await search.search(name, owner, { limit: 1, offset: 10001 });
  assert.equal(deep.total, 2);
  assert.equal(deep.nodes.length, 0);
  await store.update(name, 'target', { visibility: 'private' }, owner);
  assert.equal((await search.search(name, null, { limit: 20, offset: 0 })).total, 0);
  await store.update(name, 'target', { visibility: 'public' }, owner);
  const handler = createEnterpriseKnowledgeHandler({ store, search, sync, getUser: () => owner,
    getProject: () => ({ id: 7, name }), canCreate: () => true });
  const previousMode = process.env.KNOWLEDGE_STORAGE_BACKEND;
  process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  try {
    const updateUrl = new URL(`http://localhost/api/kb/nodes/update?db=${name}`);
    const response = await handler(new Request(updateUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'source', description: '修改后的描述' }) }), updateUrl, 'POST');
    assert.equal(response?.status, 200);
    assert.equal((await response!.json()).sync, 'synced');
    const queryUrl = new URL(`http://localhost/api/kb/entity_search?db=${name}&q=知识测试`);
    const results = await handler(new Request(queryUrl), queryUrl, 'GET');
    assert.equal((await results!.json()).searchBackend, 'elasticsearch');
  } finally {
    if (previousMode === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND; else process.env.KNOWLEDGE_STORAGE_BACKEND = previousMode;
  }
  await store.reorder(name, 'source', { kind: 'property', source: '2', target: '1', placement: 'before' }, owner);
  const media = await store.list(name, owner, { limit: 20, offset: 0, hasMedia: true });
  assert.equal(media.total, 1);
  const filtered = await store.list(name, owner, { limit: 20, offset: 0, propertyId: 'P2', propertyValue: '测试' });
  assert.equal(filtered.total, 1);
  await store.removeRelation(name, `${attr.id}:target`, owner);
  assert.equal((await store.relations(name, 'source', owner)).length, 0);
  await store.removeAttribute(name, literal.id, owner);
  const { body: collections } = await arango.database(name, '/_api/collection');
  assert.deepEqual(collections.result.filter((c: any) => !c.isSystem).map((c: any) => c.name).sort(), ['entity', 'link']);
  await sync.flush(name);
  assert.equal(await sync.flush(name), 0); // unchanged entity revisions do not get indexed again
  const index = elasticsearchEntityIndexName(name);
  const indexed = await es.send(`/${index}/_doc/${documentKey('source')}`);
  assert.equal(indexed.body._source.descriptions.zh.value, '修改后的描述');
  assert.deepEqual(indexed.body._source.class_ids, ['class/a']);
  // A change made directly in ArangoDB must propagate without any application task.
  await arango.database(name, `/_api/document/entity/${documentKey('source')}`, { method: 'PATCH', body: JSON.stringify({ descriptions: { zh: { language: 'zh', value: 'ArangoDB直接修改' } } }) });
  await sync.flush(name);
  assert.equal((await es.send(`/${index}/_doc/${documentKey('source')}`)).body._source.descriptions.zh.value, 'ArangoDB直接修改');
  assert.equal((await store.attributes(name, 'source')).length, 0);
  await store.remove(name, 'source', owner);
  assert.equal((await search.search(name, owner, { limit: 20, offset: 0 })).total, 1);
  await sync.flush(name);
  assert.equal(await store.get(name, 'source'), null);
  await assert.rejects(() => es.send(`/${index}/_doc/${documentKey('source')}`), (error: any) => error.status === 404);
  console.log('PASS: real ArangoDB CRUD, permissions, pagination, attributes, relations, link-only attributes, ES search/filters/ACL and Arango-first write-through synchronization');
} finally {
  if (created) {
    await arango.system(`/_api/database/${name}`, { method: 'DELETE' });
    await es.send(`/${elasticsearchEntityIndexName(name)}`, { method: 'DELETE' }).catch((error: any) => { if (error.status !== 404) throw error; });
  }
}
