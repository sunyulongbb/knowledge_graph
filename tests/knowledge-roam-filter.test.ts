import { test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/server/routes/core-kb.ts', import.meta.url), 'utf8');
const block = source.slice(source.indexOf('  if (url.pathname === "/api/kb/graph"'), source.indexOf('  if (url.pathname === "/api/kb/node/graph"'));
const js = new Bun.Transpiler({ loader: 'ts' }).transformSync(block);
const run = new Function('url', 'method', 'db', 'hasProjectScope', 'scopedProjectId', 'scopedClause', 'formatNode', 'formatEdge', js);

test('roam graph filters classification across all nodes and both ends of each edge', async () => {
  const db = new Database(':memory:');
  try {
    db.exec(`CREATE TABLE nodes(id TEXT, project_id TEXT);
      CREATE TABLE entity_classes(entity_id TEXT, class_id TEXT);
      CREATE TABLE attributes(id TEXT, node_id TEXT, datatype TEXT, value TEXT, key TEXT);
      INSERT INTO nodes VALUES ('A','p'),('B','p'),('C','p'),('D','other');
      INSERT INTO entity_classes VALUES ('A','kind'),('B','kind'),('C','different'),('D','kind');
      INSERT INTO attributes VALUES ('ab','A','wikibase-entityid','{"id":"B"}','link'),
        ('ac','A','wikibase-entityid','{"id":"C"}','link'),
        ('ca','C','wikibase-entityid','{"id":"A"}','link'),
        ('ad','A','wikibase-entityid','{"id":"D"}','link');`);
    const graph = async (category: string) => {
      const url = new URL('http://localhost/api/kb/graph');
      if (category) url.searchParams.set('class_id', category);
      return run(url, 'GET', db, true, 'p', () => 'project_id = ?', (n: any) => n, (e: any) => e).json();
    };
    const filtered = await graph('kind');
    expect(filtered.nodes.map((n: any) => n.id)).toEqual(['A', 'B']);
    expect(filtered.edges.map((e: any) => [e.source, e.target])).toEqual([['A', 'B']]);
    expect((await graph('missing')).counts).toEqual({ nodes: 0, edges: 0 });
    expect((await graph('')).counts).toEqual({ nodes: 3, edges: 3 });
  } finally { db.close(); }
});
