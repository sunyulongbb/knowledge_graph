import { expect, test } from 'bun:test';
import { createEnterpriseKnowledgeHandler, enterpriseKnowledgePath } from '../src/server/routes/enterprise-knowledge.ts';

test('enterprise tag endpoint merges Arango, category and custom tags in server order', async () => {
  const previous = process.env.KNOWLEDGE_STORAGE_BACKEND;
  process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  try {
    let requestedDatabase = '';
    const handler = createEnterpriseKnowledgeHandler({
      store: { ensure: async () => {}, tags: async (database: string) => { requestedDatabase = database; return ['香蕉', '苹果']; } } as any,
      getProject: () => ({ id: 7, name: 'app' }),
      getUser: () => ({ id: 42, username: 'owner' }), canCreate: () => true,
      getSchema: () => ({ classes: [{ id: 'c', tags: '["苹果","阿尔法"]' }], ontologies: [], properties: [] }),
    });
    const url = new URL('http://localhost/api/kb/tags?db=app');
    url.searchParams.set('custom_tags', '["自定义"]');
    const response = await handler(new Request(url), url, 'GET');
    expect(enterpriseKnowledgePath(url.pathname)).toBe(true);
    expect(response?.status).toBe(200);
    expect((await response!.json()).tags).toEqual(['阿尔法', '苹果', '香蕉', '自定义']);
    expect(requestedDatabase).toBe('app');
  } finally {
    if (previous === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND;
    else process.env.KNOWLEDGE_STORAGE_BACKEND = previous;
  }
});
