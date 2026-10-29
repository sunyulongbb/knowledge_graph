import { appendVideoCoverPairs } from './video-cover-pairing.ts';
import { knowledgeMedia } from '../shared/knowledge-media.ts';
import { randomUUID } from 'node:crypto';
import {
  ArangoClient, arangoDatabaseName, configFromEnvironment,
  documentKey, entityDocument, edgeDocuments, ensureApplicationDatabase,
} from './arangodb.ts';
import { normalizeEntityTaxonomy } from '../shared/entity-taxonomy.ts';
import { normalizeDatatype, normalizeStatement, uiDatatype, valueTypeFor } from '../shared/wikidata.ts';
import { resolveRelationOrder, normalizeIncomingOrder } from './relation-order.ts';
import type { KnowledgeUser } from './knowledge-access.ts';

type Doc = Record<string, any>;
export type ImportSchema = { classes: Doc[]; ontologies: Doc[]; properties: Doc[]; ontology_properties: Doc[] };
export class KnowledgeStoreError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export const cleanKnowledgeId = (value: unknown) => String(value ?? '').replace(/^entity\//, '').trim();
const json = (value: unknown, fallback: any) => {
  if (typeof value !== 'string') return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};
export function localizedText(value: unknown): string {
  if (typeof value === 'string') return value;
  const map = (value || {}) as Doc;
  return String(map.zh?.value || map['zh-cn']?.value || map.en?.value || Object.values(map).find((v: any) => v?.value)?.value || '');
}
export function canUseArangoKnowledge(node: Doc | null, user: KnowledgeUser | null, mode: 'read' | 'edit' | 'manage' = 'read') {
  if (!node) return false;
  if (user?.fullAccess) return true;
  if (user?.ownedProjectIds?.includes(Number(node.project_id)) || user?.memberProjectIds?.includes(Number(node.project_id))) return true;
  if (user?.role === 'admin' && (mode === 'read' || !node.owner_user_id)) return true;
  if (mode === 'read' && (node.visibility || 'public') === 'public') return true;
  if (!user) return false;
  if (Number(node.owner_user_id) === user.id) return true;
  return mode !== 'manage' && (node.maintainer_ids || []).includes(user.id);
}
export function arangoNodeResponse(node: Doc, user: KnowledgeUser | null): Doc {
  const { _key, _id, _rev, sync_version, maintenance_requests, _arango_rev, _search_revision, _search_schema, search_attributes, has_images, has_media, _current_permissions, ...fields } = node;
  const id = cleanKnowledgeId(node.sqlite_id || node.id);
  const aliases = Object.values(node.aliases || {}).flatMap((v: any) => Array.isArray(v) ? v : [v]).map((v: any) => v?.value).filter(Boolean);
  const categories = node.class_ids || [];
  const { _relationGraphSnapshot, ...data } = json(node.data, {});
  const { images, covers, videos } = knowledgeMedia(node, node._search_attributes || []);
  const name = localizedText(node.labels) || node.name || '';
  const description = localizedText(node.descriptions) || node.description || '';
  return {
    ...data, ...fields, id, _id: id, name, label: name, label_zh: name,
    description, desc_zh: description, aliases, aliases_zh: aliases,
    tags: json(node.tags, []), images, image: images[0] || '', covers, cover: covers.find((value: string) => value.trim()) || '',
    videos, video: videos[0] || '', categories, categoryIds: categories,
    classes: categories.map((id: string) => ({ id, name: id })), categoryLabels: categories,
    classId: categories[0] || null, classLabel: categories[0] || null,
    typeId: node.type || null, typeLabel: node.type || '',
    relation_order: json(node.relation_order, {}), visibility: node.visibility || 'public',
    can_edit: _current_permissions?.can_edit ?? canUseArangoKnowledge(node, user, 'edit'), can_manage: _current_permissions?.can_manage ?? canUseArangoKnowledge(node, user, 'manage'),
  };
}
// This predicate stays inside AQL so pagination/counts cannot leak private entities.
const READ_FILTER = `( @full OR @admin OR doc.visibility == null OR doc.visibility == 'public'
  OR (@uid > 0 AND (doc.owner_user_id == @uid OR doc.project_id IN @projects OR @uid IN NOT_NULL(doc.maintainer_ids, []))) )`;
export class EnterpriseKnowledgeStore {
  private readonly ready = new Map<string, Promise<void>>();
  constructor(readonly client: ArangoClient) {}
  static configured() {
    const config = configFromEnvironment();
    if (!config) throw new Error('ArangoDB knowledge storage requires ARANGO_URL, ARANGO_USERNAME and ARANGO_PASSWORD');
    return new EnterpriseKnowledgeStore(new ArangoClient(config));
  }
  async query(database: string, query: string, bindVars: Doc = {}, transaction?: string): Promise<Doc[]> {
    const headers = transaction ? { 'x-arango-trx-id': transaction } : undefined;
    let { body } = await this.client.database(arangoDatabaseName(database), '/_api/cursor', {
      method: 'POST', headers, body: JSON.stringify({ query, bindVars, batchSize: 500 }),
    });
    const result = [...(body?.result || [])];
    let cursor = body?.id;
    try {
      while (body?.hasMore) {
        if (!cursor) throw new Error('ArangoDB returned an incomplete cursor');
        ({ body } = await this.client.database(database, `/_api/cursor/${encodeURIComponent(cursor)}`, { method: 'PUT', headers }));
        result.push(...(body?.result || []));
        cursor = body?.id || cursor;
      }
    } finally {
      if (cursor) await this.client.database(database, `/_api/cursor/${encodeURIComponent(cursor)}`, { method: 'DELETE', headers }).catch(() => {});
    }
    return result;
  }
  async ensure(database: string) {
    arangoDatabaseName(database);
    if (!this.ready.has(database)) {
      const promise = (async () => {
        // Validate the migrated graph; never create/rebuild it from SQLite.
        await this.client.database(database, '/_api/collection/entity');
        await this.client.database(database, '/_api/collection/link');
      })();
      this.ready.set(database, promise);
      promise.catch(() => this.ready.delete(database));
    }
    await this.ready.get(database);
  }
  async get(database: string, id: string, transaction?: string): Promise<Doc | null> {
    try {
      const { body } = await this.client.database(database, `/_api/document/entity/${documentKey(cleanKnowledgeId(id))}`, {
        headers: transaction ? { 'x-arango-trx-id': transaction } : undefined,
      });
      return body;
    } catch (error: any) { if (error.status === 404) return null; throw error; }
  }
  async require(database: string, id: string, user: KnowledgeUser | null, mode: 'read' | 'edit' | 'manage' = 'read', trx?: string) {
    const node = await this.get(database, id, trx);
    if (!canUseArangoKnowledge(node, user, mode)) throw new KnowledgeStoreError(mode === 'read' ? '知识不存在或无权访问' : '无权修改该知识', mode === 'read' ? 404 : 403);
    return node!;
  }
  async importSchema(database: string, trx?: string): Promise<ImportSchema | null> {
    try {
      const { body } = await this.client.database(database, '/_api/document/knowledge_schema/definitions', {
        headers: trx ? { 'x-arango-trx-id': trx } : undefined,
      });
      return body?.classes && body?.ontologies && body?.properties ? body : null;
    } catch (error: any) {
      if (error.status === 404 && [1202, 1203].includes(error.body?.errorNum)) return null;
      throw error;
    }
  }
  async ensureImportSchema(database: string) {
    try { await this.ensure(database); }
    catch (error: any) {
      if (error.status !== 404 || ![1203, 1228].includes(error.body?.errorNum)) throw error;
      // An explicit import can initialize an application's empty graph directly.
      await ensureApplicationDatabase(this.client, database);
      this.ready.delete(database);
      await this.ensure(database);
    }
    try { await this.client.database(database, '/_api/collection/knowledge_schema'); }
    catch (error: any) {
      if (error.status !== 404 || error.body?.errorNum !== 1203) throw error;
      await this.client.database(database, '/_api/collection', {
        method: 'POST', body: JSON.stringify({ name: 'knowledge_schema', type: 2 }),
      }).catch((error: any) => { if (error.status !== 409) throw error; });
    }
  }
  async transaction<T>(database: string, work: (id: string) => Promise<T>, extraCollections: string[] = []): Promise<T> {
    await this.ensure(database);
    const { body } = await this.client.database(database, '/_api/transaction/begin', {
      method: 'POST', body: JSON.stringify({ collections: { exclusive: ['entity', 'link', ...extraCollections] }, waitForSync: true, lockTimeout: 10 }),
    });
    const id = body?.result?.id;
    if (!id) throw new Error('ArangoDB transaction did not return an ID');
    try {
      const result = await work(id);
      await this.client.database(database, `/_api/transaction/${id}`, { method: 'PUT' });
      return result;
    } catch (error) {
      await this.client.database(database, `/_api/transaction/${id}`, { method: 'DELETE' }).catch(() => {});
      throw error;
    }
  }
  private async touch(database: string, node: Doc, user: KnowledgeUser, trx: string) {
    const now = new Date().toISOString();
    const changes = { updated_at: now, updated_at_sort: now, updated_by_user_id: user.id };
    await this.client.database(database, `/_api/document/entity/${node._key}`, { method: 'PATCH', headers: { 'x-arango-trx-id': trx }, body: JSON.stringify(changes) });
    return { ...node, ...changes };
  }
  async searchAccess(database: string, user: KnowledgeUser | null) {
    const rows = await this.query(database, `FOR doc IN entity FILTER ${READ_FILTER}
      RETURN { _key: doc._key, id: doc.sqlite_id || doc.id, owner_user_id: doc.owner_user_id,
        project_id: doc.project_id, visibility: doc.visibility, maintainer_ids: doc.maintainer_ids }`, {
      full: Boolean(user?.fullAccess), admin: user?.role === 'admin', uid: user?.id || -1,
      projects: [...(user?.ownedProjectIds || []), ...(user?.memberProjectIds || [])],
    });
    return rows.map(node => ({ key: String(node._key), id: String(node.id),
      can_edit: canUseArangoKnowledge(node, user, 'edit'), can_manage: canUseArangoKnowledge(node, user, 'manage') }));
  }
  async list(database: string, user: KnowledgeUser | null, options: Doc) {
    const binds: Doc = {
      full: Boolean(user?.fullAccess), admin: user?.role === 'admin', uid: user?.id || -1,
      projects: [...(user?.ownedProjectIds || []), ...(user?.memberProjectIds || [])],
      q: String(options.q || '').toLowerCase(), classId: options.classId || '', type: options.type || '',
      limit: options.limit, offset: options.offset,
      emptyType: Boolean(options.emptyType), hasImage: Boolean(options.hasImage), hasMedia: Boolean(options.hasMedia),
      propertyId: options.propertyId || '', propertyValue: String(options.propertyValue || '').toLowerCase(),
      definedClasses: options.definedClasses ?? null, definedTypes: options.definedTypes ?? null,
    };
    const predicate = `${READ_FILTER}
      AND (@q == '' OR CONTAINS(LOWER(TO_STRING(VALUES(NOT_NULL(doc.labels, {}))[*].value)), @q) OR CONTAINS(LOWER(TO_STRING(VALUES(NOT_NULL(doc.descriptions, {}))[*].value)), @q) OR CONTAINS(LOWER(TO_STRING(FLATTEN(VALUES(NOT_NULL(doc.aliases, {})))[*].value)), @q) OR CONTAINS(LOWER(TO_STRING(doc.sqlite_id)), @q))
      AND (@classId == '' OR @classId IN NOT_NULL(doc.class_ids, [])) AND (@type == '' OR doc.type == @type)
      AND (!@emptyType OR doc.type == null OR doc.type == '')
      AND (@definedClasses == null OR LENGTH(INTERSECTION(NOT_NULL(doc.class_ids, []), NOT_NULL(@definedClasses, []))) > 0)
      AND (@definedTypes == null OR doc.type IN NOT_NULL(@definedTypes, []))
      AND (!@hasImage OR LENGTH(TO_ARRAY(IS_STRING(doc.images) ? JSON_PARSE(doc.images) : doc.images)) > 0)
      AND (!@hasMedia OR LENGTH(TO_ARRAY(IS_STRING(doc.images) ? JSON_PARSE(doc.images) : doc.images)) > 0 OR LENGTH(TO_ARRAY(IS_STRING(doc.videos) ? JSON_PARSE(doc.videos) : doc.videos)) > 0)
      AND ((@propertyId == '' AND @propertyValue == '') OR LENGTH(FOR edge IN link
        FILTER edge._from == doc._id AND (@propertyId == '' OR edge.property_id == @propertyId)
          AND (@propertyValue == '' OR CONTAINS(LOWER(TO_STRING(edge.value)), @propertyValue)) LIMIT 1 RETURN 1) > 0)`;
    const sort = options.order === 'random' ? 'RAND()' : options.order === 'id' ? 'doc.sqlite_id ASC' : options.order === 'created_asc' ? 'doc.created_at ASC' : options.order === 'created_desc' ? 'doc.created_at DESC' : ['updated_asc', 'modified_asc'].includes(options.order) ? 'doc.updated_at ASC' : 'doc.updated_at DESC';
    const rows = await this.query(database, `LET total = LENGTH(FOR doc IN entity FILTER ${predicate} RETURN 1)
      LET nodes = (FOR doc IN entity FILTER ${predicate} SORT ${sort}, doc._key ASC LIMIT @offset, @limit RETURN doc)
      RETURN { total, nodes }`, binds);
    return rows[0] || { total: 0, nodes: [] };
  }
  async summary(database: string, user: KnowledgeUser | null) {
    const bindVars = { full: Boolean(user?.fullAccess), admin: user?.role === 'admin', uid: user?.id || -1,
      projects: [...(user?.ownedProjectIds || []), ...(user?.memberProjectIds || [])] };
    const rows = await this.query(database, `LET types = UNIQUE(FOR doc IN entity FILTER ${READ_FILTER} AND doc.type != null AND doc.type != '' RETURN doc.type)
      LET entities = LENGTH(FOR doc IN entity FILTER ${READ_FILTER} RETURN 1)
      LET attributes = LENGTH(FOR edge IN link LET doc = DOCUMENT(edge._from)
        FILTER doc != null AND ${READ_FILTER} COLLECT id = edge.sqlite_id RETURN id)
      LET categories = (FOR doc IN entity FILTER ${READ_FILTER}
        FOR classId IN NOT_NULL(doc.class_ids, []) COLLECT id = classId WITH COUNT INTO count RETURN { id, count })
      RETURN { types, entities, attributes, categories }`, bindVars);
    return rows[0]!;
  }
  async mediaReadable(database: string, path: string, user: KnowledgeUser | null) {
    const rows = await this.query(database, `FOR doc IN entity FILTER ${READ_FILTER}
      FILTER CONTAINS(TO_STRING([doc.images, doc.covers, doc.videos, doc.pdf, doc.data, doc.wiki_md]), @path)
        OR LENGTH(FOR edge IN link FILTER edge._from == doc._id AND CONTAINS(TO_STRING(edge.value), @path) LIMIT 1 RETURN 1) > 0
      LIMIT 1 RETURN 1`, { full: Boolean(user?.fullAccess), admin: user?.role === 'admin', uid: user?.id || -1,
      projects: [...(user?.ownedProjectIds || []), ...(user?.memberProjectIds || [])], path });
    return rows.length > 0;
  }
  async create(database: string, projectId: number, input: Doc, user: KnowledgeUser) {
    return this.transaction(database, async trx => {
      const id = cleanKnowledgeId(input.id || randomUUID());
      if (!id || id.length > 512) throw new KnowledgeStoreError('无效的知识 ID');
      if (await this.get(database, id, trx)) throw new KnowledgeStoreError('知识 ID 已存在', 409);
      const node = this.patch(null, { ...input, id }, projectId, user);
      await this.client.database(database, '/_api/document/entity', { method: 'POST', headers: { 'x-arango-trx-id': trx }, body: JSON.stringify(node) });
      return node;
    });
  }
  patch(previous: Doc | null, input: Doc, projectId: number, user: KnowledgeUser): Doc {
    const taxonomy = normalizeEntityTaxonomy(input);
    const id = cleanKnowledgeId(previous?.sqlite_id || previous?.id || input.id);
    const now = new Date().toISOString();
    const row: Doc = previous ? { ...previous, id, name: previous.labels, description: previous.descriptions } : {
      id, project_id: projectId, visibility: 'public', owner_user_id: user.id || null,
      creator_username: user.username, created_at: now, name: '', description: '', aliases: {},
    };
    for (const key of ['name', 'description', 'aliases', 'link', 'pdf', 'wiki_md']) {
      if (input[key] !== undefined) row[key] = input[key];
    }
    for (const key of ['images', 'covers', 'videos']) {
      if (input[key] !== undefined) {
        if (!Array.isArray(input[key]) || input[key].some((v: unknown) => typeof v !== 'string')) throw new KnowledgeStoreError(`${key} 必须是字符串数组`);
        const append = input[`append${key[0]!.toUpperCase()}${key.slice(1)}`] === true;
        row[key] = JSON.stringify(append ? [...new Set([...json(previous?.[key], []), ...input[key]])] : input[key]);
      }
    }
    if (input.appendVideos === true && input.appendCovers === true && input.videos !== undefined && input.covers !== undefined) {
      const paired = appendVideoCoverPairs(json(previous?.videos, []), json(previous?.covers, []), input.videos, input.covers);
      row.videos = JSON.stringify(paired.videos);
      row.covers = JSON.stringify(paired.covers);
    }
    if (input.mentions !== undefined) {
      if (!input.mentions || typeof input.mentions !== 'object' || Array.isArray(input.mentions)) throw new KnowledgeStoreError('mentions 必须是对象');
      row.data = JSON.stringify({ ...json(previous?.data, {}), mentions: input.mentions });
    }
    if (input.visibility !== undefined) {
      if (!['public', 'private'].includes(input.visibility)) throw new KnowledgeStoreError('无效的可见性');
      row.visibility = input.visibility;
    }
    if (taxonomy.hasCategories) row.classification_initialized = true;
    if (taxonomy.hasType) row.type = taxonomy.typeId;
    if (taxonomy.hasTags) row.tags = JSON.stringify(taxonomy.tags);
    if (input.relation_order !== undefined) row.relation_order = JSON.stringify(input.relation_order);
    row.updated_at = now;
    row.updated_by_user_id = user.id;
    const { _id, _rev, ...document } = entityDocument(row, undefined, taxonomy.hasCategories ? taxonomy.categoryIds : previous?.class_ids || []) as Doc;
    return document;
  }
  async update(database: string, id: string, input: Doc, user: KnowledgeUser) {
    return this.transaction(database, async trx => {
      const previous = await this.require(database, id, user, 'edit', trx);
      if (input.visibility !== undefined && !canUseArangoKnowledge(previous, user, 'manage')) throw new KnowledgeStoreError('仅管理者可修改可见性', 403);
      const node = this.patch(previous, input, previous.project_id, user);
      await this.client.database(database, `/_api/document/entity/${node._key}`, { method: 'PUT', headers: { 'x-arango-trx-id': trx }, body: JSON.stringify(node) });
      return node;
    });
  }
  async remove(database: string, id: string, user: KnowledgeUser) {
    return this.transaction(database, async trx => {
      const node = await this.require(database, id, user, 'manage', trx);
      // Incoming statements reference this entity; removing the vertex must not silently
      // delete another owner's statements. Their edges are cleaned, statements retained.
      await this.query(database, 'FOR edge IN link FILTER edge._from == @vertex OR edge._to == @vertex REMOVE edge IN link', { vertex: `entity/${node._key}` }, trx);
      await this.client.database(database, `/_api/document/entity/${node._key}`, { method: 'DELETE', headers: { 'x-arango-trx-id': trx } });
    });
  }
  async attributes(database: string, nodeId: string, trx?: string): Promise<Doc[]> {
    const id = cleanKnowledgeId(nodeId);
    // Migrated link documents include literal self-edges and full Wikibase statements.
    const links = await this.query(database, 'FOR edge IN link FILTER edge._from == @vertex RETURN edge', { vertex: `entity/${documentKey(id)}` }, trx);
    const result = new Map<string, Doc>();
    const grouped = new Map<string, Doc[]>();
    for (const edge of links) {
      const attrId = String(edge.sqlite_id || edge._key);
      if (!result.has(attrId)) grouped.set(attrId, [...(grouped.get(attrId) || []), edge]);
    }
    for (const [attrId, edges] of grouped) {
      const edge = edges[0]!;
      if (edge.attribute) {
        result.set(attrId, { ...edge.attribute, id: attrId, node_id: id });
        continue;
      }
      const values = edges.map(e => e.mainsnak?.datavalue?.value ?? e.value);
      const value = values.length === 1 ? values[0] : values;
      result.set(attrId, {
        id: attrId, node_id: id, key: edge.property_id, datatype: edge.mainsnak?.datatype || edge.datatype || 'string',
        value: JSON.stringify(value), property_name_snapshot: edge.property_name,
        statement_json: JSON.stringify({ property: edge.property_id, datatype: edge.mainsnak?.datatype || edge.datatype,
          snaktype: edge.mainsnak?.snaktype || edge.snaktype || 'value', rank: edge.rank || 'normal',
          qualifiers: edge.qualifiers || {}, references: edge.references || [], datavalue: { type: edge.mainsnak?.datavalue?.type, value } }),
      });
    }
    return [...result.values()];
  }
  async saveAttribute(database: string, input: Doc, user: KnowledgeUser) {
    const nodeId = cleanKnowledgeId(input.node_id || input.entity_id);
    if (!nodeId) throw new KnowledgeStoreError('缺少知识 ID');
    const property = String(input.property || input.prop || '').trim();
    if (!property) throw new KnowledgeStoreError('缺少属性');
    return this.transaction(database, async trx => {
      const node = await this.require(database, nodeId, user, 'edit', trx);
      const attrs = await this.attributes(database, nodeId, trx);
      const id = String(input.id || `attr/${randomUUID()}`);
      const existing = attrs.find(a => a.id === id);
      // A global attribute ID may not be moved between owners/entities.
      const oldEdges = await this.query(database, 'FOR edge IN link FILTER edge.sqlite_id == @id AND edge._from != @vertex RETURN 1', { id, vertex: `entity/${node._key}` }, trx);
      if (oldEdges.length) throw new KnowledgeStoreError('属性 ID 已被其他知识使用', 409);
      let statement: Doc;
      try { statement = normalizeStatement({ ...input, property, datatype: normalizeDatatype(input.datatype || existing?.datatype || 'string') }, json(existing?.statement_json, {})); }
      catch (error) { throw new KnowledgeStoreError(error instanceof Error ? error.message : '无效的属性值'); }
      if (Array.isArray(statement.datavalue?.value) && !statement.datavalue.value.length) throw new KnowledgeStoreError('属性值数组不能为空');
      const attr = {
        _key: documentKey(id), id, node_id: nodeId, key: property, value: JSON.stringify(statement.datavalue?.value ?? null),
        datatype: uiDatatype(statement.datatype), property_name_snapshot: String(input.property_name_snapshot || input.property_label_zh || existing?.property_name_snapshot || property),
        statement_json: JSON.stringify(statement), created_at: existing?.created_at || new Date().toISOString(),
      };
      await this.query(database, 'FOR edge IN link FILTER edge.sqlite_id == @id AND edge._from == @vertex REMOVE edge IN link', { id, vertex: `entity/${node._key}` }, trx);
      for (const edge of edgeDocuments({ id: nodeId }, [attr])) {
        await this.client.database(database, '/_api/document/link', { method: 'POST', headers: { 'x-arango-trx-id': trx }, body: JSON.stringify(edge) });
      }
      const updated = { ...node, updated_at: new Date().toISOString(), updated_at_sort: new Date().toISOString(), updated_by_user_id: user.id };
      await this.client.database(database, `/_api/document/entity/${node._key}`, { method: 'PATCH', headers: { 'x-arango-trx-id': trx }, body: JSON.stringify({ updated_at: updated.updated_at, updated_at_sort: updated.updated_at_sort, updated_by_user_id: user.id }) });
      return attr;
    });
  }
  async removeAttribute(database: string, attributeId: string, user: KnowledgeUser) {
    return this.transaction(database, async trx => {
      const rows = await this.query(database, 'FOR e IN link FILTER e.sqlite_id == @id LIMIT 1 RETURN e.source_id', { id: attributeId }, trx);
      const nodeId = rows[0] as unknown as string;
      if (!nodeId) throw new KnowledgeStoreError('属性不存在', 404);
      const node = await this.require(database, nodeId, user, 'edit', trx);
      await this.query(database, 'FOR e IN link FILTER e.sqlite_id == @id AND e._from == @vertex REMOVE e IN link', { id: attributeId, vertex: `entity/${node._key}` }, trx);
      await this.touch(database, node, user, trx);
    });
  }
  async classify(database: string, id: string, classId: string, remove: boolean, user: KnowledgeUser) {
    return this.transaction(database, async trx => {
      const node = await this.require(database, id, user, 'edit', trx);
      const classes = new Set<string>(node.class_ids || []);
      if (remove && !classId) classes.clear();
      else if (remove) classes.delete(classId);
      else classes.add(classId);
      const next = { ...node, class_ids: [...classes], classification_initialized: true };
      await this.client.database(database, `/_api/document/entity/${node._key}`, { method: 'PATCH', headers: { 'x-arango-trx-id': trx }, body: JSON.stringify({ class_ids: next.class_ids, classification_initialized: true }) });
      await this.touch(database, next, user, trx);
      return next;
    });
  }
  async maintenance(database: string, id: string, action: string, input: Doc, user: KnowledgeUser) {
    return this.transaction(database, async trx => {
      const node = await this.require(database, id, user, action === 'request' ? 'read' : 'manage', trx);
      const requests: Doc = { ...(node.maintenance_requests || {}) };
      const maintainers = new Set<number>(node.maintainer_ids || []);
      const now = new Date().toISOString();
      if (action === 'request') {
        if (canUseArangoKnowledge(node, user, 'edit')) throw new KnowledgeStoreError('你已拥有维护权限', 409);
        const message = String(input.message || '').trim();
        if (message.length > 1000) throw new KnowledgeStoreError('申请说明不能超过 1000 字');
        requests[String(user.id)] = { user_id: user.id, username: user.username, message, status: 'pending', created_at: now };
      } else {
        const target = Number(input.user_id);
        if (!Number.isSafeInteger(target) || target <= 0) throw new KnowledgeStoreError('无效的用户');
        const previous = requests[String(target)];
        if (action !== 'remove' && !['approve', 'reject'].includes(input.decision)) throw new KnowledgeStoreError('请选择批准或拒绝');
        if (action !== 'remove' && previous?.status !== 'pending') throw new KnowledgeStoreError('申请不存在或已处理', 409);
        if (action === 'remove') maintainers.delete(target);
        else if (input.decision === 'approve') maintainers.add(target);
        requests[String(target)] = { ...previous, user_id: target, reviewed_by: user.id, reviewed_at: now,
          status: action === 'remove' ? 'revoked' : input.decision === 'approve' ? 'approved' : 'rejected' };
      }
      const changes = { maintainer_ids: [...maintainers], maintenance_requests: requests, updated_at: now, updated_at_sort: now, updated_by_user_id: user.id };
      await this.client.database(database, `/_api/document/entity/${node._key}`, { method: 'PATCH', headers: { 'x-arango-trx-id': trx }, body: JSON.stringify(changes) });
    });
  }
  async reorder(database: string, id: string, input: Doc, user: KnowledgeUser) {
    return this.transaction(database, async trx => {
      const node = await this.require(database, id, user, 'edit', trx);
      const attrs = (await this.attributes(database, id, trx)).map(arangoAttributeResponse);
      let order: Doc;
      if (input.kind === 'incoming') {
        const incoming = normalizeIncomingOrder(input.incoming);
        if (!incoming.groups.length && !Object.keys(incoming.items).length && !Object.keys(incoming.children).length) throw new KnowledgeStoreError('排序数据无效');
        order = { ...json(node.relation_order, {}), incoming };
      } else {
        if (!['property', 'value'].includes(input.kind) || !['before', 'after'].includes(input.placement) || typeof input.source !== 'string' || typeof input.target !== 'string') throw new KnowledgeStoreError('排序参数无效');
        order = resolveRelationOrder(attrs, node.relation_order);
        const key = order.properties.find((key: string) => order.values[key].includes(input.source));
        const sequence = input.kind === 'property' ? order.properties : key !== undefined ? order.values[key] : undefined;
        if (!sequence?.includes(input.source) || !sequence.includes(input.target)) throw new KnowledgeStoreError('属性或属性值已变化，请刷新后重试', 409);
        if (input.source !== input.target) {
          sequence.splice(sequence.indexOf(input.source), 1);
          sequence.splice(sequence.indexOf(input.target) + (input.placement === 'after' ? 1 : 0), 0, input.source);
        }
      }
      const next = { ...node, relation_order: JSON.stringify(order), updated_at: new Date().toISOString(), updated_by_user_id: user.id };
      await this.client.database(database, `/_api/document/entity/${node._key}`, { method: 'PATCH', headers: { 'x-arango-trx-id': trx }, body: JSON.stringify({ relation_order: next.relation_order, updated_at: next.updated_at, updated_by_user_id: user.id }) });
      await this.touch(database, next, user, trx);
      return order;
    });
  }
  async removeRelation(database: string, edgeId: string, user: KnowledgeUser) {
    const separator = edgeId.lastIndexOf(':');
    if (separator < 1) throw new KnowledgeStoreError('无效的关系 ID');
    const attributeId = edgeId.slice(0, separator), targetId = cleanKnowledgeId(edgeId.slice(separator + 1));
    return this.transaction(database, async trx => {
      const matches = await this.query(database, 'FOR edge IN link FILTER edge.sqlite_id == @id AND edge.target_id == @target RETURN edge', { id: attributeId, target: targetId }, trx);
      if (!matches.length) throw new KnowledgeStoreError('关系不存在', 404);
      const nodeId = matches[0]!.source_id;
      const node = await this.require(database, nodeId, user, 'edit', trx);
      const attr = (await this.attributes(database, nodeId, trx)).find(attr => attr.id === attributeId);
      if (!attr) throw new KnowledgeStoreError('关系属性不存在', 404);
      const value = json(attr.value, null);
      const values = (Array.isArray(value) ? value : [value]).filter(item => cleanKnowledgeId(item?.id || item?.value?.id || item) !== targetId);
      await this.query(database, 'FOR edge IN link FILTER edge.sqlite_id == @id AND edge._from == @vertex REMOVE edge IN link', { id: attributeId, vertex: `entity/${node._key}` }, trx);
      if (values.length) {
        const statement = normalizeStatement({ ...json(attr.statement_json, {}), value: values, datavalue: undefined });
        const next: Doc = { ...attr, _key: documentKey(attributeId), value: JSON.stringify(values), statement_json: JSON.stringify(statement) };
        const { _id, _rev, ...document } = next;
        for (const edge of edgeDocuments({ id: nodeId }, [document as any])) await this.client.database(database, '/_api/document/link', { method: 'POST', headers: { 'x-arango-trx-id': trx }, body: JSON.stringify(edge) });
      }
      await this.touch(database, node, user, trx);
    });
  }
  async relations(database: string, id: string, user: KnowledgeUser | null, direction = 'both') {
    await this.require(database, id, user);
    const vertex = `entity/${documentKey(cleanKnowledgeId(id))}`;
    const rows = await this.query(database, `FOR edge IN link
      FILTER edge._from != edge._to AND ((@outgoing AND edge._from == @vertex) OR (@incoming AND edge._to == @vertex))
      LET source = DOCUMENT(edge._from) LET target = DOCUMENT(edge._to)
      FILTER source != null AND target != null RETURN { edge, source, target }`, { vertex, outgoing: direction !== 'incoming', incoming: direction !== 'outgoing' });
    return rows.filter(row => canUseArangoKnowledge(row.source, user) && canUseArangoKnowledge(row.target, user));
  }
}
export function arangoAttributeResponse(attr: Doc) {
  const statement = json(attr.statement_json, {});
  const datatype = normalizeDatatype(statement.datatype || attr.datatype);
  const value = json(attr.value, attr.value);
  return {
    id: attr.id, node_id: attr.node_id, property: attr.key, property_label_zh: attr.property_name_snapshot || attr.key,
    datatype, ui_datatype: uiDatatype(datatype), value, snaktype: statement.snaktype || 'value',
    rank: statement.rank || 'normal', qualifiers: statement.qualifiers || {}, references: statement.references || [], value_thumbnails: [],
    datavalue: statement.snaktype && statement.snaktype !== 'value' ? undefined : { type: valueTypeFor(datatype), value },
  };
}

export { ArangoElasticsearchSync } from './entity-elasticsearch-sync.ts';
