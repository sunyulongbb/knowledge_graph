import { randomUUID } from 'node:crypto';
import { edgeDocuments } from './arangodb.ts';
import { EntityImportError, parseEntityImports } from './entity-import.ts';
import { canUseArangoKnowledge, cleanKnowledgeId, KnowledgeStoreError, localizedText } from './enterprise-knowledge.ts';
import type { EnterpriseKnowledgeStore, ImportSchema } from './enterprise-knowledge.ts';
import type { KnowledgeUser } from './knowledge-access.ts';
import { normalizeValue, uiDatatype, valueTypeFor } from '../shared/wikidata.ts';

type Doc = Record<string, any>;
const key = (value: unknown) => String(value || '').trim().toLocaleLowerCase();
const array = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};

/** Import knowledge directly into one ArangoDB transaction; SQLite is never opened. */
export async function importEnterpriseEntities(
  store: EnterpriseKnowledgeStore, database: string, projectId: number, input: unknown, user: KnowledgeUser,
  legacySchema?: () => Partial<ImportSchema> | undefined,
) {
  const entities = parseEntityImports(input);
  const ids = new Set<string>();
  for (const entity of entities) {
    entity.id ||= randomUUID();
    if (entity.id.length > 512) throw new EntityImportError('无效的知识 ID');
    if (ids.has(entity.id)) throw new EntityImportError(`批量文件包含重复实体 ID：${entity.id}`);
    ids.add(entity.id);
  }
  await store.ensureImportSchema(database);
  return store.transaction(database, async trx => {
    const savedSchema = await store.importSchema(database, trx);
    // Read legacy definitions only once for compatibility; imported knowledge
    // and all subsequent schema changes in this importer are Arango-authoritative.
    const seed = savedSchema ? undefined : legacySchema?.();
    const schema: ImportSchema = structuredClone(savedSchema || {
      classes: seed?.classes || [], ontologies: seed?.ontologies || [],
      properties: seed?.properties || [], ontology_properties: seed?.ontology_properties || [],
    });
    schema.ontology_properties ||= [];
    const headers = { 'x-arango-trx-id': trx };
    const write = async (collection: string, documents: Doc[]) => {
      for (let offset = 0; offset < documents.length; offset += 250) {
        const { body } = await store.client.database(database, `/_api/document/${collection}?overwriteMode=replace`, {
          method: 'POST', headers, body: JSON.stringify(documents.slice(offset, offset + 250)),
        });
        if (!Array.isArray(body) || body.some(row => row.error)) throw new Error(`ArangoDB ${collection} 批量写入失败`);
      }
    };
    const nodes = new Map<string, Doc>();
    const previous = new Map<string, Doc | null>();
    const incoming = new Map<string, typeof entities>();
    for (const entity of entities) {
      const old = await store.get(database, entity.id, trx);
      if (old && !canUseArangoKnowledge(old, user, 'edit')) throw new KnowledgeStoreError('无权修改该知识', 403);
      if (old && old.visibility !== entity.visibility && !canUseArangoKnowledge(old, user, 'manage')) {
        throw new KnowledgeStoreError('仅管理者可修改可见性', 403);
      }
      previous.set(entity.id, old);
      for (const label of new Set([entity.id, entity.name, ...entity.aliases].map(key))) {
        incoming.set(label, [...(incoming.get(label) || []), entity]);
      }
    }
    const ensureOntology = (definition: Doc) => {
      let ontology = (definition.id && schema.ontologies.find(row => row.id === definition.id))
        || schema.ontologies.find(row => key(row.name) === key(definition.name));
      const created = !ontology;
      if (!ontology) {
        ontology = { ...definition, id: definition.id || `ontology/${randomUUID()}`, alias: [definition.name],
          parent_id: null, project_id: projectId, display_shape: 'rectangle', sort_order: schema.ontologies.length + 1 };
        schema.ontologies.push(ontology);
      }
      ontology.status = 'active';
      return { ontology, created };
    };
    const results: Doc[] = [];
    for (const entity of entities) {
      const { ontology, created } = ensureOntology(entity.ontology);
      let categoriesCreated = 0, categoriesUpdated = 0;
      const categoryIds: string[] = [], categoryTags: string[] = [];
      const category = (definition: typeof entity.categories[number], parentId: string | null) => {
        let row = schema.classes.find(row => (row.parent_id || null) === parentId && key(row.name) === key(definition.name));
        if (row) {
          for (const field of definition.provided) if (['description', 'color', 'image', 'tags'].includes(field)) row[field] = (definition as any)[field];
          categoriesUpdated++;
        } else {
          row = { id: `class/${randomUUID()}`, name: definition.name, description: definition.description,
            color: definition.color, image: definition.image, tags: definition.tags,
            parent_id: parentId, project_id: projectId, sort_order: schema.classes.length + 1 };
          schema.classes.push(row);
          categoriesCreated++;
        }
        categoryIds.push(row.id);
        categoryTags.push(...array(row.tags));
        for (const child of definition.children) category(child, row.id);
      };
      for (const definition of entity.categories) category(definition, null);
      nodes.set(entity.id, store.patch(previous.get(entity.id)!, {
        id: entity.id, name: entity.name, description: entity.description, aliases: entity.aliases,
        typeId: ontology.id, tags: [...new Map([...entity.tags, ...categoryTags].map(tag => [key(tag), tag])).values()],
        images: entity.images, videos: entity.videos, pdf: entity.pdf, link: entity.link, visibility: entity.visibility,
        ...(entity.hasCategories ? { categoryIds } : {}),
      }, projectId, user));
      results.push({ entityId: entity.id, entityCreated: !previous.get(entity.id), entityUpdated: Boolean(previous.get(entity.id)),
        ontologyId: ontology.id, ontologyCreated: created, propertiesCreated: 0, attributesCreated: 0, attributesUpdated: 0,
        referencedEntitiesCreated: 0, referencedEntitiesMatched: 0, categoriesCreated, categoriesUpdated, categoriesLinked: categoryIds.length });
    }
    // Cache only readable candidates; private knowledge must not leak through label matching.
    const references = new Map<string, Doc>();
    for (const [index, entity] of entities.entries()) {
      const result = results[index]!;
      const resolveReference = async (value: any): Promise<any> => {
        if (Array.isArray(value)) {
          const resolved = [];
          for (const item of value) resolved.push(await resolveReference(item));
          return resolved;
        }
        const id = cleanKnowledgeId(value.id);
        const labels = [value.label_zh, value.entity_label_zh, value.label, value.name].filter(Boolean).map(String);
        let target = id ? nodes.get(id) || references.get(id) || await store.get(database, id, trx) : null;
        if (target && !canUseArangoKnowledge(target, user, 'read')) throw new KnowledgeStoreError('引用的知识不存在或无权访问', 403);
        if (!target && labels.length) {
          const candidates = await store.query(database, `FOR doc IN entity
            LET names = APPEND(VALUES(NOT_NULL(doc.labels, {}))[*].value, FLATTEN(VALUES(NOT_NULL(doc.aliases, {})))[*].value)
            FILTER LENGTH(INTERSECTION(@labels, (FOR name IN names RETURN LOWER(TRIM(name))))) > 0 RETURN doc`,
          { labels: labels.map(key) }, trx);
          target = candidates.find(node => canUseArangoKnowledge(node, user, 'read')) || null;
        }
        if (!target) {
          const candidates = new Map<string, Doc>();
          for (const label of [id, ...labels]) for (const candidate of incoming.get(key(label)) || []) candidates.set(candidate.id, candidate);
          if (candidates.size === 1) target = nodes.get([...candidates.keys()][0]!) || null;
        }
        if (!target) target = [...references.values()].find(node => labels.some(label => key(localizedText(node.labels)) === key(label))) || null;
        if (target) result.referencedEntitiesMatched++;
        else {
          const referenceId = id || `reference-${randomUUID()}`;
          if (referenceId.length > 512) throw new EntityImportError('无效的引用实体 ID');
          const { ontology } = ensureOntology({ id: 'ontology/wikibase-item', name: '实体条目', description: '由实体导入中的 wikibase-item 属性值自动创建' });
          target = store.patch(null, { id: referenceId, name: labels[0] || referenceId, typeId: ontology.id,
            description: `由实体属性引用自动创建（${referenceId}）`, visibility: entity.visibility,
            link: `https://www.wikidata.org/wiki/${encodeURIComponent(referenceId)}` }, projectId, user);
          references.set(referenceId, target);
          result.referencedEntitiesCreated++;
        }
        return { ...value, id: target.sqlite_id || target.id, label_zh: value.label_zh || localizedText(target.labels), 'entity-type': 'item' };
      };
      const attrs = await store.attributes(database, entity.id, trx);
      const existingKeys = new Set(attrs.map(attr => attr.key));
      const replacements = new Map<string, Parameters<typeof edgeDocuments>[1][number]>();
      for (const attribute of entity.attributes) {
        let property = (attribute.id && schema.properties.find(row => row.id === attribute.id))
          || schema.properties.find(row => key(row.name) === key(attribute.name));
        if (!property) {
          property = { id: attribute.id || `property/${randomUUID()}`, name: attribute.name, alias: [attribute.name],
            description: attribute.description, project_id: projectId };
          schema.properties.push(property);
          result.propertiesCreated++;
        }
        Object.assign(property, { datatype: attribute.datatype, valuetype: valueTypeFor(attribute.datatype), status: 'active' });
        if (!schema.ontology_properties.some(row => row.ontology_id === result.ontologyId && row.property_id === property.id)) {
          schema.ontology_properties.push({ ontology_id: result.ontologyId, property_id: property.id });
        }
        const value = normalizeValue(attribute.datatype, attribute.datatype === 'wikibase-item' ? await resolveReference(attribute.value) : attribute.value);
        if (existingKeys.has(property.id) || replacements.has(property.id)) result.attributesUpdated++;
        else result.attributesCreated++;
        replacements.set(property.id, { id: `attr/${randomUUID()}`, node_id: entity.id, key: property.id,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value), datatype: uiDatatype(attribute.datatype),
          property_name_snapshot: property.name, statement_json: JSON.stringify({ property: property.id, datatype: attribute.datatype, snaktype: 'value', value }), created_at: new Date().toISOString() });
      }
      if (replacements.size) {
        await store.query(database, 'FOR edge IN link FILTER edge._from == @vertex AND edge.property_id IN @properties REMOVE edge IN link',
          { vertex: `entity/${nodes.get(entity.id)!._key}`, properties: [...replacements.keys()] }, trx);
        await write('link', edgeDocuments({ id: entity.id }, [...replacements.values()]));
      }
    }
    await write('entity', [...nodes.values(), ...references.values()]);
    await write('knowledge_schema', [{ _key: 'definitions', ...schema }]);
    if (results.length === 1) return results[0]!;
    const totals: Doc = {};
    for (const field of ['propertiesCreated', 'attributesCreated', 'attributesUpdated', 'referencedEntitiesCreated', 'referencedEntitiesMatched', 'categoriesCreated', 'categoriesUpdated', 'categoriesLinked']) {
      totals[field] = results.reduce((sum, result) => sum + result[field], 0);
    }
    return { batch: true, total: results.length, created: results.filter(row => row.entityCreated).length,
      updated: results.filter(row => row.entityUpdated).length, entityId: results[0]!.entityId,
      entityIds: results.map(row => row.entityId), entities: results, ...totals };
  }, ['knowledge_schema']);
}
