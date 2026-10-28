import { expect, test, spyOn } from 'bun:test';
import { createEnterpriseKnowledgeHandler } from '../src/server/routes/enterprise-knowledge.ts';

test('uninitialized graph returns actionable status without masking actual service failures', async () => {
  const previous = process.env.KNOWLEDGE_STORAGE_BACKEND;
  process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  const log = spyOn(console, 'error').mockImplementation(() => {});
  let error = Object.assign(new Error('database not found'), { status: 404, body: { errorNum: 1228 } });
  const handler = createEnterpriseKnowledgeHandler({
    store: { ensure: async () => { throw error; } } as any,
    getProject: () => ({ id: 1, name: 'default' }), getUser: () => null, canCreate: () => false,
  });
  const url = new URL('http://local/api/kb/nodes?db=default');
  try {
    const response = (await handler(new Request(url), url, 'GET'))!;
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe('KNOWLEDGE_DATABASE_NOT_INITIALIZED');
    expect(body.database).toBe('default');
    expect(body.error).toContain('知识同步');
    expect(log).not.toHaveBeenCalled();
    error = Object.assign(new Error('collection not found'), { status: 404, body: { errorNum: 1203 } });
    expect((await handler(new Request(url), url, 'GET'))!.status).toBe(503);
    expect(log).toHaveBeenCalledTimes(1);
  } finally {
    log.mockRestore();
    if (previous === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND;
    else process.env.KNOWLEDGE_STORAGE_BACKEND = previous;
  }
});
