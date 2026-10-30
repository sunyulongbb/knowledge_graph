import { knowledgeReadAccess, KnowledgeStoreError } from './enterprise-knowledge.ts';
import { randomUUID } from 'node:crypto';
import type { EnterpriseKnowledgeStore, ImportSchema } from './enterprise-knowledge.ts';
import type { KnowledgeUser } from './knowledge-access.ts';
import { datatypeValueTypes, normalizeDatatype, valueTypeFor } from '../shared/wikidata.ts';

type Doc = Record<string, any>;
export async function deriveSchemaFromKnowledge(store: EnterpriseKnowledgeStore, database: string, projectId: number,
  user: KnowledgeUser, ontologyId = '', legacySchema?: () => Partial<ImportSchema> | undefined) {
  await store.ensureImportSchema(database);
  return store.transaction(database, async trx => {
    const saved = await store.importSchema(database, trx), seed = saved || legacySchema?.();
    const schema: ImportSchema = structuredClone({ classes: seed?.classes || [], ontologies: seed?.ontologies || [],
      properties: seed?.properties || [], ontology_properties: seed?.ontology_properties || [] });
    const access = knowledgeReadAccess(user), targetAccess = knowledgeReadAccess(user, 'target');
    const rows = await store.query(database, `FOR edge IN link LET doc = DOCUMENT(edge._from)
      FILTER doc != null AND ${access.filter} AND (@ontology == '' OR doc.type == @ontology)
      LET property = TO_STRING(NOT_NULL(edge.property_id, edge.attribute.key, edge.mainsnak.property, ''))
      FILTER property != ''
      LET target = edge._from != edge._to ? DOCUMENT(edge._to) : null
      LET tail = target != null AND ${targetAccess.filter} ? target.type : null
      COLLECT propertyId = property, propertyName = NOT_NULL(edge.property_name, edge.attribute.property_name_snapshot, property),
        datatype = NOT_NULL(edge.mainsnak.datatype, edge.datatype, edge.attribute.datatype, 'string'),
        ontologyId = doc.type, tailType = tail INTO statements = NOT_NULL(edge.sqlite_id, edge._key)
      RETURN { propertyId, propertyName, datatype, ontologyId, tailType, usage: LENGTH(UNIQUE(statements)) }`,
    { ...access.bindVars, ontology: ontologyId }, trx);
    const groups = new Map<string, Doc[]>();
    for (const row of rows) {
      const id = String(row.propertyId || '').trim(); if (!id) continue;
      groups.set(id, [...(groups.get(id) || []), row]);
    }
    let propertiesCreated = 0, associationsCreated = 0, ontologiesCreated = 0, existingProperties = 0, skippedWithoutType = 0;
    const conflicts: Doc[] = [];
    const ensureOntology = (id: string) => {
      if (schema.ontologies.some(row => row.id === id)) return;
      schema.ontologies.push({ id, name: id, alias: [id], description: '由知识数据中的本体标识自动补全', parent_id: null,
        project_id: projectId, status: 'active', display_shape: 'rectangle', sort_order: schema.ontologies.length + 1 });
      ontologiesCreated++;
    };
    for (const [id, observations] of groups) {
      const types = [...new Set(observations.map(row => normalizeDatatype(row.datatype)))];
      const existing = schema.properties.find(row => row.id === id);
      if (types.length !== 1 || !datatypeValueTypes[types[0]!] || (existing && normalizeDatatype(existing.datatype, existing.valuetype) !== types[0])) {
        conflicts.push({ propertyId: id, datatypes: types, reason: existing ? '知识数据类型与已有属性定义不一致，未修改已有配置' : '知识数据中存在多种或不支持的数据类型，未自动生成' }); continue;
      }
      if (existing?.status === 'deprecated') { conflicts.push({ propertyId: id, reason: '属性已废弃，未自动关联', datatypes: types }); continue; }
      if (!existing) {
        const names = new Map<string, number>();
        for (const row of observations) { const name = String(row.propertyName || id).trim() || id; names.set(name, (names.get(name) || 0) + Number(row.usage || 1)); }
        const name = [...names].sort((a, b) => Number(a[0] === id) - Number(b[0] === id) || b[1] - a[1])[0]?.[0] || id;
        const tails = types[0] === 'wikibase-item' ? [...new Set(observations.map(row => String(row.tailType || '').trim()).filter(Boolean))] : [];
        if (tails.length === 1) ensureOntology(tails[0]!);
        schema.properties.push({ id, name, alias: [name], datatype: types[0], valuetype: valueTypeFor(types[0]), status: 'active',
          project_id: projectId, description: '从知识数据中反向生成', types: [], tail_ontology_id: tails.length === 1 ? tails[0] : '' });
        propertiesCreated++;
      } else existingProperties++;
      for (const typeId of new Set(observations.map(row => String(row.ontologyId || '').trim()))) {
        if (!typeId) { skippedWithoutType++; continue; }
        ensureOntology(typeId);
        if (!schema.ontology_properties.some(link => link.ontology_id === typeId && link.property_id === id)) {
          schema.ontology_properties.push({ ontology_id: typeId, property_id: id }); associationsCreated++;
        }
      }
    }
    const { body } = await store.client.database(database, '/_api/document/knowledge_schema?overwriteMode=replace', { method: 'POST',
      headers: { 'x-arango-trx-id': trx }, body: JSON.stringify([{ _key: 'definitions', ...schema }]) });
    if (!Array.isArray(body) || body.some(row => row.error)) throw new Error('反向生成属性失败，本次变更已回滚');
    return { propertiesCreated, associationsCreated, ontologiesCreated, existingProperties, skippedWithoutType, conflicts, scope: ontologyId || 'application' };
  }, ['knowledge_schema']);
}

/** Keep generated definitions editable through the existing property UI. */
export async function maintainPropertySchema(store: EnterpriseKnowledgeStore, database: string, projectId: number, operation: string,
  input: Doc, legacySchema?: () => Partial<ImportSchema> | undefined) {
  await store.ensureImportSchema(database);
  return store.transaction(database, async trx => {
    const saved = await store.importSchema(database, trx), seed = saved || legacySchema?.();
    const schema: ImportSchema = structuredClone({ classes: seed?.classes || [], ontologies: seed?.ontologies || [], properties: seed?.properties || [], ontology_properties: seed?.ontology_properties || [] });
    const list = (value: any): string[] => {
      if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = [value]; } }
      return Array.isArray(value) ? value.map(String).map(item => item.trim()).filter(Boolean) : [];
    };
    let id = String(input.id || input.property_id || '').trim();
    if (operation === 'create') id = `property/${randomUUID()}`;
    let property = schema.properties.find(row => row.id === id);
    if (operation !== 'create' && !property) throw new KnowledgeStoreError('属性不存在', 404);
    if (operation === 'link' || operation === 'unlink') {
      const ontology = String(input.ontology_id || '').trim();
      if (!schema.ontologies.some(row => row.id === ontology)) throw new KnowledgeStoreError('本体不存在', 404);
      if (operation === 'link') {
        if (property!.status === 'deprecated') throw new KnowledgeStoreError('不能关联已废弃的属性');
        if (!schema.ontology_properties.some(row => row.ontology_id === ontology && row.property_id === id)) schema.ontology_properties.push({ ontology_id: ontology, property_id: id });
      } else schema.ontology_properties = schema.ontology_properties.filter(row => row.ontology_id !== ontology || row.property_id !== id);
    } else if (operation === 'delete') property!.status = 'deprecated';
    else {
      const name = String(input.name ?? property?.name ?? '').trim();
      if (!name) throw new KnowledgeStoreError('属性名称不能为空');
      if ((!property || String(property.name).trim().toLowerCase() !== name.toLowerCase())
        && schema.properties.some(row => row.id !== id && String(row.name).trim().toLowerCase() === name.toLowerCase())) throw new KnowledgeStoreError('同名属性已存在', 409);
      const datatype = normalizeDatatype(input.datatype ?? property?.datatype, input.valuetype ?? property?.valuetype);
      if (!datatypeValueTypes[datatype]) throw new KnowledgeStoreError('不支持的数据类型');
      const tail = datatype === 'wikibase-item' ? String(input.tail_ontology_id ?? property?.tail_ontology_id ?? '').trim() : '';
      if (tail && !schema.ontologies.some(row => row.id === tail)) throw new KnowledgeStoreError('尾实体本体不存在');
      const status = input.status ?? property?.status ?? 'active';
      if (!['active', 'deprecated'].includes(status)) throw new KnowledgeStoreError('属性状态无效');
      const values = { id, name, alias: [...new Set([name, ...list(input.alias ?? property?.alias)])], datatype, valuetype: valueTypeFor(datatype),
        tail_ontology_id: tail, status, description: String(input.description ?? property?.description ?? ''), project_id: projectId, types: list(input.types ?? property?.types) };
      if (property) Object.assign(property, values); else { property = values; schema.properties.push(property); }
    }
    const { body } = await store.client.database(database, '/_api/document/knowledge_schema?overwriteMode=replace', { method: 'POST', headers: { 'x-arango-trx-id': trx }, body: JSON.stringify([{ _key: 'definitions', ...schema }]) });
    if (!Array.isArray(body) || body.some(row => row.error)) throw new Error('属性保存失败，本次变更已回滚');
    return { ok: true, id };
  }, ['knowledge_schema']);
}
