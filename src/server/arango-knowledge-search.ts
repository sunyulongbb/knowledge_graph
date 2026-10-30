import type { EnterpriseSearchOptions } from './enterprise-search.ts';
import { knowledgeReadAccess } from './enterprise-knowledge.ts';
import type { EnterpriseKnowledgeStore } from './enterprise-knowledge.ts';
import type { KnowledgeUser } from './knowledge-access.ts';

type Doc = Record<string, any>;
/** Knowledge workflows search the native index, then join current graph data. */
export class ArangoKnowledgeSearch {
  private ready = new Map<string, Promise<void>>();
  constructor(readonly store: EnterpriseKnowledgeStore) {}
  async prepare(database: string) {
    if (!this.ready.has(database)) {
      const task = this.initialize(database);
      this.ready.set(database, task);
      task.catch(() => this.ready.delete(database));
    }
    await this.ready.get(database);
  }
  private async initialize(database: string) {
    await this.store.ensure(database);
    // Upgrade old graph documents in place. This never reads SQLite or ES.
    while (true) {
      const updated = await this.store.query(database, `FOR doc IN entity FILTER doc.search_text == null LIMIT 1000
        LET texts = APPEND(APPEND(VALUES(NOT_NULL(doc.labels, {})), VALUES(NOT_NULL(doc.descriptions, {}))), FLATTEN(VALUES(NOT_NULL(doc.aliases, {}))))
        UPDATE doc WITH { search_text: CONCAT_SEPARATOR(' ', texts[*].value) } IN entity RETURN { id: NEW._key }`);
      if (updated.length < 1000) break;
    }
    const properties = { links: { entity: { includeAllFields: false, fields: {
      search_text: { analyzers: ['text_zh', 'text_en'] }, sqlite_id: { analyzers: ['identity'] }, type: { analyzers: ['identity'] },
    } } }, commitIntervalMsec: 1000 };
    try {
      const { body } = await this.store.client.database(database, '/_api/view/knowledge_search/properties');
      const analyzers = body?.links?.entity?.fields?.search_text?.analyzers || [];
      if (!analyzers.includes('text_zh') || !analyzers.includes('text_en')) {
        await this.store.client.database(database, '/_api/view/knowledge_search/properties', { method: 'PUT', body: JSON.stringify(properties) });
      }
    } catch (error: any) {
      if (error.status !== 404 || error.body?.errorNum !== 1203) throw error;
      await this.store.client.database(database, '/_api/view', { method: 'POST', body: JSON.stringify({ name: 'knowledge_search', type: 'arangosearch', ...properties }) })
        .catch((error: any) => { if (error.status !== 409) throw error; });
    }
  }
  async search(database: string, user: KnowledgeUser | null, options: EnterpriseSearchOptions) {
    if (options.classIds?.length === 0 || options.definedClasses?.length === 0 || options.definedTypes?.length === 0) return { nodes: [], total: 0 };
    await this.prepare(database);
    const access = knowledgeReadAccess(user, 'current');
    const q = String(options.q || '').trim();
    const search = q ? `SEARCH doc.sqlite_id == @q OR doc.type == @q
      OR BOOST(PHRASE(doc.search_text, @q, 'text_zh'), 2) OR PHRASE(doc.search_text, @q, 'text_en')` : 'SEARCH true';
    const ascending = options.order?.endsWith('_asc') ? 'ASC' : 'DESC';
    const sort = options.order === 'id' ? 'current.sqlite_id ASC' : options.order === 'random' ? 'RAND()'
      : options.order?.startsWith('created') ? `current.created_at_sort ${ascending}, current.sqlite_id ASC`
      : options.order && !['relevance', 'hot'].includes(options.order) ? `current.updated_at_sort ${ascending}, current.sqlite_id ASC`
      : q ? 'BM25(doc) DESC, current.updated_at_sort DESC, current.sqlite_id ASC' : 'current.updated_at_sort DESC, current.sqlite_id ASC';
    const query = `FOR doc IN knowledge_search ${search}
      LET current = DOCUMENT(doc._id)
      FILTER current != null AND ${access.filter}
        AND (@classes == null OR LENGTH(INTERSECTION(NOT_NULL(current.class_ids, []), @classes)) > 0)
        AND (@type == null OR current.type == @type) AND (!@emptyType OR current.type == null OR current.type == '')
        AND (@definedClasses == null OR LENGTH(INTERSECTION(NOT_NULL(current.class_ids, []), @definedClasses)) > 0)
        AND (@definedTypes == null OR current.type IN @definedTypes) AND current.type NOT IN @excluded
        AND (!@hasImage OR LENGTH(TO_ARRAY(IS_STRING(current.images) ? JSON_PARSE(current.images) : current.images)) > 0)
        AND (!@hasMedia OR LENGTH(TO_ARRAY(IS_STRING(current.images) ? JSON_PARSE(current.images) : current.images)) > 0
          OR LENGTH(TO_ARRAY(IS_STRING(current.videos) ? JSON_PARSE(current.videos) : current.videos)) > 0)
        AND ((@property == '' AND @value == '') OR LENGTH(FOR edge IN link FILTER edge._from == current._id
          AND (@property == '' OR edge.property_id == @property)
          AND (@value == '' OR CONTAINS(LOWER(TO_STRING(edge.value)), @value)) LIMIT 1 RETURN 1) > 0)
      SORT ${sort} LIMIT @offset, @limit RETURN current`;
    const bindVars: Doc = { ...access.bindVars, ...(q ? { q } : {}), classes: options.classIds ?? null, type: options.type || null,
      emptyType: Boolean(options.emptyType), definedClasses: options.definedClasses ?? null, definedTypes: options.definedTypes ?? null,
      excluded: options.excludeTypes || [], hasImage: Boolean(options.hasImage), hasMedia: Boolean(options.hasMedia),
      property: options.propertyId || '', value: String(options.propertyValue || '').trim().toLowerCase(), offset: options.offset, limit: options.limit };
    let { body } = await this.store.client.database(database, '/_api/cursor', { method: 'POST',
      body: JSON.stringify({ query, bindVars, batchSize: 500, options: { fullCount: true } }) });
    const nodes: Doc[] = [...(body?.result || [])];
    let total = body?.extra?.stats?.fullCount, cursor = body?.id;
    try {
      while (body?.hasMore) {
        if (!cursor) throw new Error('ArangoSearch 返回了不完整的分页结果');
        ({ body } = await this.store.client.database(database, `/_api/cursor/${encodeURIComponent(cursor)}`, { method: 'PUT' }));
        nodes.push(...(body?.result || [])); total = body?.extra?.stats?.fullCount ?? total; cursor = body?.id || cursor;
      }
    } finally {
      if (cursor) await this.store.client.database(database, `/_api/cursor/${encodeURIComponent(cursor)}`, { method: 'DELETE' }).catch(() => {});
    }
    if (!Number.isFinite(total)) throw new Error('ArangoSearch 未返回完整的结果总数');
    return { nodes, total: Number(total) };
  }
}
