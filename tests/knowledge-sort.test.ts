import { test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { scopeKnowledgeSql } from '../src/server/knowledge-access.ts';

test('entity search sorts before pagination, combines interactions and defaults to newest', () => {
  const source = readFileSync(new URL('../src/server/routes/core-kb.ts', import.meta.url), 'utf8');
  const start = source.indexOf('    const orderBy = (url.searchParams.get("order")');
  const end = source.indexOf('    const nodes = db', start);
  const order = new Function('url', `${source.slice(start, end)}; return orderClause;`);
  const db = new Database(':memory:');
  db.run('CREATE TABLE nodes(id TEXT, created_at TEXT, updated_at TEXT, visibility TEXT, owner_user_id INTEGER)');
  for (const table of ['knowledge_likes', 'knowledge_favorites', 'knowledge_comments']) db.run(`CREATE TABLE ${table}(knowledge_id TEXT)`);
  db.run("INSERT INTO nodes VALUES ('old','2026-01-01','2026-01-01','public',NULL),('new','2026-09-14','2026-09-14','public',NULL),('middle','2026-06-01','2026-06-01','public',NULL)");
  db.run("INSERT INTO knowledge_likes VALUES ('entity/old'), ('middle')");
  db.run("INSERT INTO knowledge_favorites VALUES ('old')");
  db.run("INSERT INTO knowledge_comments VALUES ('entity/old')");
  const query = (value = '', offset = 0) => db.query(scopeKnowledgeSql(`SELECT DISTINCT n.* FROM nodes n ${order(new URL(`http://localhost/?order=${value}`))} LIMIT 2 OFFSET ?`, {id: 1, role: 'admin'} as any)).all(offset).map((row: any) => row.id);
  expect(query()).toEqual(['new', 'middle']);
  expect(query('hot')).toEqual(['old', 'middle']);
  expect(query('hot', 2)).toEqual(['new']);
  db.run("INSERT INTO knowledge_comments VALUES ('middle'),('middle')");
  expect(query('hot')).toEqual(['middle', 'old']);
  expect(query('invalid')).toEqual(['new', 'middle']);
  db.close();
});
