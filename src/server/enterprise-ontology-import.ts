import { randomUUID } from 'node:crypto';
import { OntologyImportError, parseOntologyImport } from './ontology-import.ts';
import type { EnterpriseKnowledgeStore, ImportSchema } from './enterprise-knowledge.ts';
import { valueTypeFor } from '../shared/wikidata.ts';

const key = (value: unknown) => String(value || '').trim().toLowerCase();
const aliases = (value: any): unknown[] => {
  if (Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : [parsed]; }
  catch { return String(value || '').split(/[,，;；、\n]+/); }
};

export async function importEnterpriseOntologies(
  store: EnterpriseKnowledgeStore, database: string, projectId: number, input: unknown,
  legacySchema?: () => Partial<ImportSchema> | undefined,
) {
  const roots = parseOntologyImport(input);
  await store.ensureImportSchema(database);
  return store.transaction(database, async trx => {
    const saved = await store.importSchema(database, trx);
    const seed = saved || legacySchema?.();
    const schema: ImportSchema = structuredClone({ classes: seed?.classes || [], ontologies: seed?.ontologies || [],
      properties: seed?.properties || [], ontology_properties: seed?.ontology_properties || [] });
    let created = 0, updated = 0;
    const visit = (node: typeof roots[number], parentId: string | null) => {
      const siblings = schema.ontologies.filter(row => (row.parent_id || null) === parentId);
      let row = siblings.find(row => key(row.name) === key(node.name));
      if (!row || node.provided.includes('alias')) {
        const wanted = new Set(node.alias.map(key));
        const conflict = siblings.find(other => other !== row && [other.name, ...aliases(other.alias)].some(value => wanted.has(key(value))));
        if (conflict) throw new OntologyImportError(`本体“${node.name}”的名称或别名与同级本体“${conflict.name}”冲突`);
      }
      if (row) {
        for (const field of ['description', 'alias', 'color', 'display_shape'] as const) {
          if (node.provided.includes(field)) row[field] = node[field];
        }
        row.status = 'active';
        updated++;
      } else {
        row = { id: `ontology/${randomUUID()}`, name: node.name, description: node.description, alias: node.alias,
          color: node.color, display_shape: node.display_shape, parent_id: parentId, project_id: projectId, status: 'active',
          sort_order: Math.max(0, ...siblings.map(sibling => Number(sibling.sort_order) || 0)) + 1 };
        schema.ontologies.push(row);
        created++;
      }
      for (const property of node.properties) {
        let existing = schema.properties.find(item => key(item.name) === key(property.name));
        if (!existing) {
          existing = { id: `property/${randomUUID()}` };
          schema.properties.push(existing);
        }
        Object.assign(existing, { name: property.name, alias: property.alias, status: 'active', datatype: property.datatype,
          valuetype: valueTypeFor(property.datatype), types: property.types, description: property.description,
          project_id: projectId, tail_ontology_id: property.tail_ontology_id || null });
        if (!schema.ontology_properties.some(link => link.ontology_id === row!.id && link.property_id === existing!.id)) {
          schema.ontology_properties.push({ ontology_id: row.id, property_id: existing.id });
        }
      }
      for (const child of node.children) visit(child, row.id);
    };
    for (const root of roots) visit(root, null);
    const { body } = await store.client.database(database, '/_api/document/knowledge_schema?overwriteMode=replace', {
      method: 'POST', headers: { 'x-arango-trx-id': trx }, body: JSON.stringify([{ _key: 'definitions', ...schema }]),
    });
    if (!Array.isArray(body) || body.some(row => row.error)) throw new Error('ArangoDB 本体定义写入失败');
    return { created, updated, total: created + updated };
  }, ['knowledge_schema']);
}
