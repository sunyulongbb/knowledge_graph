import { ElasticsearchClient, ensureElasticsearchEntityIndex, elasticsearchEntityIndexName } from './arangodb.ts';
import { ensureEntitySearchMapping, entitySearchProjection, ENTITY_SEARCH_SCHEMA } from './enterprise-search.ts';
import type { EnterpriseKnowledgeStore } from './enterprise-knowledge.ts';
type Doc = Record<string, any>;

/** Reconciles ES directly against entity; no auxiliary Arango collection or queue. */
export class ArangoElasticsearchSync {
  private readonly running = new Map<string, Promise<number>>();
  private readonly statuses = new Map<string, Doc>();
  private lastVersion = 0;
  constructor(readonly store: EnterpriseKnowledgeStore, readonly elasticsearch: ElasticsearchClient) {}
  status(database: string) {
    return { source: 'entity', mode: 'reconcile', running: this.running.has(database), ...this.statuses.get(database) };
  }
  flush(database: string, batchSize = 250): Promise<number> {
    const current = this.running.get(database);
    if (current) return current;
    const task = this.reconcile(database, Math.max(1, Math.min(1000, batchSize)));
    this.running.set(database, task);
    const finish = () => { if (this.running.get(database) === task) this.running.delete(database); };
    task.then(finish, finish);
    return task;
  }
  async afterWrite(database: string) {
    const current = this.running.get(database);
    if (current) await current.catch(() => {});
    // A pass already running may have read the entity before the write committed.
    return this.flush(database);
  }
  private async bulk(lines: unknown[]) {
    if (!lines.length) return;
    const { body } = await this.elasticsearch.send('/_bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/x-ndjson' },
      body: lines.map(line => JSON.stringify(line)).join('\n') + '\n',
    });
    const failures = (body?.items || []).filter((item: Doc) => {
      const result = item.index || item.delete;
      return result?.error && result.status !== 409 && !(item.delete && result.status === 404);
    });
    if (failures.length || (body?.errors && !body?.items?.length)) throw new Error(`Elasticsearch entity reconciliation failed: ${JSON.stringify(failures.slice(0, 3))}`);
  }
  private async reconcile(database: string, batchSize: number) {
    let scanned = 0, indexed = 0, deleted = 0;
    try {
      await this.store.ensure(database);
      const index = await ensureElasticsearchEntityIndex(this.elasticsearch, database, true);
      const encodedIndex = encodeURIComponent(index);
      await ensureEntitySearchMapping(this.elasticsearch, index);
      const version = this.lastVersion = Math.max(Date.now(), this.lastVersion + 1);
      let after = '';
      while (true) {
        const page = await this.store.query(database, `FOR doc IN entity FILTER doc._key > @after SORT doc._key ASC LIMIT @limit
          LET attributes = (FOR edge IN link FILTER edge._from == doc._id SORT edge._key
            RETURN { property_id: edge.property_id, value_text: TO_STRING(edge.value), revision: edge._rev })
          RETURN MERGE(doc, { _search_attributes: attributes })`, { after, limit: batchSize });
        if (!page.length) break;
        const { body: existing } = await this.elasticsearch.send(`/${encodedIndex}/_mget?_source_includes=_arango_rev,_search_revision,_search_schema`, {
          method: 'POST', body: JSON.stringify({ ids: page.map(doc => doc._key) }),
        });
        const revisions = new Map((existing?.docs || []).map((doc: Doc) => {
          if (doc.error) throw new Error(`Elasticsearch revision lookup failed: ${JSON.stringify(doc.error)}`);
          return [doc._id, doc._source];
        }));
        const lines: unknown[] = [];
        for (const document of page) {
          scanned++;
          const projection = entitySearchProjection(document);
          const previous = revisions.get(document._key) as Doc | undefined;
          if (document._rev && previous?._search_revision === projection._search_revision && previous?._search_schema === ENTITY_SEARCH_SCHEMA) continue;
          lines.push({ index: { _index: index, _id: document._key, version, version_type: 'external_gte' } });
          lines.push(projection);
          indexed++;
        }
        await this.bulk(lines);
        after = page[page.length - 1]!._key;
      }
      // Only reconcile removals after every source page has succeeded. ES PIT keeps
      // pagination stable; each candidate is rechecked against current entity data.
      await this.elasticsearch.send(`/${encodedIndex}/_refresh`, { method: 'POST' });
      const { body: opened } = await this.elasticsearch.send(`/${encodedIndex}/_pit?keep_alive=1m`, { method: 'POST' });
      let pitId = opened?.id;
      if (!pitId) throw new Error('Elasticsearch did not open a point in time');
      try {
        let searchAfter: unknown[] | undefined;
        while (true) {
          const { body } = await this.elasticsearch.send('/_search', {
            method: 'POST', body: JSON.stringify({ size: batchSize, pit: { id: pitId, keep_alive: '1m' },
              sort: [{ _shard_doc: 'asc' }], track_total_hits: false, _source: false,
              seq_no_primary_term: true, ...(searchAfter ? { search_after: searchAfter } : {}) }),
          });
          if (body?.timed_out || body?._shards?.failed) throw new Error('Elasticsearch returned an incomplete entity scan');
          pitId = body?.pit_id || pitId;
          const hits: Doc[] = body?.hits?.hits || [];
          if (!hits.length) break;
          const missing = await this.store.query(database, "FOR key IN @keys FILTER DOCUMENT('entity', key) == null RETURN { key }", { keys: hits.map(hit => hit._id) });
          const missingKeys = new Set(missing.map(row => row.key));
          const lines: unknown[] = [];
          for (const hit of hits) if (missingKeys.has(hit._id)) {
            if (hit._seq_no === undefined || hit._primary_term === undefined) throw new Error('Missing optimistic concurrency metadata for ES deletion');
            lines.push({ delete: { _index: index, _id: hit._id, if_seq_no: hit._seq_no, if_primary_term: hit._primary_term } });
            deleted++;
          }
          await this.bulk(lines);
          searchAfter = hits[hits.length - 1]!.sort;
          if (!searchAfter) throw new Error('Elasticsearch did not provide pagination values');
        }
      } finally {
        await this.elasticsearch.send('/_pit', { method: 'DELETE', body: JSON.stringify({ id: pitId }) }).catch(() => {});
      }
      if (deleted) await this.elasticsearch.send(`/${encodedIndex}/_refresh`, { method: 'POST' });
      this.statuses.set(database, { lastSuccessAt: new Date().toISOString(), scanned, indexed, deleted, error: null });
      return indexed + deleted;
    } catch (error) {
      this.statuses.set(database, { ...this.statuses.get(database), lastErrorAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
  start(databases: () => Promise<string[]>, onError: (error: unknown) => void = console.error) {
    let running = false, stopped = false, lastError = 0;
    const tick = async () => {
      if (running || stopped) return;
      running = true;
      try {
        const names = await databases();
        const indices = new Map<string, string>();
        for (const database of names) {
          const index = elasticsearchEntityIndexName(database);
          if (indices.has(index) && indices.get(index) !== database) throw new Error(`ArangoDB applications map to the same Elasticsearch index: ${index}`);
          indices.set(index, database);
        }
        for (const database of names) {
          if (stopped) break;
          try { await this.flush(database); }
          catch (error) { if (Date.now() - lastError > 30_000) { onError(error); lastError = Date.now(); } }
        }
      } catch (error) { if (Date.now() - lastError > 30_000) { onError(error); lastError = Date.now(); } }
      finally { running = false; }
    };
    const configured = Number(process.env.ENTITY_ES_SYNC_INTERVAL_MS || 30_000);
    const timer = setInterval(tick, Number.isFinite(configured) ? Math.max(1000, configured) : 30_000);
    timer.unref();
    void tick();
    return () => { stopped = true; clearInterval(timer); };
  }
}
