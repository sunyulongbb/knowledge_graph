import { randomUUID } from 'node:crypto';
import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { EnterpriseKnowledgeStore } from './enterprise-knowledge.ts';

/** Keep raw graph documents so statements, permissions and future fields survive. */
export class EnterpriseSqliteBackup {
  private errors = new Map<string,string>();
  private running = new Map<string, Promise<void>>();
  /** Backups must not share the application's potentially damaged SQLite file. */
  static open(store: EnterpriseKnowledgeStore, applicationFilename: string, filename = process.env.ENTERPRISE_SQLITE_BACKUP_PATH) {
    const path = resolve(filename || resolve(dirname(applicationFilename), 'enterprise-knowledge-backups.sqlite'));
    if (path === resolve(applicationFilename)) throw new Error('Knowledge backup must use a separate SQLite file');
    mkdirSync(dirname(path), { recursive: true });
    const db = new Database(path, { create: true });
    try {
      const checks = db.query('PRAGMA quick_check').all() as Record<string, unknown>[];
      if (checks.length !== 1 || Object.values(checks[0]!)[0] !== 'ok') throw new Error(`Knowledge backup database is damaged: ${path}`);
      db.run('PRAGMA journal_mode=WAL');
      db.run('PRAGMA synchronous=FULL');
      db.run('PRAGMA busy_timeout=10000');
      return new EnterpriseSqliteBackup(db, store);
    } catch (error) { db.close(); throw error; }
  }
  close() { this.db.close(); }
  constructor(private db: Database, private store: EnterpriseKnowledgeStore) {
    db.run(`CREATE TABLE IF NOT EXISTS enterprise_knowledge_backups (
      database_name TEXT PRIMARY KEY, snapshot_json TEXT NOT NULL,
      entities INTEGER NOT NULL, links INTEGER NOT NULL, completed_at TEXT NOT NULL)`);
  }
  status(database: string) {
    const saved=this.db.query('SELECT database_name,entities,links,completed_at FROM enterprise_knowledge_backups WHERE database_name=?').get(database);
    return saved;
  }
  progress(database:string) {
    return {backup:this.status(database),running:this.running.has(database),error:this.errors.get(database) || null};
  }
  flush(database: string): Promise<void> {
    const current = this.running.get(database);
    if (current) return current;
    this.errors.delete(database);
    const task = this.capture(database);
    this.running.set(database, task);
    const finish = () => { if (this.running.get(database) === task) this.running.delete(database); };
    task.then(finish, error=>{this.errors.set(database,error.message || String(error));finish();});
    return task;
  }
  private async capture(database: string) {
    if (this.store.client?.database) return this.capturePaged(database);

    // One read transaction captures entity/link together. Replace the last good
    // snapshot only after the whole graph was successfully received.
    const schema = await this.store.importSchema?.(database);
    let reports = false;
    if (this.store.client?.database) {
      try { await this.store.client.database(database, '/_api/collection/knowledge_reports'); reports = true; }
      catch (error: any) { if (error.status !== 404 || error.body?.errorNum !== 1203) throw error; }
    }
    const [snapshot] = await this.store.query(database,
      `RETURN { entity: (FOR doc IN entity RETURN doc), link: (FOR edge IN link RETURN edge)${schema ? ', knowledge_schema: (FOR doc IN knowledge_schema RETURN doc)' : ''}${reports ? ', knowledge_reports: (FOR doc IN knowledge_reports RETURN doc)' : ''} }`);
    if (!snapshot || !Array.isArray(snapshot.entity) || !Array.isArray(snapshot.link)) throw new Error('Incomplete ArangoDB backup snapshot');
    if (schema && !Array.isArray(snapshot.knowledge_schema)) throw new Error('Incomplete ArangoDB schema backup snapshot');
    if (reports && !Array.isArray(snapshot.knowledge_reports)) throw new Error('Incomplete ArangoDB report backup snapshot');
    this.db.run(`INSERT INTO enterprise_knowledge_backups(database_name,snapshot_json,entities,links,completed_at)
      VALUES(?,?,?,?,?) ON CONFLICT(database_name) DO UPDATE SET snapshot_json=excluded.snapshot_json,
      entities=excluded.entities,links=excluded.links,completed_at=excluded.completed_at`,
      [database, JSON.stringify(snapshot), snapshot.entity.length, snapshot.link.length, new Date().toISOString()]);
  }
  private async capturePaged(database:string) {
    const generation=randomUUID();
    this.db.run(`CREATE TABLE IF NOT EXISTS enterprise_knowledge_backup_documents (
      database_name TEXT NOT NULL, generation TEXT NOT NULL, collection TEXT NOT NULL,
      document_key TEXT NOT NULL, document_json TEXT NOT NULL,
      PRIMARY KEY(database_name,generation,collection,document_key))`);
    const collections=['entity','link'];
    for(const name of ['knowledge_schema','knowledge_reports']) {
      try { await this.store.client.database(database,'/_api/collection/'+name);collections.push(name); }
      catch(error:any){if(error.status!==404 || error.body?.errorNum!==1203)throw error;}
    }
    const {body}=await this.store.client.database(database,'/_api/transaction/begin',{
      method:'POST',body:JSON.stringify({collections:{read:collections},lockTimeout:5}),
    });
    const trx=body?.result?.id;if(!trx)throw Error('Backup transaction did not return an ID');
    const counts:Record<string,number>={};
    const insert=this.db.query('INSERT INTO enterprise_knowledge_backup_documents VALUES(?,?,?,?,?)');
    try {
      for(const collection of collections){
        let after='';counts[collection]=0;
        while(true){
          const rows=await this.store.query(database,`FOR doc IN @@collection FILTER doc._key > @after SORT doc._key LIMIT 200 RETURN doc`,{'@collection':collection,after},trx);
          if(!rows.length)break;
          const last=String(rows[rows.length-1]?._key || '');
          if(!last || last<=after)throw Error('Invalid backup page ordering');
          this.db.transaction(()=>{for(const doc of rows)insert.run(database,generation,collection,doc._key,JSON.stringify(doc));})();
          counts[collection]+=rows.length;after=last;
          // Yield to foreground requests instead of monopolizing the event loop.
          await new Promise(resolve=>setTimeout(resolve,10));
        }
      }
      await this.store.client.database(database,'/_api/transaction/'+trx,{method:'PUT'});
      this.db.transaction(()=>{
        this.db.run(`INSERT INTO enterprise_knowledge_backups VALUES(?,?,?,?,?) ON CONFLICT(database_name) DO UPDATE SET
          snapshot_json=excluded.snapshot_json,entities=excluded.entities,links=excluded.links,completed_at=excluded.completed_at`,
          [database,JSON.stringify({format:'paged-v1',generation,collections:counts}),counts.entity || 0,counts.link || 0,new Date().toISOString()]);
        this.db.run('DELETE FROM enterprise_knowledge_backup_documents WHERE database_name=? AND generation<>?',[database,generation]);
      })();
    }catch(error){
      await this.store.client.database(database,'/_api/transaction/'+trx,{method:'DELETE'}).catch(()=>{});
      this.db.run('DELETE FROM enterprise_knowledge_backup_documents WHERE database_name=? AND generation=?',[database,generation]);
      throw error;
    }
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
    const configured = Number(process.env.ENTERPRISE_SQLITE_BACKUP_INTERVAL_MS || 3_600_000);
    const timer = setInterval(tick, Number.isFinite(configured) ? Math.max(1000, configured) : 3_600_000);
    timer.unref();
    void tick();
    return () => clearInterval(timer);
  }
}
