import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { loadOntologyProperties } from '../src/server/ontology-properties.ts';

function fixture() {
  const db = new Database(':memory:');
  db.run('CREATE TABLE ontologies (id TEXT PRIMARY KEY, parent_id TEXT, project_id INTEGER)');
  db.run('CREATE TABLE properties (id TEXT PRIMARY KEY, name TEXT, project_id INTEGER, status TEXT, datatype TEXT, valuetype TEXT, tail_ontology_id TEXT)');
  db.run('CREATE TABLE ontology_properties (ontology_id TEXT, property_id TEXT)');
  db.run("INSERT INTO ontologies VALUES ('root', NULL, 1), ('parent', 'root', 1), ('child', 'parent', 1), ('sibling', 'root', 1), ('foreign', NULL, 2)");
  for (const [id, owner] of [['p1', 'root'], ['p2', 'parent'], ['p3', 'child'], ['p4', 'sibling']]) {
    db.run("INSERT INTO properties VALUES (?, ?, 1, 'active', 'wikibase-item', 'wikibase-entityid', 'target')", [id!, id!]);
    db.run('INSERT INTO ontology_properties VALUES (?, ?)', [owner!, id!]);
  }
  return db;
}

test('child inherits every ancestor, deduplicates and preserves local association and type', () => {
  const db = fixture();
  try {
    db.run("INSERT INTO ontology_properties VALUES ('child', 'p1')");
    const rows = loadOntologyProperties(db, 'child', 1, true);
    expect(rows.map(row => row.id)).toEqual(['p1', 'p3', 'p2']);
    expect(rows.find(row => row.id === 'p1')?.is_local).toBe(1);
    expect(rows.find(row => row.id === 'p2')).toMatchObject({ is_local: 0, datatype: 'wikibase-item', valuetype: 'wikibase-entityid', tail_ontology_id: 'target' });
    expect(loadOntologyProperties(db, 'child', 1).map(row => row.id)).toEqual(['p1', 'p3']);
    db.run("DELETE FROM ontology_properties WHERE ontology_id = 'parent'");
    expect(loadOntologyProperties(db, 'child', 1, true).map(row => row.id)).not.toContain('p2');
  } finally { db.close(); }
});

test('inheritance respects project boundaries and terminates on cyclic parents', () => {
  const db = fixture();
  try {
    db.run("UPDATE ontologies SET parent_id = 'child' WHERE id = 'root'");
    expect(loadOntologyProperties(db, 'child', 1, true)).toHaveLength(3);
    expect(loadOntologyProperties(db, 'child', 2, true)).toEqual([]);
    db.run("UPDATE ontologies SET parent_id = 'foreign' WHERE id = 'parent'");
    db.run("INSERT INTO ontology_properties VALUES ('foreign', 'p1')");
    expect(loadOntologyProperties(db, 'child', 1, true).map(row => row.id)).toEqual(['p3', 'p2']);
    db.run("UPDATE properties SET status = 'deprecated' WHERE id = 'p2'");
    expect(loadOntologyProperties(db, 'child', 1, true).map(row => row.id)).toEqual(['p3']);
  } finally { db.close(); }
});

test('inherited properties are not truncated at 40 results', () => {
  const db = fixture();
  try {
    for (let i = 0; i < 45; i++) {
      db.run("INSERT INTO properties VALUES (?, ?, 1, 'active', 'string', 'string', '')", [`extra${i}`, `extra${i}`]);
      db.run("INSERT INTO ontology_properties VALUES ('root', ?)", [`extra${i}`]);
    }
    expect(loadOntologyProperties(db, 'child', 1, true)).toHaveLength(48);
  } finally { db.close(); }
});
