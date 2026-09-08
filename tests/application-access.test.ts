import { Database } from 'bun:sqlite';
import { test, expect } from 'bun:test';
import { applicationPermissions, createApplicationHandler, ensureApplicationSchema } from '../src/server/application-access.ts';

function setup() {
  const db = new Database(':memory:');
  db.run('PRAGMA foreign_keys=ON');
  db.run("CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,display_name TEXT,status TEXT DEFAULT 'active')");
  db.run("INSERT INTO users(id,username,display_name) VALUES(1,'owner','Owner'),(2,'member','Member'),(3,'other','Other')");
  db.run('CREATE TABLE projects(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,title TEXT,description TEXT,file TEXT,image TEXT,theme_color TEXT,tags TEXT,link TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)');
  ensureApplicationSchema(db);
  const users = [null, { id: 1, username: 'owner' }, { id: 2, username: 'member' }, { id: 3, username: 'other' }];
  const handle = createApplicationHandler(db, (req) => users[Number(req.headers.get('test-user'))] || null);
  const call = async (path: string, user = 0, body?: any, method = 'POST') => {
    const url = new URL('http://localhost' + path);
    const req = new Request(url, { method: body === undefined ? 'GET' : method, headers: { 'test-user': String(user), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return handle(req, url, req.method);
  };
  return { db, call };
}

test('application creation records owner, marketplace is public and sidebar lists only owned or maintained apps', async () => {
  const { db, call } = setup();
  try {
    expect((await call('/api/applications', 0, { name: 'demo' }))!.status).toBe(401);
    expect((await call('/api/kb/create_project?name=ghost'))!.status).toBe(404);
    expect(db.query('SELECT count(*) AS n FROM projects').get()).toEqual({ n: 0 });
    expect((await call('/api/applications', 1, { name: 'demo', title: 'Demo', owner_user_id: 3 }))!.status).toBe(201);
    expect((db.query("SELECT owner_user_id FROM projects WHERE name='demo'").get() as any).owner_user_id).toBe(1);
    expect((await call('/api/applications', 2, { name: 'demo' }))!.status).toBe(409);
    expect((await (await call('/api/applications'))!.json()).projects).toHaveLength(1);
    expect((await (await call('/api/kb/list_projects'))!.json()).projects).toHaveLength(0);
    expect((await (await call('/api/kb/list_projects', 1))!.json()).projects).toHaveLength(1);
    expect((await (await call('/api/kb/list_projects', 2))!.json()).projects).toHaveLength(0);
    expect((await call('/api/kb/update_project', 2, { name: 'demo' }))!.status).toBe(403);
    expect((await call('/api/kb/delete_project', 2, { name: 'demo' }))!.status).toBe(403);
    ensureApplicationSchema(db);
    expect((db.query("SELECT owner_user_id FROM projects WHERE name='demo'").get() as any).owner_user_id).toBe(1);
  } finally { db.close(); }
});

test('maintenance lifecycle, delegated permissions, notification isolation and revocation', async () => {
  const { db, call } = setup();
  try {
    await call('/api/applications', 1, { name: 'demo' });
    const prefix = '/api/applications/1';
    expect((await call(prefix + '/request', 2, { message: 'Happy to help' }))!.status).toBe(200);
    expect((await call(prefix + '/request', 2, {}))!.status).toBe(409);
    expect((await (await call('/api/notifications', 1))!.json()).unread).toBe(1);
    expect((await (await call('/api/notifications', 3))!.json()).unread).toBe(0);
    await call('/api/notifications/read', 3, { id: 1 });
    expect((await (await call('/api/notifications', 1))!.json()).unread).toBe(1);
    expect((await call(prefix + '/review', 2, { user_id: 2, decision: 'approve' }))!.status).toBe(403);
    expect((await call(prefix + '/review', 1, { user_id: 2, decision: 'approve' }))!.status).toBe(200);
    expect((await (await call('/api/kb/list_projects', 2))!.json()).projects).toHaveLength(1);
    expect((await call('/api/kb/update_project', 2, { name: 'demo' }))!.status).toBe(403);
    expect((await call(prefix + '/member', 2, { user_id: 2, edit_settings: true }))!.status).toBe(403);
    expect((await call(prefix + '/member', 1, { user_id: 2, edit_settings: true, review_requests: true }))!.status).toBe(200);
    expect(await call('/api/kb/update_project', 2, { name: 'demo' })).toBeNull();
    expect((await call('/api/kb/delete_project', 2, { name: 'demo' }))!.status).toBe(403);
    await call(prefix + '/request', 3, {});
    expect((await (await call(prefix + '/access', 2))!.json()).requests).toHaveLength(1);
    expect((await call(prefix + '/review', 2, { user_id: 3, decision: 'approve' }))!.status).toBe(200);
    const project = db.query('SELECT * FROM projects WHERE id=1').get();
    expect(applicationPermissions(db, { id: 3, username: 'other' }, project)).toEqual({ owner: false, member: true, editSettings: false, reviewRequests: false });
    await call(prefix + '/member', 1, { user_id: 2 }, 'DELETE');
    expect((await (await call('/api/kb/list_projects', 2))!.json()).projects).toHaveLength(0);
    expect((await call('/api/kb/update_project', 2, { name: 'demo' }))!.status).toBe(403);
    expect((await call(prefix + '/review', 2, { user_id: 3, decision: 'reject' }))!.status).toBe(403);
    await call('/api/notifications/read', 2, { all: true });
    expect((await (await call('/api/notifications', 2))!.json()).unread).toBe(0);
    expect((await (await call('/api/notifications', 1))!.json()).unread).toBeGreaterThan(0);
  } finally { db.close(); }
});

test('owners can directly add members, but permissions and application IDs remain isolated', async () => {
  const { db, call } = setup();
  try {
    await call('/api/applications', 1, { name: 'demo' });
    expect((await call('/api/applications', 3, { name: '1' }))!.status).toBe(400);
    await call('/api/applications', 3, { name: 'another' });
    expect((await call('/api/applications/1/member', 1, { username: 'member', edit_settings: true }))!.status).toBe(200);
    expect((await call('/api/applications/2/member', 1, { username: 'member' }))!.status).toBe(403);
    expect((await call('/api/applications/1/member', 1, { username: 'missing' }))!.status).toBe(400);
    expect((await call('/api/applications/1/member', 1, { user_id: 1 }, 'DELETE'))!.status).toBe(400);
    db.run('DELETE FROM projects WHERE id=1');
    expect(db.query('SELECT count(*) AS n FROM application_members').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});
