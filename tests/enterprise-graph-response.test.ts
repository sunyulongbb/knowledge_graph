import { test, expect } from 'bun:test';
import { createEnterpriseKnowledgeHandler } from '../src/server/routes/enterprise-knowledge.ts';
import { entityDocument } from '../src/server/arangodb.ts';

test('graph APIs return renderable Cytoscape nodes with business JSON and matching edge endpoints', async () => {
  const previous = process.env.KNOWLEDGE_STORAGE_BACKEND;
  process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  const source = { ...entityDocument({ id: 'a', name: 'A', data: '{"custom":"value"}' }), _id: 'entity/a' };
  const target = { ...entityDocument({ id: 'b', name: 'B', data: '{}' }), _id: 'entity/b' };
  const edge = { sqlite_id: 'r', source_id: 'a', target_id: 'b', property_id: 'related', _from: source._id, _to: target._id };
  const handler = createEnterpriseKnowledgeHandler({
    store: { ensure: async () => {}, require: async () => source,
      list: async () => ({ nodes: [source, target], total: 2 }), query: async () => [edge],
      relations: async () => [{ source, target, edge }] } as any,
    getProject: () => ({ id: 32, name: 'app32' }), getUser: () => null, canCreate: () => false,
  });
  try {
    for (const path of ['/api/kb/graph?db=app32', '/api/kb/node/graph?db=app32&id=entity/a']) {
      const url = new URL(path, 'http://local');
      const response = (await handler(new Request(url), url, 'GET'))!;
      expect(response.status).toBe(200);
      const data = await response.json();
      const elements = data.nodes.map((node: any) => node.group || node.data ? node : { group: 'nodes', data: node });
      expect(elements.map((element: any) => element.data.id)).toEqual(['a', 'b']);
      expect(elements[0].data.custom).toBe('value');
      expect(data.nodes[0].data).toBeUndefined();
      const ids = new Set(elements.map((element: any) => element.data.id));
      for (const edge of data.edges) {
        expect(ids.has(edge.source)).toBe(true);
        expect(ids.has(edge.target)).toBe(true);
      }
    }
  } finally {
    if (previous === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND;
    else process.env.KNOWLEDGE_STORAGE_BACKEND = previous;
  }
});
