import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ArangoClient, configFromEnvironment, ElasticsearchClient } from '../src/server/arangodb.ts';
import { EnterpriseKnowledgeStore } from '../src/server/enterprise-knowledge.ts';
import { ArangoElasticsearchSync } from '../src/server/entity-elasticsearch-sync.ts';
import { normalizeValue } from '../src/shared/wikidata.ts';
import { earthPoint } from '../src/shared/geography.ts';

// Explicit one-time repair; normal reads never interpret string attributes as coordinates.
const database = process.argv[2];
if (!database) throw Error('Usage: bun scripts/fix-coordinate-storage.ts DATABASE [--apply]');
const store = new EnterpriseKnowledgeStore(new ArangoClient(configFromEnvironment()!));
const property = 'attr/coordinates';
const apply = process.argv.includes('--apply');
const result = await store.transaction(database, async trx => {
  const edges = await store.query(database, 'FOR e IN link FILTER e.property_id == @property RETURN e', { property }, trx);
  const schema = await store.importSchema(database, trx);
  if (!schema?.properties.some(p => p.id === property)) throw Error('Coordinate property definition missing');
  const updates = edges.map(edge => {
    const old = edge.mainsnak?.datavalue?.value ?? edge.value;
    let value = old;
    if (typeof old === 'string') {
      const match = old.match(/^\s*(\d+(?:\.\d+)?)°?\s*([NS]),\s*(\d+(?:\.\d+)?)°?\s*([EW])\s*$/i);
      if (!match) throw Error(`Invalid coordinate in ${edge._key}; nothing committed`);
      value = { latitude: Number(match[1]) * (match[2]!.toUpperCase() === 'S' ? -1 : 1),
        longitude: Number(match[3]) * (match[4]!.toUpperCase() === 'W' ? -1 : 1) };
    }
    value = normalizeValue('globe-coordinate', value);
    const geo = earthPoint(value);
    if (!geo) throw Error(`Invalid Earth coordinate in ${edge._key}`);
    const statement = JSON.parse(edge.attribute.statement_json || '{}');
    const datavalue = { type: 'globecoordinate', value };
    const mainsnak = { ...edge.mainsnak, datatype: 'globe-coordinate', datavalue };
    const normalized = { ...statement, datatype: 'globe-coordinate', value, datavalue,
      ...(statement.mainsnak ? { mainsnak } : {}) };
    return { _key: edge._key, _rev: edge._rev, datatype: 'globe-coordinate', value, mainsnak, geo,
      attribute: { ...edge.attribute, datatype: 'globe-coordinate', value: JSON.stringify(value), statement_json: JSON.stringify(normalized) } };
  });
  if (apply) {
    const backup = join(tmpdir(), `kg-coordinate-backup-${Date.now()}.json`);
    writeFileSync(backup, JSON.stringify({ database, edges, schema }, null, 2));
    console.log(JSON.stringify({ backup }));
    await store.query(database, `FOR patch IN @updates UPDATE patch._key WITH patch IN link OPTIONS { ignoreRevs: false, mergeObjects: false } RETURN NEW._key`, { updates }, trx);
    await store.query(database, `UPDATE 'definitions' WITH { properties: @properties } IN knowledge_schema`, {
      properties: schema.properties.map(p => p.id === property ? { ...p, datatype: 'globe-coordinate', valuetype: 'globecoordinate' } : p),
    }, trx);
  }
  return { apply, corrected: updates.length, property, datatype: 'globe-coordinate', sample: updates[0]?.value };
}, ['knowledge_schema']);
console.log(JSON.stringify(result));
if (apply) {
  const url = process.env.ELASTICSEARCH_URL;
  if (!url) throw Error('ArangoDB repaired; ES URL missing, synchronization still required');
  console.log(JSON.stringify({ elasticsearchIndexed: await new ArangoElasticsearchSync(store, new ElasticsearchClient({ url })).afterWrite(database) }));
}
