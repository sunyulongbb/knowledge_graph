import { expect, test } from 'bun:test';
import { deriveSchemaFromKnowledge, maintainPropertySchema } from '../src/server/schema-from-knowledge.ts';
import { createEnterpriseKnowledgeHandler } from '../src/server/routes/enterprise-knowledge.ts';
import type { ImportSchema } from '../src/server/enterprise-knowledge.ts';

const user = { id: 42, username: 'member', memberProjectIds: [7] };
function fixture() {
  let schema: ImportSchema = { classes: [], ontologies: [{ id: 'person', name: '人物' }, { id: 'place', name: '地点' }],
    properties: [{ id: 'existing', name: '手工属性', datatype: 'string', status: 'active', description: '保留配置' }],
    ontology_properties: [{ ontology_id: 'place', property_id: 'existing' }] };
  let staged: any, failed = false;
  let rows = [
    { propertyId: 'existing', propertyName: '知识快照名称', datatype: 'string', ontologyId: 'person', usage: 2 },
    { propertyId: 'new', propertyName: '职业', datatype: 'string', ontologyId: 'person', usage: 5 },
    { propertyId: 'new', propertyName: '职业', datatype: 'string', ontologyId: 'person', usage: 5 },
    { propertyId: 'birthplace', propertyName: '出生地', datatype: 'wikibase-entityid', ontologyId: 'person', tailType: 'place', usage: 1 },
  ];
  const calls: any[] = [];
  const store = { ensure: async () => {}, ensureImportSchema: async () => {}, importSchema: async () => schema,
    transaction: async (_db: string, work: (id: string) => Promise<any>, collections: string[]) => {
      expect(collections).toEqual(['knowledge_schema']); staged = null;
      const result = await work('trx'); schema = staged; return result;
    },
    query: async (_db: string, query: string, bindVars: any, trx: string) => {
      calls.push({ query, bindVars, trx }); return rows.filter(row => !bindVars.ontology || row.ontologyId === bindVars.ontology);
    },
    client: { database: async (_db: string, path: string, init: any) => {
      expect(path).toBe('/_api/document/knowledge_schema?overwriteMode=replace'); expect(init.headers['x-arango-trx-id']).toBe('trx');
      staged = JSON.parse(init.body)[0]; return { body: failed ? [{ error: true }] : [{ _key: 'definitions' }] };
    } },
  } as any;
  return { store, calls, schema: () => schema, rows: (value: any[]) => { rows = value; }, fail: () => { failed = true; } };
}

test('reverse generation deduplicates actual property IDs, preserves definitions and derives ontology and unique tail links', async () => {
  const f = fixture();
  const result = await deriveSchemaFromKnowledge(f.store, 'app', 7, user);
  expect(result).toMatchObject({ propertiesCreated: 2, associationsCreated: 3, ontologiesCreated: 0, existingProperties: 1, conflicts: [] });
  expect(f.schema().properties.find(row => row.id === 'existing')).toMatchObject({ name: '手工属性', description: '保留配置' });
  expect(f.schema().properties.find(row => row.id === 'birthplace')).toMatchObject({ datatype: 'wikibase-item', tail_ontology_id: 'place' });
  expect(f.schema().properties.filter(row => row.id === 'new')).toHaveLength(1);
  expect(f.calls[0].query).toContain('doc.visibility'); expect(f.calls[0].query).toContain('target.visibility'); expect(f.calls[0].trx).toBe('trx');
  const repeat = await deriveSchemaFromKnowledge(f.store, 'app', 7, user);
  expect(repeat).toMatchObject({ propertiesCreated: 0, associationsCreated: 0 });
  expect(f.schema().ontology_properties).toHaveLength(4);
});

test('conflicting types and deprecated definitions are reported without overwriting configuration', async () => {
  const f = fixture();
  await maintainPropertySchema(f.store, 'app', 7, 'delete', { id: 'existing' });
  f.rows([{ propertyId: 'existing', datatype: 'string', ontologyId: 'person' },
    { propertyId: 'mixed', datatype: 'string', ontologyId: 'person' }, { propertyId: 'mixed', datatype: 'quantity', ontologyId: 'person' }]);
  const result = await deriveSchemaFromKnowledge(f.store, 'app', 7, user);
  expect(result.propertiesCreated).toBe(0); expect(result.associationsCreated).toBe(0); expect(result.conflicts).toHaveLength(2);
  expect(f.schema().properties.find(row => row.id === 'existing')!.status).toBe('deprecated');
});

test('scoped generation ignores other ontology data and reports missing types without inventing associations', async () => {
  const f = fixture();
  f.rows([{ propertyId: 'one', propertyName: '字段', datatype: 'string', ontologyId: 'person' }, { propertyId: 'two', datatype: 'string', ontologyId: 'place' }]);
  expect((await deriveSchemaFromKnowledge(f.store, 'app', 7, user, 'person')).propertiesCreated).toBe(1);
  expect(f.schema().properties.some(row => row.id === 'two')).toBe(false);
  f.rows([{ propertyId: 'untyped', datatype: 'string', ontologyId: null }]);
  const result = await deriveSchemaFromKnowledge(f.store, 'app', 7, user);
  expect(result).toMatchObject({ propertiesCreated: 1, associationsCreated: 0, skippedWithoutType: 1 });
});

test('schema write errors preserve the prior definitions and associations', async () => {
  const f = fixture(), original = structuredClone(f.schema()); f.fail();
  await expect(deriveSchemaFromKnowledge(f.store, 'app', 7, user)).rejects.toThrow('回滚');
  expect(f.schema()).toEqual(original);
});

test('generated definitions remain editable, linkable and deprecatable through the native schema editor', async () => {
  const f = fixture(); await deriveSchemaFromKnowledge(f.store, 'app', 7, user);
  await maintainPropertySchema(f.store, 'app', 7, 'update', { id: 'new', name: '职业名称', description: '人工完善' });
  expect(f.schema().properties.find(row => row.id === 'new')).toMatchObject({ name: '职业名称', description: '人工完善' });
  await maintainPropertySchema(f.store, 'app', 7, 'link', { property_id: 'new', ontology_id: 'place' });
  expect(f.schema().ontology_properties).toContainEqual({ ontology_id: 'place', property_id: 'new' });
  await maintainPropertySchema(f.store, 'app', 7, 'unlink', { property_id: 'new', ontology_id: 'place' });
  expect(f.schema().ontology_properties).not.toContainEqual({ ontology_id: 'place', property_id: 'new' });
  await maintainPropertySchema(f.store, 'app', 7, 'delete', { id: 'new' });
  expect(f.schema().properties.find(row => row.id === 'new')!.status).toBe('deprecated');
});

test('reverse-generation endpoint refreshes native property search and requires membership', async () => {
  const before = process.env.KNOWLEDGE_STORAGE_BACKEND; process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  try {
    const f = fixture();
    const handler = createEnterpriseKnowledgeHandler({ store: f.store, getProject: () => ({ id: 7, name: 'app' }), getUser: () => user, canCreate: () => true });
    const url = new URL('http://local/api/kb/properties/from-knowledge?db=app');
    const result = (await handler(new Request(url, { method: 'POST', body: JSON.stringify({ ontology_id: 'person' }) }), url, 'POST'))!;
    expect(result.status).toBe(200); expect((await result.json()).propertiesCreated).toBe(2);
    const search = new URL('http://local/api/kb/property_search?db=app&ontology_id=person&association_mode=linked&limit=2&offset=0');
    const data = await (await handler(new Request(search), search, 'GET'))!.json();
    expect(data.total).toBe(3); expect(data.items).toHaveLength(2); expect(data.items.every((row: any) => row.linked_to_ontology)).toBe(true);
    for (const [current, member, status] of [[null, true, 401], [user, false, 403]] as const) {
      const denied = createEnterpriseKnowledgeHandler({ store: f.store, getProject: () => ({ id: 7, name: 'app' }), getUser: () => current, canCreate: () => member });
      const request = new Request(url, { method: 'POST', body: '{}' }); expect((await denied(request, url, 'POST'))!.status).toBe(status); expect(request.bodyUsed).toBe(false);
    }
  } finally { if (before === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND; else process.env.KNOWLEDGE_STORAGE_BACKEND = before; }
});
