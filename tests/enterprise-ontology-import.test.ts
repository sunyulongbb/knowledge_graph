import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import type { ImportSchema } from '../src/server/enterprise-knowledge.ts';
import { importEnterpriseOntologies } from '../src/server/enterprise-ontology-import.ts';
import { createEnterpriseKnowledgeHandler } from '../src/server/routes/enterprise-knowledge.ts';

function fixture() {
  let saved: ImportSchema | null = null, staged: ImportSchema | null = null, writes = 0, fail = false;
  const store = {
    ensureImportSchema: async () => {},
    importSchema: async () => saved,
    transaction: async (_db: string, work: (trx: string) => Promise<any>, collections: string[]) => {
      expect(collections).toEqual(['knowledge_schema']);
      staged = null;
      const result = await work('trx');
      saved = staged;
      return result;
    },
    client: { database: async (database: string, path: string, init: RequestInit) => {
      expect(database).toBe('app'); expect(path).toBe('/_api/document/knowledge_schema?overwriteMode=replace');
      expect(new Headers(init.headers).get('x-arango-trx-id')).toBe('trx');
      writes++;
      const [schema] = JSON.parse(String(init.body));
      staged = schema;
      return { body: fail ? [{ error: true }] : [{ _key: 'definitions' }] };
    } },
  } as any;
  return { store, saved: () => saved!, writes: () => writes, fail: () => { fail = true; } };
}
const document = { version: 1, ontologies: [{ name: '天体', color: '#06b6d4', properties: [{ name: '对应神明', datatype: 'wikibase-item' }], children: [{ name: '行星', alias: ['Planet'] }] }] };

test('Arango ontology imports persist hierarchy and properties and update repeated imports without changing IDs', async () => {
  const f = fixture();
  expect(await importEnterpriseOntologies(f.store, 'app', 7, document)).toEqual({ created: 2, updated: 0, total: 2 });
  const first = structuredClone(f.saved());
  const changed = structuredClone(document); changed.ontologies[0]!.color = '#123456';
  expect(await importEnterpriseOntologies(f.store, 'app', 7, changed)).toEqual({ created: 0, updated: 2, total: 2 });
  expect(f.saved().ontologies.map(row => row.id)).toEqual(first.ontologies.map(row => row.id));
  expect(f.saved().ontologies[0]!.color).toBe('#123456');
  expect(f.saved().ontologies[1]!.parent_id).toBe(first.ontologies[0]!.id);
  expect(f.saved().properties).toHaveLength(1); expect(f.saved().ontology_properties).toHaveLength(1);
  expect(f.saved().properties[0]!.datatype).toBe('wikibase-item');
});

test('ontology imports preserve omitted metadata, classification and existing ontology-property links', async () => {
  const f = fixture();
  const seed = { classes: [{ id: 'class', name: '分类' }], ontologies: [{ id: 'type', name: '天体', color: '#abcdef', alias: ['Celestial'], parent_id: null }],
    properties: [{ id: 'p', name: '已有属性' }], ontology_properties: [{ ontology_id: 'type', property_id: 'p' }] };
  await importEnterpriseOntologies(f.store, 'app', 7, { version: 1, ontologies: [{ name: '天体', description: '更新' }] }, () => seed);
  expect(f.saved().ontologies[0]).toMatchObject({ id: 'type', color: '#abcdef', alias: ['Celestial'], description: '更新' });
  expect(f.saved().classes).toEqual(seed.classes); expect(f.saved().ontology_properties).toEqual(seed.ontology_properties);
  expect(seed.ontologies[0]).not.toHaveProperty('description');
});

test('invalid JSON data, alias conflicts and Arango write errors preserve the previous ontology tree', async () => {
  const f = fixture(); await importEnterpriseOntologies(f.store, 'app', 7, document);
  const before = structuredClone(f.saved());
  await expect(importEnterpriseOntologies(f.store, 'app', 7, { version: 1, ontologies: [{ name: '新节点' }, { name: '冲突', children: [{ name: '' }] }] })).rejects.toThrow();
  await expect(importEnterpriseOntologies(f.store, 'app', 7, { version: 1, ontologies: [{ name: '新节点' }, { name: '冲突', alias: ['天体'] }] })).rejects.toThrow('冲突');
  expect(f.writes()).toBe(1);
  f.fail(); await expect(importEnterpriseOntologies(f.store, 'app', 7, { version: 1, ontologies: [{ name: '新节点' }] })).rejects.toThrow('写入失败');
  expect(f.saved()).toEqual(before);
});

test('POST ontology import and GET ontology tree use the same Arango data without SQLite writes or immediate backups', async () => {
  const previous = process.env.KNOWLEDGE_STORAGE_BACKEND; process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  try {
    const f = fixture();
    const handler = createEnterpriseKnowledgeHandler({ store: f.store, getUser: () => ({ id: 42, username: 'member' }),
      getProject: () => ({ id: 7, name: 'app' }), canCreate: () => true,
      backup: { afterWrite: () => { throw new Error('No immediate SQLite backup'); } } as any });
    const url = new URL('http://local/api/kb/ontologies/import?db=app');
    const response = (await handler(new Request(url, { method: 'POST', body: '\uFEFF' + JSON.stringify(document) }), url, 'POST'))!;
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ ok: true, created: 2 });
    const treeUrl = new URL('http://local/api/kb/ontology/tree?db=app');
    expect(await (await handler(new Request(treeUrl), treeUrl, 'GET'))!.json()).toMatchObject({ items: [{ name: '天体', children: [{ name: '行星' }] }] });
    const propertyUrl = new URL('http://local/api/kb/ontology/property?db=app&ontology_id=' + encodeURIComponent(f.saved().ontologies[0]!.id));
    expect(await (await handler(new Request(propertyUrl), propertyUrl, 'GET'))!.json()).toMatchObject({ items: [{ name: '对应神明' }] });
    for (const body of ['{', JSON.stringify({ version: 1, ontologies: [{ name: '' }] })]) {
      expect((await handler(new Request(url, { method: 'POST', body }), url, 'POST'))!.status).toBe(400);
    }
    for (const [user, member, status] of [[null, true, 401], [{ id: 42, username: 'other' }, false, 403]] as const) {
      const denied = createEnterpriseKnowledgeHandler({ store: f.store, getUser: () => user, getProject: () => ({ id: 7, name: 'app' }), canCreate: () => member });
      const request = new Request(url, { method: 'POST', body: JSON.stringify(document) });
      expect((await denied(request, url, 'POST'))!.status).toBe(status); expect(request.bodyUsed).toBe(false);
    }
  } finally { if (previous === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND; else process.env.KNOWLEDGE_STORAGE_BACKEND = previous; }
});

test('downloadable ontology template is compatible with the Arango importer', async () => {
  const f = fixture();
  const example = JSON.parse(readFileSync('public/examples/ontology-import.json', 'utf8'));
  expect((await importEnterpriseOntologies(f.store, 'app', 7, example)).created).toBe(8);
});
