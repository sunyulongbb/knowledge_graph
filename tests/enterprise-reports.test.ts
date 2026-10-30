import { expect, test, spyOn } from 'bun:test';
import { readFileSync } from 'node:fs';
import { Database } from 'bun:sqlite';
import { ArangoClient, documentKey, entityDocument, edgeDocuments } from '../src/server/arangodb.ts';
import { EnterpriseKnowledgeStore, canUseArangoKnowledge } from '../src/server/enterprise-knowledge.ts';
import { buildEnterpriseReport } from '../src/server/enterprise-reports.ts';
import { createEnterpriseKnowledgeHandler } from '../src/server/routes/enterprise-knowledge.ts';
import { EnterpriseSqliteBackup } from '../src/server/enterprise-sqlite-backup.ts';

type Doc = Record<string, any>;
const user = { id: 42, username: 'author' };
const node = (id: string, name: string, type: string, extra = {}) => ({ ...entityDocument({ id, name, type, description: `${name}知识简介`, visibility: 'public', project_id: 7, ...extra }), _id: `entity/${documentKey(id)}` });
function fixture() {
  const root = node('zeus', '宙斯', 'god', { aliases: ['众神之王'] }), planet = node('jupiter', '木星', 'planet'), place = node('olympus', '奥林匹斯山', 'place');
  const hidden = node('secret', '宙斯', 'god', { visibility: 'private', owner_user_id: 99 });
  const nodes = [hidden, root, planet, place];
  const relation = (id: string, from: Doc, to: Doc, name: string) => ({ _key: id, sqlite_id: id, source_id: from.id, target_id: to.id,
    _from: from._id, _to: to._id, property_id: name, property_name: name });
  const one = relation('r1', planet, root, '对应神明'), two = relation('r2', planet, place, '命名来源');
  let paths: Doc[] = [{ vertices: [root, planet], edges: [one] }, { vertices: [root, planet, place], edges: [one, two] },
    { vertices: [root, hidden], edges: [relation('private', root, hidden, '私有关系')] }];
  const literal = edgeDocuments({ id: root.id }, [{ id: 'attribute', node_id: root.id, key: 'symbol', value: '雷霆', datatype: 'string', property_name_snapshot: '象征', statement_json: null, created_at: null }]);
  const reports = new Map<string, Doc>(), calls: Doc[] = [];
  let collection = false, fail = false;
  const store = new EnterpriseKnowledgeStore(new ArangoClient({ url: 'http://arango', username: 'u', password: 'p' }, async (input, init) => {
    const url = new URL(String(input)), path = url.pathname.replace('/_db/app', ''), method = init?.method || 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ path, method, body });
    if (path === '/_api/collection/knowledge_reports') return collection ? Response.json({}) : Response.json({ errorNum: 1203 }, { status: 404 });
    if (path === '/_api/collection' && method === 'POST') { collection = true; return Response.json({}); }
    if (path.startsWith('/_api/collection/')) return Response.json({});
    if (path === '/_api/document/knowledge_schema/definitions') return Response.json({ classes: [], properties: [], ontology_properties: [], ontologies: [
      { id: 'god', name: '神明' }, { id: 'planet', name: '行星' }, { id: 'place', name: '地点' } ] });
    if (path.startsWith('/_api/document/knowledge_reports/')) {
      const id = path.split('/').at(-1)!;
      if (method === 'DELETE') { reports.delete(id); return Response.json({}); }
      return reports.has(id) ? Response.json(reports.get(id)) : Response.json({ errorNum: 1202 }, { status: 404 });
    }
    if (path === '/_api/document/knowledge_reports' && method === 'POST') { reports.set(body.id, body); return Response.json({ _key: body.id }); }
    if (path === '/_api/cursor') {
      const { query, bindVars: vars } = body;
      if (fail) return Response.json({ errorMessage: 'offline' }, { status: 503 });
      let result: any[] = [];
      if (query.includes('RETURN { entity:')) result = [{ entity: nodes, link: [one, two], knowledge_schema: [], ...(query.includes('knowledge_reports:') ? { knowledge_reports: [...reports.values()] } : {}) }];
      else if (query.includes('FOR term IN @terms')) {
        expect(query).toContain('doc.visibility'); expect(query).toContain('doc.type NOT IN @excluded');
        result = vars.terms.map((term: string) => ({ term, matches: nodes.filter(item => canUseArangoKnowledge(item, user))
          .map(item => ({ node: item, score: item.labels.zh.value.toLowerCase() === term ? 100 : Object.values(item.aliases).flat().some((alias: any) => alias.value.toLowerCase() === term) ? 80 : item.labels.zh.value.includes(term) ? 50 : 0 }))
          .filter(item => item.score > 0).sort((a, b) => b.score - a.score) }));
      } else if (query.includes('FOR neighbor, edge, path')) result = paths;
      else if (query.includes('FOR edge IN link')) result = vars.vertex === root._id ? literal : [];
      else if (query.includes('FOR report IN knowledge_reports')) result = [...reports.values()];
      else if (query.includes('doc.sqlite_id IN @ids')) result = nodes.filter(item => vars.ids.includes(item.id) && canUseArangoKnowledge(item, user)).map(item => ({ id: item.id }));
      else throw new Error('Unexpected query: ' + query);
      return Response.json({ result });
    }
    throw new Error(`Unexpected request ${method} ${path}`);
  }));
  const handler = createEnterpriseKnowledgeHandler({ store, getProject: () => ({ id: 7, name: 'app' }), getUser: () => user, canCreate: () => true });
  return { store, handler, root, planet, nodes, reports, calls, setPaths: (value: Doc[]) => { paths = value; }, fail: () => { fail = true; } };
}
async function enterprise(work: () => Promise<void>) {
  const previous = process.env.KNOWLEDGE_STORAGE_BACKEND; process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  try { await work(); } finally { if (previous === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND; else process.env.KNOWLEDGE_STORAGE_BACKEND = previous; }
}
async function call(handler: any, path = '', method = 'GET', body?: any) {
  const url = new URL(`http://local/api/kb/reports${path}?db=app`);
  return (await handler(new Request(url, { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }) }), url, method)) as Response;
}

test('Arango report matches aliases to main entities and generates a consistent graph, content, attributes and chart counts', async () => {
  const f = fixture();
  const report = await buildEnterpriseReport(f.store, 'app', '行星与神明', ['众神之王'], user);
  expect(report.mainEntities).toMatchObject([{ id: 'zeus', name: '宙斯', matchedKeywords: ['众神之王'] }]);
  expect(report.statistics).toMatchObject({ mainEntityCount: 1, entityCount: 3, relationCount: 2, attributeCount: 1, truncated: false });
  expect(report.statistics.entityTypes.reduce((sum, item) => sum + item.value, 0)).toBe(report.graph.nodes.length);
  expect(report.statistics.relationTypes.reduce((sum, item) => sum + item.value, 0)).toBe(report.graph.edges.length);
  expect(report.sections[0]!.attributes).toMatchObject([{ name: '象征', value: '雷霆' }]);
  expect(report.sections[0]!.items.find(item => item.id === 'jupiter')!.relation).toBe('宙斯 ← 对应神明 — 木星');
  expect(report.sources.map(item => item.id)).not.toContain('secret');
  const ids = new Set(report.graph.nodes.map(item => item.data.id));
  for (const edge of report.graph.edges) { expect(ids.has(edge.data.source)).toBe(true); expect(ids.has(edge.data.target)).toBe(true); }
  expect(f.calls.filter(call => call.body.query?.includes('FOR term')).every(call => call.body.bindVars.terms.length === 1)).toBe(true);
});

test('unmatched keywords produce explicit empty reports rather than unrelated knowledge', async () => {
  const f = fixture(); const report = await buildEnterpriseReport(f.store, 'app', '宙斯', ['不存在'], user);
  expect(report.mainEntities).toHaveLength(0); expect(report.graph.nodes).toHaveLength(0); expect(report.unmatchedKeywords).toEqual(['不存在']);
  expect(report.statistics.entityCount).toBe(0);
});

test('large graph reports explicitly truncate and keep source and statistics totals consistent', async () => {
  const f = fixture();
  f.setPaths(Array.from({ length: 130 }, (_, index) => {
    const other = node(`other${index}`, `相关${index}`, 'planet');
    return { vertices: [f.root, other], edges: [{ _key: `edge${index}`, source_id: f.root.id, target_id: other.id, _from: f.root._id, _to: other._id, property_name: '关联' }] };
  }));
  const report = await buildEnterpriseReport(f.store, 'app', '报告', ['宙斯'], user);
  expect(report.statistics.truncated).toBe(true); expect(report.graph.nodes).toHaveLength(120);
  expect(report.statistics.entityCount).toBe(report.sources.length); expect(report.statistics.relationCount).toBe(report.graph.edges.length);
});

test('report create, read, edit, regenerate, list and delete persist solely in ArangoDB', () => enterprise(async () => {
  const f = fixture(); const created = await call(f.handler, '', 'POST', { title: '报告', keywords: ['宙斯'] });
  expect(created.status).toBe(201); const report = (await created.json()).report;
  expect(f.reports.has(report.id)).toBe(true); expect(report.analysis.source).toBe('arangodb');
  expect((await call(f.handler, '/' + report.id)).status).toBe(200);
  const edited = await call(f.handler, '/' + report.id, 'PATCH', { summary: '补充概述' }); expect((await edited.json()).report.summary).toBe('补充概述');
  expect((await (await call(f.handler)).json()).reports).toHaveLength(1);
  const regenerated = await call(f.handler, '/' + report.id + '/regenerate', 'POST', { keywords: ['众神之王'] }); expect((await regenerated.json()).report.mainEntities[0].id).toBe('zeus');
  expect((await call(f.handler, '/' + report.id, 'DELETE')).status).toBe(200); expect(f.reports.size).toBe(0);
}));

test('report snapshots are hidden when a source becomes inaccessible, and generation failures never save a report', () => enterprise(async () => {
  const f = fixture(); const report = (await (await call(f.handler, '', 'POST', { title: '报告', keywords: ['宙斯'] })).json()).report;
  Object.assign(f.planet, { visibility: 'private', owner_user_id: 99 });
  expect((await call(f.handler, '/' + report.id)).status).toBe(404);
  expect((await (await call(f.handler)).json()).reports).toHaveLength(0);
  f.fail(); const log = spyOn(console, 'error').mockImplementation(() => {});
  try { expect((await call(f.handler, '', 'POST', { title: '失败', keywords: ['宙斯'] })).status).toBe(503); expect(f.reports.size).toBe(1); }
  finally { log.mockRestore(); }
}));

test('scheduled SQLite backup includes saved Arango reports', () => enterprise(async () => {
  const f = fixture(); await call(f.handler, '', 'POST', { title: '报告', keywords: ['宙斯'] });
  const db = new Database(':memory:');
  try {
    const backup = new EnterpriseSqliteBackup(db, f.store); await backup.flush('app');
    const saved = db.query('SELECT snapshot_json FROM enterprise_knowledge_backups').get() as any;
    expect(JSON.parse(saved.snapshot_json).knowledge_reports).toHaveLength(1);
  } finally { db.close(); }
}));

test('report writes require login and application membership before contacting Arango', () => enterprise(async () => {
  for (const [current, member, status] of [[null, true, 401], [user, false, 403]] as const) {
    const f = fixture();
    const handler = createEnterpriseKnowledgeHandler({ store: f.store, getProject: () => ({ id: 7, name: 'app' }), getUser: () => current, canCreate: () => member });
    expect((await call(handler, '', 'POST', { title: '报告', keywords: ['宙斯'] })).status).toBe(status);
    expect(f.calls).toHaveLength(0); expect(f.reports.size).toBe(0);
  }
}));

class Element {
  children: Element[] = []; className = ''; textContent = ''; hidden = false;
  attrs: Record<string, string> = {}; style = { setProperty: () => {} };
  constructor(public tag: string) {}
  append(...nodes: Element[]) { this.children.push(...nodes); }
  replaceChildren() { this.children = []; }
  setAttribute(key: string, value: string) { this.attrs[key] = value; }
}
const all = (root: Element): Element[] => [root, ...root.children.flatMap(all)];
test('report charts show accessible exact values and safely render database labels', () => {
  const window: any = {}, document = { createElement: (tag: string) => new Element(tag) };
  new Function('window', 'document', readFileSync('public/assets/scripts/report-visuals.js', 'utf8'))(window, document);
  const host = new Element('div');
  window.renderReportStatistics(host, { mainEntityCount: 1, entityCount: 3, relationCount: 2, attributeCount: 4,
    entityTypes: [{ label: '<img src=x>', value: 3 }], relationTypes: [{ label: '任职于', value: 2 }], mainConnections: [{ label: '主实体', value: 2 }] });
  expect(all(host).filter(node => node.tag === 'table')).toHaveLength(3);
  expect(all(host).some(node => node.textContent === '<img src=x>')).toBe(true); expect(all(host).some(node => node.tag === 'img')).toBe(false);
  expect(all(host).filter(node => node.className === 'report-stat-value').map(node => node.textContent)).toEqual(['3', '2', '2']);
  window.renderReportStatistics(host, null); expect(host.hidden).toBe(true); expect(host.children).toHaveLength(0);
});

test('report graph renders generated entities and directed edges without needing a saved canvas', () => {
  let options: any;
  const handlers: any[] = [];
  const cy = { on: (...args: any[]) => handlers.push(args) };
  const window: any = { cytoscape: (value: any) => { options = value; return cy; } };
  new Function('window', 'document', readFileSync('public/assets/scripts/report-visuals.js', 'utf8'))(window, {});
  const graph = { nodes: [{ data: { id: 'main', label: '主实体', isMain: 1 } }, { data: { id: 'related', label: '关联实体', isMain: 0 } }],
    edges: [{ data: { id: 'edge', source: 'main', target: 'related', label: '关联关系' } }] };
  expect(window.renderGeneratedReportGraph(new Element('div'), graph)).toBe(cy);
  expect(options.elements).toHaveLength(3); expect(options.layout.name).toBe('concentric');
  expect(options.style.find((entry: any) => entry.selector === 'edge').style['target-arrow-shape']).toBe('triangle');
  expect(handlers.some(entry => entry[0] === 'dbltap' && entry[1] === 'node')).toBe(true);
});
