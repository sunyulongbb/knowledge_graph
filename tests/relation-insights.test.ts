import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { buildRelationInsights } from '../src/server/relation-insights.ts';
import { EnterpriseKnowledgeStore } from '../src/server/enterprise-knowledge.ts';
import { ArangoClient, documentKey } from '../src/server/arangodb.ts';
import { createEnterpriseKnowledgeHandler } from '../src/server/routes/enterprise-knowledge.ts';

const node = (id: string, extra = {}) => ({ id, sqlite_id: id, _id: `entity/${documentKey(id)}`, labels: { zh: { value: id } }, visibility: 'public', ...extra });
const center = node('中心'), a = node('甲'), b = node('乙'), c = node('发现');
const edge = (id: string, from: any, to: any, name = '任职于') => ({ _key: id, sqlite_id: id, _from: from._id, _to: to._id, source_id: from.id, target_id: to.id, property_id: name, property_name: name });
const format = (node: any) => ({ id: node.id, name: node.labels.zh.value });
const paths = [
  { vertices: [center, a], edges: [edge('one', center, a)] },
  { vertices: [center, a], edges: [edge('two', a, center, '创立')] },
  { vertices: [center, b], edges: [edge('three', b, center, '管理')] },
  { vertices: [center, a, c], edges: [edge('one', center, a), edge('four', c, a, '位于')] },
  { vertices: [center, b, c], edges: [edge('three', b, center, '管理'), edge('five', c, b, '合作')] },
];

test('graph insights preserve parallel predicates and direction and rank discovery by distinct intermediaries', () => {
  const result = buildRelationInsights(center, [...paths, paths[0]!, paths[3]!], format, true);
  expect(result.relationInsights.summary).toEqual({ entities: 2, relations: 3, incoming: 2, outgoing: 1, relationTypes: 3, discoveries: 1 });
  expect(result.relationInsights.direct[0]!.relations.map((row: any) => row.direction)).toEqual(['outgoing', 'incoming']);
  expect(result.relationInsights.indirect[0]).toMatchObject({ node: { id: c.id }, sharedConnections: 2, pathCount: 2 });
  expect(result.relationInsights.indirect[0]!.paths[0].steps.map((row: any) => row.direction)).toEqual(['outgoing', 'incoming']);
  expect(result.relationInsights.truncated).toBe(true);
  expect(result.incomingRelations.find(row => row.source.id === b.id)!.secondLevel[0].source.id).toBe(c.id);
  const alsoDirect = buildRelationInsights(center, [...paths, { vertices: [center, c], edges: [edge('direct-c', center, c)] }], format);
  expect(alsoDirect.relationInsights.indirect).toHaveLength(0);
});

test('Arango traversal uses BFS, prunes private intermediaries and self edges, and bounds path results', async () => {
  const requests: any[] = [];
  const hidden = node('隐藏', { visibility: 'private', owner_user_id: 99 });
  const store = new EnterpriseKnowledgeStore(new ArangoClient({ url: 'http://arango', username: 'u', password: 'p' }, async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return Response.json({ result: [paths[0], { vertices: [center, hidden, c], edges: [edge('hidden1', center, hidden), edge('hidden2', hidden, c)] }, paths[1]] });
  }));
  const result = await store.relationPaths('app', center.id, null, 2);
  expect(result.paths).toHaveLength(1); expect(result.truncated).toBe(true);
  expect(requests[0].query).toContain('1..2 ANY @vertex link');
  expect(requests[0].query).toContain("order: 'bfs'"); expect(requests[0].query).toContain('PRUNE blocked');
  expect(requests[0].query).toContain('edge._from == edge._to'); expect(requests[0].query).toContain('neighbor.visibility');
  expect(requests[0].query).toContain('edge != null AND');
  expect(requests[0].query.indexOf('PRUNE')).toBeLessThan(requests[0].query.indexOf('OPTIONS'));
  expect(requests[0].bindVars).toMatchObject({ vertex: center._id, limit: 3, uid: -1, projects: [] });
});

test('detail and standalone insights endpoints use graph paths without legacy relation scans', async () => {
  const previous = process.env.KNOWLEDGE_STORAGE_BACKEND; process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  try {
    let attributes = 0;
    const handler = createEnterpriseKnowledgeHandler({ store: { ensure: async () => {}, require: async () => center,
      attributes: async () => { attributes++; return []; }, relationPaths: async () => ({ paths, truncated: false }),
      relations: () => { throw new Error('Legacy relation scan'); }, query: () => { throw new Error('Legacy second level scan'); } } as any,
      getProject: () => ({ id: 1, name: 'app' }), getUser: () => null, canCreate: () => false });
    for (const path of ['/api/kb/node', '/api/kb/node/relation-insights']) {
      const url = new URL(`http://local${path}?db=app&id=${encodeURIComponent(center.id)}`);
      const response = (await handler(new Request(url), url, 'GET'))!;
      expect(response.status).toBe(200); expect((await response.json()).relationInsights.summary.relations).toBe(3);
    }
    expect(attributes).toBe(1);
  } finally { if (previous === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND; else process.env.KNOWLEDGE_STORAGE_BACKEND = previous; }
});

class Element {
  children: Element[] = []; className = ''; textContent = ''; hidden = false;
  attrs: Record<string, string> = {}; events: Record<string, Function> = {};
  constructor(public tag: string) {}
  append(...nodes: Element[]) { this.children.push(...nodes); }
  replaceChildren() { this.children = []; }
  setAttribute(name: string, value: string) { this.attrs[name] = value; }
  addEventListener(name: string, callback: Function) { this.events[name] = callback; }
}
const all = (root: Element): Element[] => [root, ...root.children.flatMap(all)];

test('recommendation UI explains potential associations with expandable evidence and navigable entities using safe text', () => {
  const host = new Element('div'), section = new Element('section'), count = new Element('span'), status = new Element('span');
  const elements: Record<string, Element> = { detailIncomingRelations: section, detailIncomingRelationGroups: host, detailIncomingRelationCount: count, detailIncomingRelationStatus: status };
  const document = { createElement: (tag: string) => new Element(tag), getElementById: (id: string) => elements[id] };
  const opened: any[] = [], window: any = { setViewMode: (...args: any[]) => opened.push(args), kbViewMode: 'knowledge_detail' };
  new Function('window', 'document', readFileSync('public/assets/scripts/relation-insights.js', 'utf8'))(window, document);
  const insights = buildRelationInsights(center, paths, format, true).relationInsights;
  window.renderKnowledgeRelations(insights, format(center));
  const nodes = all(host);
  expect(nodes.some(node => node.textContent === '← 位于 —')).toBe(true);
  expect(nodes.some(node => node.textContent.includes('共同关联“甲”、“乙”'))).toBe(true);
  expect(nodes.some(node => node.textContent === '为什么推荐')).toBe(true);
  expect(nodes.some(node => node.tag === 'details')).toBe(true);
  expect(nodes.some(node => node.className === 'relation-tab')).toBe(false);
  expect(nodes.some(node => /两跳|直接关联/.test(node.textContent))).toBe(false);
  nodes.find(node => node.className === 'relation-path-node' && node.textContent === a.id)!.events.click!();
  expect(opened[0][1]).toMatchObject({ targetNodeId: a.id, focusDetailOnly: true });
  insights.recommendations[0]!.node.name = '<img src=x onerror=alert(1)>';
  window.renderKnowledgeRelations(insights, format(center));
  expect(all(host).some(node => node.tag === 'img')).toBe(false);
  expect(all(host).some(node => node.textContent === '<img src=x onerror=alert(1)>')).toBe(true);
});

test('recommendations fold large lists and reset to an explicit empty state on navigation', () => {
  const host = new Element('div'), section = new Element('section');
  const document = { createElement: (tag: string) => new Element(tag), getElementById: (id: string) => id === 'detailIncomingRelationGroups' ? host : id === 'detailIncomingRelations' ? section : new Element('span') };
  const window: any = {};
  new Function('window', 'document', readFileSync('public/assets/scripts/relation-insights.js', 'utf8'))(window, document);
  const manyPaths = Array.from({ length: 10 }, (_, index) => {
    const via = node(`共同实体${index}`), other = node(`推荐${index}`);
    return { vertices: [center, via, other], edges: [edge(`first${index}`, center, via), edge(`last${index}`, other, via)] };
  });
  window.renderKnowledgeRelations(buildRelationInsights(center, manyPaths, format).relationInsights, format(center));
  const cards = all(host).filter(node => node.className.includes('relation-recommendation') && node.tag === 'article');
  expect(cards.filter(card => card.hidden)).toHaveLength(4);
  const more = host.children.find(node => node.className === 'relation-more')!;
  more.events.click!(); expect(cards.some(card => card.hidden)).toBe(false); expect(more.attrs['aria-expanded']).toBe('true');
  more.events.click!(); expect(cards.filter(card => card.hidden)).toHaveLength(4);
  window.renderKnowledgeRelations(buildRelationInsights(center, [], format).relationInsights, format(center));
  expect(all(host).some(node => node.tag === 'article')).toBe(false);
  expect(all(host).some(node => node.className === 'relation-empty')).toBe(true);
});

test('recommendations prioritize matching relation patterns and ignore parallel statement inflation', () => {
  const same = node('相似实体'), generic = node('普通线索');
  const evidence = [
    { vertices: [center, a], edges: [edge('direct', center, a)] },
    { vertices: [center, a, same], edges: [edge('direct', center, a), edge('match', same, a)] },
    { vertices: [center, a, generic], edges: [edge('direct', center, a), edge('generic', a, generic, '其他关系')] },
  ];
  const first = buildRelationInsights(center, evidence, format).relationInsights.recommendations;
  expect(first[0]!.node.id).toBe(same.id);
  expect(first[0]!.reasons[0]).toContain('同样通过“任职于”关联到“甲”');
  const repeated = Array.from({ length: 20 }, (_, index) => ({ vertices: [center, a, generic], edges: [edge('direct', center, a), edge(`parallel${index}`, a, generic, '其他关系')] }));
  const second = buildRelationInsights(center, [...evidence, ...repeated], format).relationInsights.recommendations;
  expect(second.find(row => row.node.id === generic.id)!.score).toBe(first.find(row => row.node.id === generic.id)!.score);
  expect(second[0]!.node.id).toBe(same.id);
  expect(second.some(row => row.node.id === a.id || row.node.id === center.id)).toBe(false);
});

test('a single popular generic neighbor does not produce indiscriminate recommendations', () => {
  const evidence = Array.from({ length: 12 }, (_, index) => {
    const other = node(`泛关联${index}`);
    return { vertices: [center, a, other], edges: [edge('root', center, a), edge(`other${index}`, a, other, '其他关系')] };
  });
  const result = buildRelationInsights(center, evidence, format).relationInsights;
  expect(result.indirect).toHaveLength(12);
  expect(result.recommendations).toHaveLength(0);
});
