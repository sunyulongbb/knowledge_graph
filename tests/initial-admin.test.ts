import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
  ensureInitialAdminAccount,
  generateInitialAdminPassword,
} from '../src/server/initial-admin.ts';

function fixture() {
  const db = new Database(':memory:');
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    password_hash TEXT,
    password_salt TEXT,
    role TEXT,
    status TEXT,
    is_admin INTEGER DEFAULT 0
  )`);
  db.run('CREATE TABLE roles (id INTEGER PRIMARY KEY, code TEXT UNIQUE)');
  db.run('CREATE TABLE user_roles (user_id INTEGER, role_id INTEGER, PRIMARY KEY(user_id, role_id))');
  db.run("INSERT INTO roles (id, code) VALUES (1, 'super_admin')");
  return db;
}

test('first run creates one active administrator and binds the super-admin role', async () => {
  const db = fixture();
  const credentials = await ensureInitialAdminAccount(
    db,
    async (password) => ({ salt: 'salt', hash: `hash:${password}` }),
    () => 'First-run-password!',
  );

  expect(credentials).toEqual({
    username: 'admin',
    password: 'First-run-password!',
  });
  expect(db.query('SELECT username, display_name, password_hash, password_salt, role, status, is_admin FROM users').get()).toEqual({
    username: 'admin',
    display_name: '系统管理员',
    password_hash: 'hash:First-run-password!',
    password_salt: 'salt',
    role: 'admin',
    status: 'active',
    is_admin: 1,
  });
  expect(db.query('SELECT user_id, role_id FROM user_roles').get()).toEqual({
    user_id: 1,
    role_id: 1,
  });
});

test('later starts preserve existing accounts and do not generate credentials', async () => {
  const db = fixture();
  db.run("INSERT INTO users (username, role) VALUES ('existing', 'user')");
  let generated = false;
  const credentials = await ensureInitialAdminAccount(
    db,
    async () => ({ salt: 'salt', hash: 'hash' }),
    () => {
      generated = true;
      return 'unused';
    },
  );
  expect(credentials).toBeNull();
  expect(generated).toBe(false);
  expect(db.query('SELECT COUNT(*) AS count FROM users').get()).toEqual({ count: 1 });
});

test('generated initial passwords are strong and omit ambiguous characters', () => {
  const password = generateInitialAdminPassword();
  expect(password.length).toBe(20);
  expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9!@#$%_-]+$/);
});
