import { EnterpriseKnowledgeStore, localizedText } from '../src/server/enterprise-knowledge.ts';
import { applyWikidataSchema } from '../src/server/wikidata-schema.ts';
import { mkdirSync } from 'node:fs';
const store = EnterpriseKnowledgeStore.configured();
const { body } = await store.client.system('/_api/database');
for (const db of body.result.filter((name: string) => name !== '_system')) {
  const schema = await store.importSchema(db).catch(() => null);
  if (!schema || !schema.classes.some(row => row.id.startsWith('wikidata-class/'))) continue;
  const root = await store.get(db, 'Q305177');
  if (!root) continue;
  const nodes = await store.query(db, 'FOR d IN entity RETURN d');
  const before = structuredClone(schema);
  const attributes = await store.attributes(db, 'Q305177');
  const parse = (value: any) => { try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return value; } };
  const knowledge = { id: 'Q305177', name: localizedText(root.labels), attributes: attributes.map(row => ({ id: row.key, value: parse(row.value) })) };
  const typeEvidence = knowledge.attributes.filter(row => ['P31', 'P279', 'P171'].includes(row.id));
  if (!typeEvidence.length) throw new Error('Root type evidence is missing; no changes applied');
  schema.classes = schema.classes.filter(row => !row.id.startsWith('wikidata-class/'));
  const modeled = applyWikidataSchema(schema, knowledge, Number(root.project_id));
  const names = new Map(nodes.map(node => [node.sqlite_id || node.id, localizedText(node.labels)]));
  let renamed = 0;
  for (const row of [...schema.ontologies, ...schema.classes]) {
    const id = row.wikidata_id || row.id.match(/^(?:ontology|wikidata-class)\/(Q[1-9][0-9]*)$/)?.[1];
    const name = names.get(id);
    if (name && /[\u3400-\u9fff]/.test(name) && row.name !== name) { row.name = name; renamed++; }
  }
  const allowed = new Set(schema.classes.map(row => row.id));
  const updates = nodes.flatMap(node => {
    const existing = parse(node.class_ids) || [];
    if (!Array.isArray(existing)) throw new Error('Unexpected category representation');
    const class_ids = [...new Set([...existing.filter((id: string) => allowed.has(id) && !id.startsWith('wikidata-class/')), ...((node.sqlite_id || node.id) === 'Q305177' ? modeled.categoryIds : [])])];
    return JSON.stringify(existing) === JSON.stringify(class_ids) ? [] : [{ node, class_ids }];
  });
  mkdirSync('data/recovery', { recursive: true });
  const backup = `data/recovery/wikidata-trees-Q305177-${Date.now()}.json`;
  await Bun.write(backup, JSON.stringify({ database: db, schema: before, entities: updates.map(({ node }) => node) }, null, 2));
  await store.transaction(db, async trx => {
    await store.client.database(db, '/_api/document/knowledge_schema/definitions', { method: 'PATCH', headers: { 'x-arango-trx-id': trx }, body: JSON.stringify(schema) });
    for (const { node, class_ids } of updates) await store.client.database(db, `/_api/document/entity/${node._key}`, { method: 'PATCH', headers: { 'x-arango-trx-id': trx }, body: JSON.stringify({ class_ids }) });
  }, ['knowledge_schema']);
  console.log(JSON.stringify({ database: db, categoriesBefore: before.classes.length, categoriesAfter: schema.classes.length, ontologies: schema.ontologies.length, renamed, entitiesUpdated: updates.length, backup }));
}
