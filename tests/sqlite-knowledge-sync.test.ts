import { test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createSqliteKnowledgeSync } from '../src/server/sqlite-knowledge-sync.ts';
import { ArangoClient } from '../src/server/arangodb.ts';
import { EnterpriseKnowledgeStore } from '../src/server/enterprise-knowledge.ts';

test('SQLite import checks actual login and administrator permission', async () => {
  const db = new Database(':memory:');
  try {
    for (const [user, status] of [[null, 401], [{ role: 'user' }, 403]] as const) {
      const handler = createSqliteKnowledgeSync({ db, getUser: () => user, getProject: () => ({ id: 1, name: 'default' }) });
      const req = new Request('http://local/api/kb/knowledge-sync/sqlite/start?db=default', { method: 'POST' });
      expect((await handler(req, new URL(req.url)))?.status).toBe(status);
    }
  } finally { db.close(); }
});

test('imports only selected project, preserves permissions and relations, then indexes ES', async () => {
  const keys = ['ARANGO_URL', 'ARANGO_USERNAME', 'ARANGO_PASSWORD', 'ELASTICSEARCH_URL'] as const;
  const previous = keys.map(key => process.env[key]);
  keys.forEach(key => { process.env[key] = 'test'; });
  const db = new Database(':memory:');
  const calls: { path: string; body: any }[] = [];
  let indexed = false;
  try {
    db.run('CREATE TABLE projects(id INTEGER, is_default INTEGER)');
    db.run('INSERT INTO projects VALUES(1,1),(2,0)');
    db.run('CREATE TABLE nodes(id TEXT, project_id INTEGER, name TEXT, visibility TEXT, owner_user_id INTEGER)');
    db.run("INSERT INTO nodes VALUES('a',1,'A','private',42),('b',2,'B','public',43)");
    db.run('CREATE TABLE entity_classes(entity_id TEXT,class_id TEXT)');
    db.run("INSERT INTO entity_classes VALUES('a','class-a')");
    db.run('CREATE TABLE knowledge_maintainers(node_id TEXT,user_id INTEGER)');
    db.run("INSERT INTO knowledge_maintainers VALUES('a',99)");
    db.run('CREATE TABLE attributes(id TEXT,node_id TEXT,key TEXT,value TEXT,datatype TEXT,property_name_snapshot TEXT,statement_json TEXT,created_at TEXT)');
    db.run(`INSERT INTO attributes VALUES('r','a','related','{"id":"a"}','wikibase-item','关联',NULL,NULL)`);
    const client = new ArangoClient({ url: 'http://mock', username: 'root', password: 'test' }, (async (url: any, init: any) => {
      const path = new URL(url).pathname;
      const body = init?.body ? JSON.parse(init.body) : null;
      calls.push({ path, body });
      return Response.json(path.endsWith('/transaction/begin') ? { result: { id: 'trx' } } : { result: [] });
    }) as typeof fetch);
    const store = new EnterpriseKnowledgeStore(client);
    const handler = createSqliteKnowledgeSync({ db, store, sync: { afterWrite: async () => { indexed = true; } } as any,
      getUser: () => ({ role: 'admin' }), getProject: () => ({ id: 1, name: 'default' }) });
    const req = new Request('http://local/api/kb/knowledge-sync/sqlite/start?db=default', { method: 'POST' });
    expect((await handler(req, new URL(req.url)))?.status).toBe(202);
    const statusReq = new Request('http://local/api/kb/knowledge-sync/sqlite/status?db=default');
    let status: any;
    for (let i = 0; i < 100; i++) {
      status = await (await handler(statusReq, new URL(statusReq.url)))!.json();
      if (status.state !== 'running') break;
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    expect(status.state).toBe('completed');
    expect(status.entities).toBe(1);
    expect(status.links).toBe(1);
    expect(indexed).toBe(true);
    const entity = calls.find(call => call.path.endsWith('/document/entity'))!.body;
    expect(entity.visibility).toBe('private');
    expect(entity.owner_user_id).toBe(42);
    expect(entity.maintainer_ids).toEqual([99]);
    expect(entity.class_ids).toEqual(['class-a']);
    expect(calls.some(call => call.body?.query?.includes('sync_version'))).toBe(false);
  } finally {
    db.close();
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
  }
});
