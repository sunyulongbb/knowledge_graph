import { Database } from 'bun:sqlite';
import { test, expect } from 'bun:test';
import { ontologyTypeFilterSql } from '../src/server/ontology-filter.ts';
import { scopeKnowledgeSql } from '../src/server/knowledge-access.ts';

test('ontology filter includes descendants at every depth with matching counts and scoped pagination', () => {
  const db = new Database(':memory:');
  try {
    db.run('CREATE TABLE ontologies(id TEXT PRIMARY KEY,parent_id TEXT)');
    db.run('CREATE TABLE nodes(id TEXT,type TEXT,project_id INTEGER,visibility TEXT,owner_user_id INTEGER)');
    db.run("INSERT INTO ontologies VALUES ('Root',NULL),('Child','Root'),('Leaf','Child'),('Other',NULL)");
    db.run("INSERT INTO nodes VALUES ('1','Root',1,'public',NULL),('2','Child',1,'public',NULL),('3',' leaf ',1,'public',NULL),('4','Other',1,'public',NULL),('5','Child',2,'public',NULL),('6','DeletedType',1,'public',NULL)");
    const where = `WHERE ${ontologyTypeFilterSql} AND n.project_id = ?`;
    const user = { id: 1, role: 'admin' } as any;
    const rows = db.query(scopeKnowledgeSql(`SELECT n.id FROM nodes n ${where} ORDER BY n.id LIMIT ? OFFSET ?`, user));
    const ids = (type: string, offset = 0) => rows.all(type, 1, 2, offset).map((row: any) => row.id);
    expect(ids('ROOT')).toEqual(['1','2']);
    expect(ids('ROOT', 2)).toEqual(['3']);
    expect(ids('Child')).toEqual(['2','3']);
    expect(ids('Leaf')).toEqual(['3']);
    expect(ids('DeletedType')).toEqual(['6']);
    expect(ids('missing')).toEqual([]);
    expect((db.query(scopeKnowledgeSql(`SELECT COUNT(DISTINCT n.id) AS total FROM nodes n ${where}`, user)).get('Root', 1) as any).total).toBe(3);
    db.run("UPDATE ontologies SET parent_id='Leaf' WHERE id='Root'");
    expect(ids('Root')).toEqual(['1','2']);
  } finally { db.close(); }
});
