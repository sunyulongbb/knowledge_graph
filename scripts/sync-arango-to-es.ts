/** Standalone ArangoDB -> ES reconciler. Does not import or query SQLite. */
import { EnterpriseKnowledgeStore } from '../src/server/enterprise-knowledge.ts';
import { ArangoElasticsearchSync } from '../src/server/entity-elasticsearch-sync.ts';
import { ElasticsearchClient, elasticsearchEntityIndexName } from '../src/server/arangodb.ts';
const url = process.env.ELASTICSEARCH_URL?.trim();
if (!url) throw new Error('ELASTICSEARCH_URL is required');
const store = EnterpriseKnowledgeStore.configured();
const sync = new ArangoElasticsearchSync(store, new ElasticsearchClient({ url: url.replace(/\/+$/, '') }));
const selected = process.argv.find(arg => arg.startsWith('--database='))?.slice('--database='.length);
const watch = process.argv.includes('--watch');
const interval = Number(process.env.ENTITY_ES_SYNC_INTERVAL_MS || 30_000);
do {
  try {
    const { body } = await store.client.system('/_api/database');
    const names: string[] = selected ? [selected] : body.result.filter((name: string) => name !== '_system' && !name.startsWith('codex_verify_'));
    const indices = new Set<string>();
    for (const database of names) {
      const index = elasticsearchEntityIndexName(database);
      if (indices.has(index)) throw new Error(`Applications share the Elasticsearch index ${index}`);
      indices.add(index);
    }
    const failures: unknown[] = [];
    for (const database of names) {
      try {
        await sync.flush(database);
        console.log(JSON.stringify({ database, ...sync.status(database) }));
      } catch (error) { failures.push(error); console.error(`Synchronization failed for ${database}:`, error); }
    }
    if (failures.length) throw new AggregateError(failures, 'One or more application indices could not be synchronized');
  } catch (error) {
    if (!watch) throw error;
    console.error('Synchronization will retry:', error);
  }
  if (watch) await Bun.sleep(Number.isFinite(interval) ? Math.max(1000, interval) : 30_000);
} while (watch);
