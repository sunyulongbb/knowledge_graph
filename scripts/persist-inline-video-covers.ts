/** Convert existing inline frames to file URLs, retaining their exact image bytes. */
import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { EnterpriseKnowledgeStore } from '../src/server/enterprise-knowledge.ts';
import { prepareEntityImageValues } from '../src/server/entity-media-images.ts';
const store = EnterpriseKnowledgeStore.configured();
const apply = process.argv.includes('--apply');
const backup = resolve('data/recovery', `inline-video-covers-${Date.now()}.jsonl`);
if (apply) mkdirSync(resolve('data/recovery'), { recursive: true });
const { body } = await store.client.system('/_api/database');
let found = 0, updated = 0;
for (const database of body.result.filter((name: string) => name !== '_system')) {
  const docs = await store.query(database, "FOR d IN entity FILTER CONTAINS(TO_STRING(d.covers), 'data:image/') RETURN d");
  for (const node of docs) {
    found++;
    if (!apply) continue;
    const covers = typeof node.covers === 'string' ? JSON.parse(node.covers) : node.covers;
    const prepared = await prepareEntityImageValues({ covers }, Number(node.project_id));
    await store.transaction(database, async trx => {
      const current = await store.get(database, node.sqlite_id || node.id, trx);
      if (!current || JSON.stringify(current.covers) !== JSON.stringify(node.covers)) throw new Error('Cover was modified concurrently; refusing to overwrite it');
      appendFileSync(backup, JSON.stringify({ database, document: current }) + '\n');
      await store.client.database(database, `/_api/document/entity/${node._key}`, {
        method: 'PATCH', headers: { 'x-arango-trx-id': trx, 'If-Match': current._rev },
        body: JSON.stringify({ covers: JSON.stringify(prepared.covers) }),
      });
      updated++;
    });
  }
}
console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', found, updated, ...(apply ? { backup } : {}) }));
