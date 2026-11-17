import { test, expect, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { EnterpriseSqliteBackup } from '../src/server/enterprise-sqlite-backup.ts';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('file backups work independently of a corrupt application database and survive reopening', async () => {
  const root = mkdtempSync(join(tmpdir(), 'enterprise-backup-'));
  const app = join(root, 'app.sqlite');
  const path = join(root, 'enterprise-knowledge-backups.sqlite');
  writeFileSync(app, 'damaged SQLite application file');
  const snapshot = { entity: [{ _key: 'a' }], link: [] };
  const store = { query: async () => [snapshot] } as any;
  try {
    const backup = EnterpriseSqliteBackup.open(store, app, path);
    try { await backup.flush('project'); } finally { backup.close(); }
    const reopened = EnterpriseSqliteBackup.open(store, app, path);
    try { expect((reopened.status('project') as any).entities).toBe(1); } finally { reopened.close(); }
    expect(readFileSync(app, 'utf8')).toBe('damaged SQLite application file');
    expect(() => EnterpriseSqliteBackup.open(store, app, app)).toThrow('separate SQLite file');
    writeFileSync(path, 'damaged backup file');
    expect(() => EnterpriseSqliteBackup.open(store, app, path)).toThrow();
    expect(readFileSync(path, 'utf8')).toBe('damaged backup file');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('backup retains complete graph and keeps the last good snapshot after failure', async () => {
  const db = new Database(':memory:');
  let fail = false;
  let snapshot = { entity: [{ _key: 'a', visibility: 'private', maintainer_ids: [7] }], link: [{ _key: 'r', attribute: { statement_json: '{"qualifiers":{}}' } }] };
  const store = { query: async () => { if (fail) throw new Error('offline'); return [snapshot]; } };
  try {
    const backup = new EnterpriseSqliteBackup(db, store as any);
    await backup.flush('example');
    const read = () => JSON.parse((db.query('SELECT snapshot_json FROM enterprise_knowledge_backups WHERE database_name=?').get('example') as any).snapshot_json);
    expect(read()).toEqual(snapshot);
    fail = true;
    await expect(backup.flush('example')).rejects.toThrow('offline');
    expect(read()).toEqual(snapshot);
    expect(backup.status('other')).toBeNull();
    fail = false;
    snapshot = { entity: [], link: [] };
    await backup.flush('example');
    expect(read()).toEqual(snapshot);
    expect((backup.status('example') as any).entities).toBe(0);
  } finally { db.close(); }
});

test('scheduled backup skips unmigrated databases, discovers newly migrated ones, and preserves old backups', async () => {
  const db = new Database(':memory:');
  let existing = ['ready'];
  const queried: string[] = [];
  const store = {
    client: { system: async () => ({ body: { result: existing } }) },
    query: async (name: string) => { queried.push(name); return [{ entity: [{ _key: name }], link: [] }]; },
  };
  try {
    const backup = new EnterpriseSqliteBackup(db, store as any);
    await backup.flush('legacy');
    const saved = backup.status('legacy');
    queried.length = 0;
    await backup.reconcile(['ready', 'legacy']);
    expect(queried).toEqual(['ready']);
    expect(backup.status('legacy')).toEqual(saved);
    existing = ['ready', 'legacy'];
    await backup.reconcile(['legacy']);
    expect(queried).toEqual(['ready', 'legacy']);
  } finally { db.close(); }
});

test('only database-not-found races are skipped; other failures remain visible', async () => {
  const db = new Database(':memory:');
  const log = spyOn(console, 'error').mockImplementation(() => {});
  const store = {
    client: { system: async () => ({ body: { result: ['removed', 'broken', 'ok'] } }) },
    query: async (name: string) => {
      if (name !== 'ok') throw Object.assign(new Error(name), { status: 404, body: { errorNum: name === 'removed' ? 1228 : 1203 } });
      return [{ entity: [], link: [] }];
    },
  };
  try {
    const backup = new EnterpriseSqliteBackup(db, store as any);
    await backup.reconcile(['removed', 'broken', 'ok']);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toContain('broken');
    expect(backup.status('ok')).not.toBeNull();
    store.client.system = async () => { throw new Error('connection failed'); };
    await expect(backup.reconcile(['ok'])).rejects.toThrow('connection failed');
    expect(backup.status('ok')).not.toBeNull();
  } finally { log.mockRestore(); db.close(); }
});

test('paged backups bound Arango queries and preserve the last complete generation on failure',async()=>{
 const db=new Database(':memory:');let fail=false;const calls:any[]=[];
 const store:any={client:{database:async (_:string,path:string,init:any)=>{
   if(path.includes('/collection/'))throw Object.assign(new Error('missing'),{status:404,body:{errorNum:1203}});
   return {body:{result:{id:'trx'}}};
 }},query:async (_:string,query:string,vars:any,trx:string)=>{
   calls.push({query,vars,trx});if(fail)throw Error('timeout');
   return vars.after ? [] : [{_key:'one',data:'original'}];
 }};
 try{
  const backup=new EnterpriseSqliteBackup(db,store);await backup.flush('default');
  const first=backup.status('default');expect((first as any).entities).toBe(1);expect((first as any).links).toBe(1);
  expect(calls.every(call=>call.query.includes('LIMIT 200') && call.trx==='trx')).toBe(true);
  expect((db.query('SELECT COUNT(*) AS count FROM enterprise_knowledge_backup_documents').get() as any).count).toBe(2);
  fail=true;await expect(backup.flush('default')).rejects.toThrow('timeout');
  expect(backup.status('default')).toEqual(first);
  expect((db.query('SELECT COUNT(*) AS count FROM enterprise_knowledge_backup_documents').get() as any).count).toBe(2);
 }finally{db.close();}
});
