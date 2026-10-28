/** One-time additive recovery from a verified offline backup. Dry run unless --apply. */
import { Database } from 'bun:sqlite';
import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { EnterpriseKnowledgeStore } from '../src/server/enterprise-knowledge.ts';
const source = process.argv.find(arg => arg.startsWith('--source='))?.slice('--source='.length);
if (!source) throw new Error('Usage: bun run scripts/backfill-arango-categories.ts --source=<verified.sqlite> [--apply]');
const apply = process.argv.includes('--apply');
const db = new Database(resolve(source), { readonly: true });
const check = db.query('PRAGMA integrity_check').all() as any[];
if (check.length !== 1 || Object.values(check[0])[0] !== 'ok') throw new Error('Source backup failed integrity check');
const store = EnterpriseKnowledgeStore.configured();
const projects = db.query('SELECT id,name,is_default FROM projects ORDER BY id').all() as any[];
const backup = resolve('data/recovery', `arango-category-before-${Date.now()}.jsonl`);
if (apply) mkdirSync(resolve('data/recovery'), { recursive: true });
let eligible = 0, updated = 0, associations = 0, missing = 0, preserved = 0;
try {
  for (const project of projects) {
    const rows = db.query(`SELECT DISTINCT n.id,ec.class_id FROM nodes n
      JOIN entity_classes ec ON REPLACE(ec.entity_id,'entity/','')=n.id
      JOIN classes c ON c.id=ec.class_id
      WHERE (n.project_id=? OR (n.project_id IS NULL AND ?=1)) AND c.project_id=?
      ORDER BY n.id,ec.class_id`).all(project.id, project.is_default, project.id) as any[];
    const groups = new Map<string, string[]>();
    for (const row of rows) groups.set(row.id, [...(groups.get(row.id) || []), row.class_id]);
    for (const [id, classIds] of groups) {
      const node = await store.get(project.name, id);
      if (!node) { missing++; continue; }
      if (node.classification_initialized || node.class_ids?.length) { preserved++; continue; }
      eligible++; associations += classIds.length;
      if (!apply) continue;
      await store.transaction(project.name, async trx => {
        const current = await store.get(project.name, id, trx);
        if (!current || current.classification_initialized || current.class_ids?.length) { preserved++; return; }
        // Record the complete original document before any modification, including its revision.
        appendFileSync(backup, JSON.stringify({ database: project.name, document: current }) + '\n');
        const changes = { class_ids: classIds, classification_initialized: true };
        await store.client.database(project.name, `/_api/document/entity/${current._key}`, {
          method: 'PATCH', headers: { 'x-arango-trx-id': trx, 'If-Match': current._rev }, body: JSON.stringify(changes),
        });
        updated++;
      });
    }
  }
  console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', eligible, updated, associations, missing, preserved, ...(apply ? { backup } : {}) }));
} finally { db.close(); }
