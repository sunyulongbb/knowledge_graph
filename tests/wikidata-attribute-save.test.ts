import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import * as model from '../src/shared/wikidata.ts';

// Exercise the real save branch and formatter against an isolated database.
// Importing the server database module would open the user's application data.
function setup() {
  const db = new Database(':memory:');
  db.run('CREATE TABLE properties (id TEXT, name TEXT, status TEXT, datatype TEXT, valuetype TEXT)');
  db.run('CREATE TABLE nodes (id TEXT, name TEXT)');
  db.run('CREATE TABLE attributes (id TEXT PRIMARY KEY, node_id TEXT, key TEXT, value TEXT, datatype TEXT, property_name_snapshot TEXT, statement_json TEXT)');
  const transpiler = new Bun.Transpiler({ loader: 'ts' });
  const utils = readFileSync(new URL('../src/server/utils.ts', import.meta.url), 'utf8');
  const formatter = utils.slice(utils.indexOf('export function formatAttribute('), utils.indexOf('// ── ID Generators')).replace('export function', 'function');
  const deps = { db, ...model, syncPropertyTypeForNode() {}, syncAttrImagesToNode() {}, saveDataUrlImageToLocal: async (v: string) => v };
  const bindings = `const { ${Object.keys(deps).join(', ')} } = deps;`;
  const formatAttribute = new Function('deps', transpiler.transformSync(bindings + formatter + '; return formatAttribute;'))(deps);
  const routes = readFileSync(new URL('../src/server/routes/core-kb.ts', import.meta.url), 'utf8');
  const start = routes.indexOf('  if (url.pathname === "/api/kb/attributes/save"');
  const end = routes.indexOf('  if (url.pathname.startsWith("/api/kb/attributes/")', start);
  const save = new Function('deps', 'formatAttribute', transpiler.transformSync(bindings + 'return async function(req, url, method) {' + routes.slice(start, end) + '}'))(deps, formatAttribute);
  return { db, formatAttribute, save: async (body: any) => save(new Request('http://localhost/api/kb/attributes/save', { method: 'POST', body: JSON.stringify(body) }), new URL('http://localhost/api/kb/attributes/save'), 'POST') };
}

test('attribute API stores canonical statement and round trips metadata', async () => {
  const { db, save } = setup();
  try {
    db.run("INSERT INTO properties VALUES ('P1', 'link', 'active', 'url', 'string')");
    const response = await save({ id: 'a1', node_id: 'n1', property: 'P1', datatype: 'url', value: 'https://example.org', rank: 'preferred', qualifiers: { P2: [] }, references: [{ snaks: {} }] });
    expect(response.status).toBe(200);
    const saved = await response.json();
    expect(saved.datatype).toBe('url');
    expect(saved.datavalue.type).toBe('string');
    expect(saved.ui_datatype).toBe('url');
    const updated = await (await save({ id: 'a1', node_id: 'n1', property: 'P1', datatype: 'url', value: 'https://example.org/next' })).json();
    expect(updated.rank).toBe('preferred');
    expect(updated.qualifiers).toEqual({ P2: [] });
    expect(updated.references).toEqual([{ snaks: {} }]);
    const stored: any = db.query('SELECT statement_json FROM attributes WHERE id = ?').get('a1');
    expect(JSON.parse(stored.statement_json).datavalue.type).toBe('string');
  } finally { db.close(); }
});

test('special values save without datavalue; invalid values do not write', async () => {
  const { db, save } = setup();
  try {
    for (const snaktype of ['somevalue', 'novalue']) {
      const response = await save({ id: snaktype, node_id: 'n1', property: 'P2', datatype: 'time', snaktype });
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.snaktype).toBe(snaktype);
      expect(result.datavalue).toBeUndefined();
    }
    const invalid = await save({ id: 'bad', node_id: 'n1', property: 'P2', datatype: 'quantity', value: { amount: '12bad' } });
    expect(invalid.status).toBe(400);
    expect(db.query("SELECT id FROM attributes WHERE id = 'bad'").get()).toBeNull();
  } finally { db.close(); }
});

test('legacy text IDs and date values retain semantics when formatted', () => {
  const { db, formatAttribute } = setup();
  try {
    expect(formatAttribute({ id: 'a', key: 'P1', datatype: 'string', value: '00123' }).datavalue.value).toBe('00123');
    expect(formatAttribute({ id: 'a', key: 'P1', datatype: 'time', value: '{"date":"2026-09-07"}' }).datavalue.value).toMatchObject({ time: '+2026-09-07T00:00:00Z', precision: 11 });
    expect(formatAttribute({ id: 'a', key: 'P1', datatype: 'wikibase-entityid', value: '{"id":"Q30"}' })).toMatchObject({ datatype: 'wikibase-item', datavalue: { type: 'wikibase-entityid', value: { id: 'Q30' } } });
  } finally { db.close(); }
});
