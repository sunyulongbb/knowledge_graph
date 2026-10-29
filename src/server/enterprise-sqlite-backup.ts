import type { Database } from 'bun:sqlite';
import type { EnterpriseKnowledgeStore } from './enterprise-knowledge.ts';

/** Keep raw graph documents so statements, permissions and future fields survive. */
export class EnterpriseSqliteBackup {
  private running = new Map<string, Promise<void>>();
  constructor(private db: Database, private store: EnterpriseKnowledgeStore) {
    db.run(`CREATE TABLE IF NOT EXISTS enterprise_knowledge_backups (
      database_name TEXT PRIMARY KEY, snapshot_json TEXT NOT NULL,
      entities INTEGER NOT NULL, links INTEGER NOT NULL, completed_at TEXT NOT NULL)`);
  }
  status(database: string) {
    return this.db.query('SELECT database_name,entities,links,completed_at FROM enterprise_knowledge_backups WHERE database_name=?').get(database);
  }
  flush(database: string): Promise<void> {
    const current = this.running.get(database);
    if (current) return current;
    const task = this.capture(database);
    this.running.set(database, task);
    const finish = () => { if (this.running.get(database) === task) this.running.delete(database); };
    task.then(finish, finish);
    return task;
  }
  private async capture(database: string) {
    // One read transaction captures entity/link together. Replace the last good
    // snapshot only after the whole graph was successfully received.
    const schema = await this.store.importSchema?.(database);
    const [snapshot] = await this.store.query(database,
      `RETURN { entity: (FOR doc IN entity RETURN doc), link: (FOR edge IN link RETURN edge)${schema ? ', knowledge_schema: (FOR doc IN knowledge_schema RETURN doc)' : ''} }`);
    if (!snapshot || !Array.isArray(snapshot.entity) || !Array.isArray(snapshot.link)) throw new Error('Incomplete ArangoDB backup snapshot');
    if (schema && !Array.isArray(snapshot.knowledge_schema)) throw new Error('Incomplete ArangoDB schema backup snapshot');
    this.db.run(`INSERT INTO enterprise_knowledge_backups(database_name,snapshot_json,entities,links,completed_at)
      VALUES(?,?,?,?,?) ON CONFLICT(database_name) DO UPDATE SET snapshot_json=excluded.snapshot_json,
      entities=excluded.entities,links=excluded.links,completed_at=excluded.completed_at`,
      [database, JSON.stringify(snapshot), snapshot.entity.length, snapshot.link.length, new Date().toISOString()]);
  }
  async reconcile(databases: string[]) {
    const { body } = await this.store.client.system('/_api/database');
    if (!Array.isArray(body?.result) || body.result.some((name: unknown) => typeof name !== 'string')) {
      throw new Error('Invalid ArangoDB database list; SQLite backups were not changed');
    }
    const existing = new Set<string>(body.result);
    for (const name of databases) {
      if (!existing.has(name)) continue;
      try { await this.flush(name); }
      catch (error: any) {
        // A database may disappear between listing and capture. Do not treat
        // other 404s (missing collections, etc.) as an unmigrated application.
        if (error?.status === 404 && error?.body?.errorNum === 1228) continue;
        console.error(`SQLite knowledge backup failed (${name}):`, error);
      }
    }
  }
  start(databases: () => Promise<string[]>) {
    let active = false;
    const tick = async () => {
      if (active) return;
      active = true;
      try {
        await this.reconcile(await databases());
      } catch (error) { console.error('SQLite knowledge backup failed:', error); }
      finally { active = false; }
    };
    const configured = Number(process.env.ENTERPRISE_SQLITE_BACKUP_INTERVAL_MS || 60_000);
    const timer = setInterval(tick, Number.isFinite(configured) ? Math.max(1000, configured) : 60_000);
    timer.unref();
    void tick();
    return () => clearInterval(timer);
  }
}
