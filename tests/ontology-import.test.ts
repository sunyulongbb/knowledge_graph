import { test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { importOntologies, parseOntologyImport } from '../src/server/ontology-import.ts';
import { serveStaticRoute } from '../src/server/static.ts';

function setup() {
  const db = new Database(':memory:');
  db.run('CREATE TABLE ontologies (id TEXT PRIMARY KEY, name TEXT, alias TEXT, description TEXT, parent_id TEXT, project_id INTEGER, color TEXT, display_shape TEXT, sort_order INTEGER)');
  return db;
}
const example = JSON.parse(readFileSync(new URL('../public/examples/ontology-import.json', import.meta.url), 'utf8'));

test('example imports hierarchy, metadata, order, and reuses repeated imports per project', () => {
  const db = setup();
  try {
    expect(importOntologies(db, example, 1)).toEqual({ created: 8, updated: 0, total: 8 });
    const parent: any = db.query('SELECT * FROM ontologies WHERE name = ?').get('人物');
    const child: any = db.query('SELECT * FROM ontologies WHERE name = ?').get('科学家');
    expect(child.parent_id).toBe(parent.id);
    expect(parent.color).toBe('#3b82f6');
    expect(parent.display_shape).toBe('circle');
    expect(JSON.parse(parent.alias)).toContain('Person');
    expect(parent.sort_order).toBe(1);
    expect(importOntologies(db, example, 1)).toEqual({ created: 0, updated: 8, total: 8 });
    expect(importOntologies(db, example, 2).created).toBe(8);
    expect(importOntologies(db, example, null).created).toBe(8);
  } finally { db.close(); }
});

test('invalid child rejects whole document before writing', () => {
  const db = setup();
  try {
    expect(() => importOntologies(db, { version: 1, ontologies: [{ name: 'Valid', children: [{ name: '' }] }] }, null)).toThrow('children[0].name');
    expect(db.query('SELECT count(*) AS count FROM ontologies').get()).toEqual({ count: 0 });
    for (const input of [{ version: 2, ontologies: [] }, { version: 1, ontologies: [{ name: 'A', children: 'bad' }] }, { version: 1, ontologies: [{ name: 'A', properties: [] }] }]) {
      expect(() => parseOntologyImport(input)).toThrow();
    }
  } finally { db.close(); }
});

test('alias conflicts roll back earlier inserts in the same file', () => {
  const db = setup();
  try {
    importOntologies(db, { version: 1, ontologies: [{ name: 'Existing', alias: ['shared'] }] }, 1);
    expect(() => importOntologies(db, { version: 1, ontologies: [{ name: 'New' }, { name: 'Conflicting', alias: ['shared'] }] }, 1)).toThrow('冲突');
    expect(db.query('SELECT name FROM ontologies').all()).toEqual([{ name: 'Existing' }]);
  } finally { db.close(); }
});

test('same-name import updates provided data and permits new children', () => {
  const db = setup();
  try {
    importOntologies(db, { version: 1, ontologies: [{ name: 'Root', description: 'Original' }] }, 1);
    expect(importOntologies(db, { version: 1, ontologies: [{ name: 'root', description: 'Changed', children: [{ name: 'New child' }] }] }, 1)).toEqual({ created: 1, updated: 1, total: 2 });
    expect(db.query('SELECT description FROM ontologies WHERE name = ?').get('Root')).toEqual({ description: 'Changed' });
  } finally { db.close(); }
});

test('example and format documentation are downloadable', async () => {
  const response = await serveStaticRoute(new Request('http://localhost/examples/ontology-import.json'), '/examples/ontology-import.json');
  expect(response?.status).toBe(200);
  expect(parseOntologyImport(await response!.json()).length).toBe(2);
  const docs = await serveStaticRoute(new Request('http://localhost/examples/ontology-import-format.md'), '/examples/ontology-import-format.md');
  expect(await docs!.text()).toContain('children');
});

test('incremental updates preserve omitted fields, children, IDs and other roots', () => {
  const db = setup();
  try {
    importOntologies(db, { version: 1, ontologies: [
      { name: 'Root', description: 'Original', color: '#123456', alias: ['Original alias'], children: [{ name: 'Keep child' }] },
      { name: 'Keep root' },
    ] }, 1);
    const before: any = db.query('SELECT * FROM ontologies WHERE name = ?').get('Root');
    importOntologies(db, { version: 1, ontologies: [{ name: 'Root', description: 'Updated', children: [] }] }, 1);
    const after: any = db.query('SELECT * FROM ontologies WHERE name = ?').get('Root');
    expect(after.id).toBe(before.id);
    expect(after.description).toBe('Updated');
    expect(after.alias).toBe(before.alias);
    expect(after.color).toBe(before.color);
    expect(after.sort_order).toBe(before.sort_order);
    expect(db.query('SELECT count(*) AS count FROM ontologies').get()).toEqual({ count: 3 });
    expect(db.query('SELECT parent_id FROM ontologies WHERE name = ?').get('Keep child')).toEqual({ parent_id: before.id });
    importOntologies(db, { version: 1, ontologies: [{ name: 'Root', description: '', color: null }] }, 1);
    expect(db.query('SELECT description, color FROM ontologies WHERE id = ?').get(before.id)).toEqual({ description: '', color: null });
  } finally { db.close(); }
});

test('update alias conflicts roll back preceding field changes', () => {
  const db = setup();
  try {
    importOntologies(db, { version: 1, ontologies: [{ name: 'A', description: 'Before' }, { name: 'B', alias: ['Taken'] }] }, 1);
    expect(() => importOntologies(db, { version: 1, ontologies: [{ name: 'A', description: 'After' }, { name: 'A', alias: ['Taken'] }] }, 1)).toThrow();
    expect(db.query('SELECT description FROM ontologies WHERE name = ?').get('A')).toEqual({ description: 'Before' });
  } finally { db.close(); }
});

test('property search returns saved tail ontology settings', () => {
  const source = readFileSync(new URL('../src/server/routes/schema.ts', import.meta.url), 'utf8');
  const start = source.indexOf('  if (url.pathname === "/api/kb/property_search"');
  const mappingStart = source.indexOf('.map((row: any) => ({', start);
  const mappingEnd = source.indexOf('}));', mappingStart);
  const mapping = source.slice(mappingStart, mappingEnd + 4).replace('.map((row: any) => (', 'return (').replace(/\)\);$/, ');');
  const map = new Function('row', 'parseAliasStorage', 'normalizeAlias', 'normalizeDatatype', 'valueTypeFor', 'parseTypes', 'parseCsvField', 'ontologyIdRaw', mapping);
  const result = map({ id: 'P1', tail_ontology_id: 'ontology/T1' }, () => [], () => '', () => 'wikibase-item', () => 'wikibase-entityid', () => [], () => [], '');
  expect(result.tail_ontology_id).toBe('ontology/T1');
});
