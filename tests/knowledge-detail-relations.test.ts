import { test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';

const coreKbSource = readFileSync(new URL('../src/server/routes/core-kb.ts', import.meta.url), 'utf8');
const nodeRoute = coreKbSource.slice(
  coreKbSource.indexOf('  if (url.pathname === "/api/kb/node" && method === "GET") {'),
  coreKbSource.indexOf("  if (url.pathname === '/api/kb/node/relation-order'"),
);

const detailPanelSource = readFileSync(new URL('../public/assets/scripts/detail-panel.js', import.meta.url), 'utf8');
const incomingRelationsBlock = detailPanelSource.slice(
  detailPanelSource.indexOf('  function renderIncomingRelations(relations) {'),
  detailPanelSource.indexOf('  function renderNativePdfFallback('),
);

type RelationItem = { source: { id: string }; propertyId: string; propertyName: string; secondLevel?: RelationItem[] };

function createNodeRouteRunner() {
  const js = new Bun.Transpiler({ loader: 'ts' }).transformSync(nodeRoute);
  return new Function(
    'url',
    'method',
    'db',
    'hasProjectScope',
    'scopedProjectId',
    'scopedClause',
    'formatNode',
    'canAccessKnowledge',
    'knowledgeContext',
    'getKnowledgeUser',
    'parseStoredAttributeValues',
    'extractEntityId',
    'req',
    js,
  ) as (...args: any[]) => Promise<{ json: () => Promise<{ incomingRelations: RelationItem[] }> }>;
}

function parseStoredAttributeValues(raw: unknown) {
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function extractEntityId(value: any) {
  if (!value?.id) return '';
  return String(value.id).replace(/^entity\//, '');
}

async function fetchNodeRelations() {
  const db = new Database(':memory:');
  try {
    db.exec(`CREATE TABLE nodes(id TEXT, project_id TEXT, name TEXT);
      CREATE TABLE attributes(id TEXT, node_id TEXT, datatype TEXT, value TEXT, key TEXT, property_name_snapshot TEXT);
      CREATE TABLE properties(id TEXT, name TEXT);
      INSERT INTO nodes VALUES ('A','p','甲'),('B','p','乙'),('C','p','丙'),('D','p','丁'),('Y','p','戊'),('Z','p','己');
      INSERT INTO properties VALUES ('p1','隶属于'),('p2','上级'),('p3','职位');
      INSERT INTO attributes VALUES
        ('b-a','B','wikibase-entityid','{"id":"A"}','p1','隶属于'),
        ('d-a','D','wikibase-entityid','{"id":"A"}','p1','隶属于'),
        ('c-b','C','wikibase-entityid','{"id":"B"}','p2','上级'),
        ('d-b','D','wikibase-entityid','{"id":"B"}','p2','上级'),
        ('a-b','A','wikibase-entityid','{"id":"B"}','p1','隶属于'),
        ('z-b','Z','wikibase-entityid','{"id":"B"}','p2','上级'),
        ('y-d','Y','wikibase-entityid','{"id":"D"}','p3','职位');`);
    return await createNodeRouteRunner()(
      new URL('http://localhost/api/kb/node?id=A'),
      'GET',
      db,
      true,
      'p',
      () => 'project_id = ?',
      (node: any) => node,
      (_db: unknown, _user: unknown, id: string) => id !== 'Z',
      { getStore: () => ({ user: { id: 1 } }) },
      () => null,
      parseStoredAttributeValues,
      extractEntityId,
      {},
    );
  } finally {
    db.close();
  }
}

test('knowledge detail relations carry a second incoming level', async () => {
  const data = await (await fetchNodeRelations()).json();
  expect(data.incomingRelations.map((item) => [item.source.id, item.propertyName])).toEqual([
    ['B', '隶属于'],
    ['D', '隶属于'],
  ]);
  const byId = new Map(data.incomingRelations.map((item) => [item.source.id, item]));
  expect((byId.get('B') as RelationItem).secondLevel?.map((item) => [item.source.id, item.propertyName])).toEqual([
    ['C', '上级'],
    ['D', '上级'],
  ]);
  expect((byId.get('D') as RelationItem).secondLevel?.map((item) => [item.source.id, item.propertyName])).toEqual([
    ['Y', '职位'],
  ]);
});

test('second incoming level skips the current node and inaccessible entities', async () => {
  const data = await (await fetchNodeRelations()).json();
  const nestedIds = data.incomingRelations.flatMap((item) => item.secondLevel || []).map((item) => item.source.id);
  expect(nestedIds).not.toContain('A');
  expect(nestedIds).not.toContain('Z');
});

class StubElement {
  children: StubElement[] = [];
  className = '';
  textContent = '';
  hidden = false;
  style: { props: Record<string, string>; setProperty: (key: string, value: string) => void };
  constructor(public tag: string) {
    const props: Record<string, string> = {};
    this.style = { props, setProperty: (key, value) => { props[key] = value; } };
  }
  append(...items: StubElement[]) { this.children.push(...items); }
  appendChild(item: StubElement) { this.children.push(item); return item; }
  replaceChildren() { this.children = []; }
  setAttribute() {}
  addEventListener() {}
}

function renderRelations(relations: unknown) {
  const host = new StubElement('div');
  const section = new StubElement('section');
  const count = new StubElement('span');
  const document = {
    getElementById: (id: string) =>
      id === 'detailIncomingRelationGroups' ? host : id === 'detailIncomingRelations' ? section : count,
    createElement: (tag: string) => new StubElement(tag),
  };
  const render: (value: unknown) => void = new Function(
    'window',
    'document',
    'showNodeDetailInline',
    `${incomingRelationsBlock}\nreturn renderIncomingRelations;`,
  )({}, document, () => {});
  render(relations);
  return { host, section, count };
}

function relatedName(element: StubElement) {
  const item = element.tag === 'button' ? element : element.children[0];
  return item.children[1].children[0].textContent;
}

test('detail panel nests the second incoming level under each related entity', () => {
  const { host, section, count } = renderRelations([
    {
      source: { id: 'B', name: '乙' },
      propertyId: 'p1',
      propertyName: '隶属于',
      secondLevel: [
        { source: { id: 'C', name: '丙' }, propertyName: '上级' },
        { source: { id: 'D', name: '丁' }, propertyName: '上级' },
      ],
    },
    { source: { id: 'E', name: '戊' }, propertyId: 'p2', propertyName: '关联' },
  ]);

  expect(section.hidden).toBe(false);
  expect(count.textContent).toBe('2 条指向当前知识 · 二级关联 2 条');
  const [group] = host.children;
  expect(group.children[1].children.map(relatedName).sort()).toEqual(['乙', '戊']);
  const nested = group.children[1].children.find((node) => relatedName(node) === '乙')!.children[1];
  expect(nested.className).toBe('detail-related-children');
  expect(nested.children.map(relatedName)).toEqual(['丙', '丁']);
  expect(nested.children.every((child) => child.className === 'detail-related-item detail-related-item-child')).toBe(true);
  expect(nested.children[0].children[1].children[1].textContent).toBe('上级');
  expect(nested.children[0].children[1].children[0].textContent).toBe('丙');
  expect(group.children[1].children.find((node) => relatedName(node) === '戊')!.children.length).toBe(1);
});

test('detail panel lists every first-level related entity', () => {
  const { host } = renderRelations(
    Array.from({ length: 7 }, (_, index) => ({
      source: { id: `N${index}`, name: `实体${index}` },
      propertyId: 'p1',
      propertyName: '关联',
    })),
  );
  const [group] = host.children;
  expect(group.children[0].children[1].textContent).toBe('7 条');
  expect(group.children[1].children).toHaveLength(7);
});
