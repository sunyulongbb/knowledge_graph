import { test, expect } from 'bun:test';
import { createEnterpriseKnowledgeHandler } from '../src/server/routes/enterprise-knowledge.ts';
import { entityDocument } from '../src/server/arangodb.ts';

test('Enterprise node response matches incoming relation and neighbor UI contracts and filters private second-level nodes', async () => {
  const previous = process.env.KNOWLEDGE_STORAGE_BACKEND;
  process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  const node = (id: string, visibility = 'public') => ({ ...entityDocument({ id, name: id, visibility, owner_user_id: 99 }), _id: `entity/${id}` });
  const center = node('center'), source = node('source'), child = node('child'), hidden = node('hidden', 'private');
  const row = (from: any, to: any) => ({ source: from, target: to, edge: { sqlite_id: `${from.id}-${to.id}`, property_id: 'related', property_name: '关联' } });
  const handler = createEnterpriseKnowledgeHandler({
    store: { ensure: async () => {}, require: async () => center, attributes: async () => [],
      relations: async () => [row(source, center)], query: async () => [row(child, source), row(hidden, source), row(center, source)] } as any,
    getProject: () => ({ id: 1, name: 'app' }), getUser: () => null, canCreate: () => false,
  });
  try {
    const url = new URL('http://local/api/kb/node?db=app&id=center');
    const response = (await handler(new Request(url), url, 'GET'))!;
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.incomingRelations[0].source.id).toBe('source');
    expect(data.incomingRelations[0].propertyId).toBe('related');
    expect(data.incomingRelations[0].propertyName).toBe('关联');
    expect(data.incomingRelations[0].secondLevel.map((item: any) => item.source.id)).toEqual(['child']);
    expect(data.neighbors[0].node.id).toBe('source');
    expect(data.neighbors[0].edge.source).toBe('source');
    expect(data.neighbors[0].edge.target).toBe('center');
  } finally {
    if (previous === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND;
    else process.env.KNOWLEDGE_STORAGE_BACKEND = previous;
  }
});
