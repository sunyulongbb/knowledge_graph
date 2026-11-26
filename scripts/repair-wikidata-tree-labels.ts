import { EnterpriseKnowledgeStore } from '../src/server/enterprise-knowledge.ts';
import { importProxyOptions } from '../src/server/import-proxy.ts';
import { mkdirSync } from 'node:fs';
const store = EnterpriseKnowledgeStore.configured();
const { body } = await store.client.system('/_api/database');
for (const db of body.result.filter((name: string) => name !== '_system')) {
  const schema = await store.importSchema(db).catch(() => null);
  if (!schema) continue;
  const rows = [...schema.ontologies, ...schema.classes];
  const getId = (row: any) => row.wikidata_id || row.id.match(/^(?:ontology|wikidata-class)\/(Q[1-9][0-9]*)$/)?.[1];
  const ids = [...new Set<string>(rows.map(getId).filter(Boolean))];
  if (!ids.length) continue;
  const labels = new Map<string, string>();
  for (let offset = 0; offset < ids.length; offset += 50) {
    const url = new URL('https://query.wikidata.org/sparql');
    url.searchParams.set('query', `SELECT ?item ?itemLabel WHERE { VALUES ?item { ${ids.slice(offset, offset + 50).map(id => `wd:${id}`).join(' ')} } SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,zh-hans,zh-hant,en". } }`);
    url.searchParams.set('format', 'json');
    const response = await fetch(url, { ...importProxyOptions(), signal: AbortSignal.timeout(20000), headers: { Accept: 'application/sparql-results+json' } });
    if (!response.ok) throw new Error(`Label request HTTP ${response.status}`);
    const data = await response.json() as any;
    for (const row of data.results.bindings) {
      const id = row.item.value.split('/').pop();
      if (row.itemLabel?.value && row.itemLabel.value !== id) labels.set(id, row.itemLabel.value);
    }
  }
  const backup = structuredClone(schema);
  let changed = 0;
  for (const row of rows) { const name = labels.get(getId(row)); if (name && name !== row.name) { row.name = name; changed++; } }
  if (!changed) continue;
  mkdirSync('data/recovery', { recursive: true });
  const file = `data/recovery/tree-labels-${db}-${Date.now()}.json`;
  await Bun.write(file, JSON.stringify({ database: db, schema: backup }, null, 2));
  await store.transaction(db, async trx => {
    await store.client.database(db, '/_api/document/knowledge_schema/definitions', { method: 'PATCH', headers: { 'x-arango-trx-id': trx }, body: JSON.stringify({ ontologies: schema.ontologies, classes: schema.classes }) });
  }, ['knowledge_schema']);
  console.log(JSON.stringify({ database: db, namesUpdated: changed, backup: file }));
}
