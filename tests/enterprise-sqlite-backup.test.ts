import { test, expect, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { EnterpriseSqliteBackup } from '../src/server/enterprise-sqlite-backup.ts';

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
