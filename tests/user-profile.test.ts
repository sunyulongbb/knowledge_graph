import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { createUserProfileHandler } from '../src/server/user-profile.ts';
import { ensureKnowledgeAccessSchema } from '../src/server/knowledge-access.ts';
import { ensureApplicationSchema } from '../src/server/application-access.ts';

function setup() {
  const db = new Database(':memory:');
  db.run('CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,display_name TEXT,avatar TEXT,email TEXT,phone TEXT,status TEXT,created_at TEXT,last_login_at TEXT,password_hash TEXT)');
  db.run("INSERT INTO users VALUES(1,'me','My Name','🙂','me@example.test','123','active','2026-01-01','2026-09-14','secret-hash'),(2,'other','Other','','private@example.test','','active','','','other-secret')");
  db.run('CREATE TABLE permissions(code TEXT,name TEXT,module TEXT)');
  db.run("INSERT INTO permissions VALUES('application:create','创建应用','application'),('user:delete','删除用户','user')");
  db.run('CREATE TABLE projects(id INTEGER PRIMARY KEY,name TEXT,title TEXT,description TEXT,created_at TEXT)');
  ensureApplicationSchema(db);
  db.run("INSERT INTO projects(id,name,title,description,created_at,owner_user_id) VALUES(1,'mine','Mine','','2026',1),(2,'joined','Joined','','2026',2),(3,'unrelated','Unrelated','','2026',2)");
  db.run('INSERT INTO application_members(project_id,user_id) VALUES(2,1)');
  db.run('CREATE TABLE nodes(id TEXT PRIMARY KEY,name TEXT,type TEXT,project_id INTEGER,updated_at TEXT)');
  ensureKnowledgeAccessSchema(db);
  db.run("INSERT INTO nodes(id,name,type,project_id,updated_at,owner_user_id,visibility) VALUES('own','Owned private','Thing',1,'2026',1,'private'),('maintained','Maintained','Thing',2,'2026',2,'private'),('public','Public','Thing',3,'2026',2,'public'),('hidden','Secret title','Secret type',3,'2026',2,'private')");
  db.run("INSERT INTO knowledge_maintainers(node_id,user_id,approved_by) VALUES('maintained',1,2)");
  for (const table of ['knowledge_likes', 'knowledge_favorites']) db.run(`CREATE TABLE ${table}(user_id INTEGER,knowledge_id TEXT,created_at TEXT,PRIMARY KEY(user_id,knowledge_id))`);
  db.run('CREATE TABLE knowledge_comments(id INTEGER PRIMARY KEY,user_id INTEGER,knowledge_id TEXT,content TEXT,created_at TEXT)');
  db.run("INSERT INTO knowledge_likes VALUES(1,'public','2026-03'),(1,'hidden','2026-02'),(1,'deleted','2026-01'),(2,'own','2026-04')");
  db.run("INSERT INTO knowledge_favorites VALUES(1,'entity/maintained','2026-01'),(2,'public','2026-02')");
  db.run("INSERT INTO knowledge_comments VALUES(1,1,'public','My comment','2026-03'),(2,1,'hidden','Private comment','2026-02'),(3,2,'public','Other comment','2026-04')");
  const currentUser: any = { id: 1, username: 'me', role: 'user', status: 'active', dataScope: 'own', roles: [{ code: 'user', name: '普通用户', data_scope: 'own' }], permissions: ['application:create'] };
  const handle = createUserProfileHandler(db, (req) => req.headers.get('test-auth') === 'yes' ? currentUser : null);
  const call = async (query = '', authenticated = true, method = 'GET') => {
    const url = new URL(`http://localhost/api/account/profile${query}`);
    return (await handle(new Request(url, { method, headers: { 'test-auth': authenticated ? 'yes' : 'no' } }), url, method))!;
  };
  return { db, call, currentUser };
}

test('profile exposes only the current account, effective permissions and related counts', async () => {
  const { db, call } = setup();
  try {
    const response = await call('?user_id=2&db=unrelated');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const data = await response.json();
    expect(data.user.id).toBe(1);
    expect(data.user.email).toBe('me@example.test');
    expect(data.counts).toEqual({ applications: 2, knowledge: 2, likes: 3, favorites: 1, comments: 2 });
    expect(data.permissions.map((permission: any) => permission.code)).toEqual(['application:create']);
    expect(JSON.stringify(data)).not.toContain('secret-hash');
    expect(JSON.stringify(data)).not.toContain('private@example.test');
    expect((await (await call('?section=applications')).json()).items.map((item: any) => item.slug).sort()).toEqual(['joined', 'mine']);
    expect((await (await call('?section=knowledge')).json()).items.map((item: any) => item.id).sort()).toEqual(['maintained', 'own']);
  } finally { db.close(); }
});

test('history retains own timestamps but hides revoked or deleted knowledge and private comments', async () => {
  const { db, call } = setup();
  try {
    const likes = await (await call('?section=likes')).json();
    expect(likes.items).toHaveLength(3);
    expect(likes.items.map((item: any) => item.id)).toEqual(['public', null, null]);
    expect(JSON.stringify(likes)).not.toContain('Secret');
    const comments = await (await call('?section=comments')).json();
    expect(comments.items.map((item: any) => item.content)).toEqual(['My comment', null]);
    expect(JSON.stringify(comments)).not.toContain('Other comment');
    expect((await (await call('?section=favorites')).json()).items[0].id).toBe('maintained');
    db.run("DELETE FROM knowledge_maintainers WHERE node_id='maintained'");
    expect((await (await call('?section=favorites')).json()).items[0].id).toBeNull();
    expect((await (await call('?section=knowledge')).json()).total).toBe(1);
  } finally { db.close(); }
});

test('personal history pagination is bounded and malformed or unauthenticated requests are rejected', async () => {
  const { db, call, currentUser } = setup();
  try {
    for (let id = 4; id < 30; id++) db.run("INSERT INTO knowledge_comments VALUES(?,1,'public',?,'2026-05')", [id, `Comment ${id}`]);
    const first = await (await call('?section=comments')).json();
    const last = await (await call('?section=comments&page=999')).json();
    expect(first.total).toBe(28); expect(first.items).toHaveLength(20);
    expect(last.page).toBe(2); expect(last.items).toHaveLength(8);
    expect(new Set([...first.items, ...last.items].map((item: any) => item.record_id)).size).toBe(28);
    expect((await call('?page=-1')).status).toBe(400);
    expect((await call('?section=invalid')).status).toBe(400);
    expect((await call('', false)).status).toBe(401);
    expect((await call('', true, 'POST')).status).toBe(405);
    currentUser.status = 'disabled'; expect((await call()).status).toBe(401);
  } finally { db.close(); }
});
