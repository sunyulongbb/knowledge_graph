/** Back up and retire collections introduced by the previous storage design.
 * Dry-run by default. Stop old application instances before using --apply.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { EnterpriseKnowledgeStore, ArangoElasticsearchSync } from '../src/server/enterprise-knowledge.ts';
import { ElasticsearchClient, edgeDocuments, elasticsearchEntityIndexName } from '../src/server/arangodb.ts';
const apply = process.argv.includes('--apply');
const store = EnterpriseKnowledgeStore.configured();
const esUrl = process.env.ELASTICSEARCH_URL?.trim();
if (apply && !esUrl) throw new Error('Configure Elasticsearch before retiring the old sync collection');
const sync = esUrl ? new ArangoElasticsearchSync(store, new ElasticsearchClient({ url: esUrl.replace(/\/+$/, '') })) : null;
const backup = resolve('data/recovery', `arango-retired-collections-${Date.now()}.jsonl`);
if (apply) mkdirSync(resolve('data/recovery'), { recursive: true });
const { body } = await store.client.system('/_api/database');
const databases: string[] = body.result.filter((name: string) => name !== '_system' && !name.startsWith('codex_verify_'));
const indices = new Set<string>();
for (const database of databases) {
  const index = elasticsearchEntityIndexName(database);
  if (indices.has(index)) throw new Error(`Application index name collision: ${index}`);
  indices.add(index);
}
const reports: Record<string, any>[] = [];
for (const database of databases) {
  const collections: Record<string, any[]> = {};
  for (const collection of ['knowledge_attributes', 'knowledge_sync']) {
    try { await store.client.database(database, `/_api/collection/${collection}`); }
    catch (error: any) { if (error.status === 404) continue; throw error; }
    const documents = await store.query(database, 'FOR doc IN @@collection RETURN doc', { '@collection': collection });
    collections[collection] = documents;
    if (apply) {
      appendFileSync(backup, JSON.stringify({ database, collection, count: documents.length }) + '\n');
      for (const document of documents) appendFileSync(backup, JSON.stringify({ database, collection, document }) + '\n');
    }
  }
  const attrs = collections.knowledge_attributes || [];
  let migrated = 0;
  for (const original of attrs) {
    const node = await store.get(database, original.node_id);
    if (!node) throw new Error(`Cannot retire attributes with missing source entity in ${database}: ${original.id}`);
    const { _id, _rev, ...attribute } = original;
    const edges = edgeDocuments({ id: attribute.node_id }, [attribute as any]);
    if (!edges.length) throw new Error(`Cannot retire unrepresented empty attribute in ${database}: ${attribute.id}`);
    if (!apply) continue;
    await store.transaction(database, async trx => {
      await store.query(database, 'FOR edge IN link FILTER edge.sqlite_id == @id AND edge._from == @vertex REMOVE edge IN link', { id: attribute.id, vertex: `entity/${node._key}` }, trx);
      for (const edge of edges) await store.client.database(database, '/_api/document/link', { method: 'POST', headers: { 'x-arango-trx-id': trx }, body: JSON.stringify(edge) });
      const saved = (await store.attributes(database, attribute.node_id, trx)).find(row => row.id === attribute.id);
      for (const field of ['value', 'statement_json', 'datatype', 'property_name_snapshot']) {
        if (saved?.[field] !== attribute[field]) throw new Error(`Attribute verification failed for ${database}/${attribute.id}/${field}`);
      }
    });
    migrated++;
  }
  if (apply) {
    // Successful direct reconciliation includes all entity documents regardless of
    // the previous outbox state, including deletions missing from that outbox.
    await sync!.flush(database);
    for (const collection of Object.keys(collections)) {
      const current = await store.query(database, 'FOR doc IN @@collection RETURN { key: doc._key, rev: doc._rev }', { '@collection': collection });
      const versions = new Map(collections[collection]!.map(doc => [doc._key, doc._rev]));
      if (current.length !== versions.size || current.some(doc => versions.get(doc.key) !== doc.rev)) throw new Error(`Old application is still modifying ${database}/${collection}; refusing deletion`);
      await store.client.database(database, `/_api/collection/${collection}`, { method: 'DELETE' });
    }
  }
  reports.push({ database, attributes: attrs.length, oldSyncRecords: collections.knowledge_sync?.length || 0, migrated, ...(apply ? { retired: Object.keys(collections) } : {}) });
}
console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', ...(apply ? { backup } : {}), reports }));
