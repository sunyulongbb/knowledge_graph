import { test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { canAccessKnowledge, createKnowledgeDatabase, ensureKnowledgeAccessSchema, knowledgeContext } from '../src/server/knowledge-access.ts';
import { knowledgeId } from '../src/server/knowledge-access.ts';

function setup() {
  const raw = new Database(':memory:');
  raw.run('PRAGMA foreign_keys = ON');
  raw.run('CREATE TABLE nodes (id TEXT PRIMARY KEY, name TEXT, data TEXT, description TEXT, images TEXT, covers TEXT, videos TEXT, pdf TEXT, wiki_md TEXT)');
  raw.run('CREATE TABLE attributes (id TEXT PRIMARY KEY, node_id TEXT, value TEXT, statement_json TEXT)');
  ensureKnowledgeAccessSchema(raw);
  raw.run("INSERT INTO nodes(id,name,owner_user_id,visibility) VALUES ('public','Public',1,'public'),('private','Secret',1,'private'),('other','Other',2,'private')");
  return { raw, db: createKnowledgeDatabase(raw) };
}
const owner = { id: 1, username: 'owner', role: 'user' };
const reader = { id: 3, username: 'reader', role: 'user' };

test('login alone, including an administrator account, does not grant edits to another creator knowledge', async () => {
  const { raw } = setup();
  const { guardKnowledgeRequest } = accessRoutes(raw);
  try {
    for (const user of [null, reader, { ...reader, role: 'admin' }]) {
      expect(canAccessKnowledge(raw, user, 'public', 'read')).toBe(true);
      expect(canAccessKnowledge(raw, user, 'public', 'edit')).toBe(false);
      expect(canAccessKnowledge(raw, user, 'public', 'manage')).toBe(false);
    }
    raw.run("INSERT INTO attributes(id,node_id,value,statement_json) VALUES ('a','public','text','{}')");
    const mutations = [
      ['POST', '/api/kb/nodes/update', { id: 'public', name: 'changed' }],
      ['DELETE', '/api/kb/nodes?id=public', {}],
      ['POST', '/api/wiki/page/save', { entityId: 'public', md: 'changed' }],
      ['POST', '/api/kb/attributes/save', { node_id: 'public', value: 'changed' }],
      ['DELETE', '/api/kb/attributes/a', {}],
      ['POST', '/api/kb/entity/class', { entity_id: 'public' }],
      ['POST', '/api/kb/relations/create', { source: 'public', target: 'private' }],
      ['DELETE', '/api/kb/relations/a:private', {}],
    ] as const;
    for (const [method, path, body] of mutations) {
      const url = new URL('http://localhost' + path);
      for (const username of ['', 'reader']) {
        const req = new Request(url, { method, headers: { 'Content-Type': 'application/json', 'test-user': username }, body: JSON.stringify(body) });
        expect((await guardKnowledgeRequest(req, url, method)).status).toBe(username ? 403 : 401);
      }
    }
    const url = new URL('http://localhost/api/kb/nodes');
    expect((await guardKnowledgeRequest(new Request(url, { method: 'POST' }), url, 'POST')).status).toBe(401);
    expect(raw.query("SELECT name FROM nodes WHERE id='public'").get()).toEqual({ name: 'Public' });
  } finally { raw.close(); }
});

test('public read, private isolation and maintainer access', () => {
  const { raw, db } = setup();
  try {
    expect(knowledgeContext.run({ user: null }, () => db.query('SELECT id FROM nodes ORDER BY id').all())).toEqual([{ id: 'public' }]);
    expect(knowledgeContext.run({ user: owner }, () => db.query('SELECT count(*) AS count FROM nodes').get())).toEqual({ count: 2 });
    expect(canAccessKnowledge(raw, reader, 'public', 'edit')).toBe(false);
    expect(canAccessKnowledge(raw, owner, 'private', 'manage')).toBe(true);
    raw.run("INSERT INTO knowledge_maintainers(node_id,user_id,approved_by) VALUES ('private',3,1)");
    expect(canAccessKnowledge(raw, reader, 'private')).toBe(true);
    expect(canAccessKnowledge(raw, reader, 'private', 'edit')).toBe(true);
    expect(canAccessKnowledge(raw, reader, 'private', 'manage')).toBe(false);
    expect(knowledgeContext.run({ user: reader }, () => db.query('SELECT id FROM nodes ORDER BY id').all())).toEqual([{ id: 'private' }, { id: 'public' }]);
  } finally { raw.close(); }
});

test('table sorting and saved graph snapshots respect visibility', () => {
  const { raw, db } = setup();
  try {
    raw.run('UPDATE nodes SET data = ? WHERE id = ?', [JSON.stringify({ notes: 'keep', _relationGraphSnapshot: { nodes: [{ id: 'private', name: 'Secret' }] }, mentions: [{ id: 'private' }] }), 'public']);
    const result: any = knowledgeContext.run({ user: reader }, () => db.query('SELECT id, data FROM nodes ORDER BY rowid DESC').get());
    expect(result.id).toBe('public');
    expect(JSON.parse(result.data)).toEqual({ notes: 'keep' });
    const owned: any = knowledgeContext.run({ user: owner }, () => db.query("SELECT data FROM nodes WHERE id='public'").get());
    expect(JSON.parse(owned.data)._relationGraphSnapshot.nodes[0].name).toBe('Secret');
    raw.run('UPDATE nodes SET data = ? WHERE id = ?', [JSON.stringify({ mentions: { private: 'Secret' } }), 'public']);
    const mentions: any = knowledgeContext.run({ user: reader }, () => db.query("SELECT data FROM nodes WHERE id='public'").get());
    expect(JSON.parse(mentions.data)).toEqual({});
  } finally { raw.close(); }
});

function accessRoutes(raw: Database) {
  const source = readFileSync(new URL('../src/server/routes/knowledge-access.ts', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
  const getCurrentUser = (req: Request) => req.headers.get('test-user') === 'owner' ? owner : req.headers.get('test-user') === 'reader' ? reader : null;
  return new Function('db', 'getCurrentUser', 'canAccessKnowledge', 'knowledgeId', new Bun.Transpiler({ loader: 'ts' }).transformSync(source + '\nreturn { handleKnowledgeAccessRoutes, guardKnowledgeRequest };'))(raw, getCurrentUser, canAccessKnowledge, knowledgeId);
}

test('private media requires access even with alternate path casing and repeated slashes', async () => {
  const { raw } = setup();
  const { guardKnowledgeRequest } = accessRoutes(raw);
  raw.run("UPDATE nodes SET wiki_md = '/static/uploads/app/node-images/secret.png' WHERE id='private'");
  try {
    for (const path of ['/static/uploads/app/node-images/secret.png', '/static/uploads/app/NODE-IMAGES/secret.png', '/static/uploads/app//node-images/secret.png']) {
      const url = new URL('http://localhost' + path);
      expect((await guardKnowledgeRequest(new Request(url, { headers: { 'test-user': 'reader' } }), url, 'GET')).status).toBe(404);
      expect(await guardKnowledgeRequest(new Request(url, { headers: { 'test-user': 'owner' } }), url, 'GET')).toBeNull();
    }
  } finally { raw.close(); }
});

test('maintenance application approval and revocation enforce creator authority', async () => {
  const { raw } = setup();
  raw.run('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, display_name TEXT)');
  raw.run("INSERT INTO users VALUES (1,'owner','Owner'),(3,'reader','Reader')");
  const routes = accessRoutes(raw);
  const call = async (path: string, user: string, body?: any) => {
    const url = new URL('http://localhost' + path);
    const req = new Request(url, { method: body ? 'POST' : 'GET', headers: { 'test-user': user, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return await routes.guardKnowledgeRequest(req, url, req.method) || await routes.handleKnowledgeAccessRoutes(req, url, req.method);
  };
  try {
    expect((await call('/api/kb/knowledge-access?id=private', 'reader')).status).toBe(404);
    expect((await call('/api/kb/knowledge-maintenance/request', '', { id: 'public' })).status).toBe(401);
    expect((await call('/api/kb/knowledge-maintenance/request', 'reader', { id: 'public', message: 'I can help' })).status).toBe(200);
    expect((await (await call('/api/kb/knowledge-access?id=public', 'owner')).json()).requests).toHaveLength(1);
    expect((await call('/api/kb/knowledge-maintenance/review', 'reader', { id: 'public', user_id: 3, decision: 'approve' })).status).toBe(403);
    expect((await call('/api/kb/knowledge-maintenance/review', 'owner', { id: 'public', user_id: 3, decision: 'approve' })).status).toBe(200);
    expect(canAccessKnowledge(raw, reader, 'public', 'edit')).toBe(true);
    expect((await call('/api/kb/nodes/update', 'reader', { id: 'public', visibility: 'private' })).status).toBe(403);
    expect(await call('/api/kb/nodes/update', 'reader', { id: 'public', visibility: 'public', name: 'Updated' })).toBeNull();
    raw.run("UPDATE nodes SET visibility='private' WHERE id='public'");
    expect((await call('/api/kb/knowledge-access?id=public', 'reader')).status).toBe(200);
    expect((await call('/api/kb/knowledge-maintenance/remove', 'owner', { id: 'public', user_id: 3 })).status).toBe(200);
    expect((await call('/api/kb/knowledge-access?id=public', 'reader')).status).toBe(404);
    expect((await call('/api/kb/nodes/update', 'reader', { id: 'public', name: 'Unauthorized' })).status).toBe(403);
    expect((await call('/api/kb/nodes', 'reader', { id: 'private', owner_user_id: 3 })).status).toBe(409);
  } finally { raw.close(); }
});

test('attributes pointing to inaccessible private nodes are not disclosed', () => {
  const { raw, db } = setup();
  try {
    raw.run('INSERT INTO attributes VALUES (?, ?, ?, ?)', ['a', 'public', JSON.stringify({ id: 'private', label: 'Secret' }), '{}']);
    raw.run('INSERT INTO attributes VALUES (?, ?, ?, ?)', ['b', 'private', 'secret text', '{}']);
    expect(knowledgeContext.run({ user: reader }, () => db.query('SELECT * FROM attributes').all())).toEqual([]);
    expect(knowledgeContext.run({ user: owner }, () => db.query('SELECT count(*) AS count FROM attributes').get())).toEqual({ count: 2 });
  } finally { raw.close(); }
});

test('server stamps creator identity and request contexts do not cross users', async () => {
  const { raw, db } = setup();
  try {
    await Promise.all([owner, reader].map((user) => knowledgeContext.run({ user }, async () => {
      await Promise.resolve();
      db.run('INSERT INTO nodes (id, name) VALUES (?, ?)', [`new-${user.id}`, user.username]);
    })));
    expect(raw.query("SELECT owner_user_id,creator_username,visibility FROM nodes WHERE id='new-3'").get()).toEqual({ owner_user_id: 3, creator_username: 'reader', visibility: 'public' });
    expect(() => knowledgeContext.run({ user: null }, () => db.run("INSERT INTO nodes (id) VALUES ('anonymous')"))).toThrow('请先登录');
    expect(knowledgeContext.run({ user: reader }, () => db.query('WITH chosen AS (SELECT * FROM nodes) SELECT id FROM chosen WHERE id = ?').get('private'))).toBeNull();
  } finally { raw.close(); }
});
