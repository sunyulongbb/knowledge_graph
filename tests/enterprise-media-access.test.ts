import { expect, test, spyOn } from 'bun:test';
import { createEnterpriseKnowledgeHandler } from '../src/server/routes/enterprise-knowledge.ts';

test('media lookup passes unmigrated applications and still checks permission before serving', async () => {
  const previous = process.env.KNOWLEDGE_STORAGE_BACKEND;
  process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  const log = spyOn(console, 'error').mockImplementation(() => {});
  const path = '/static/uploads/32/node-images/test.png';
  let served = 0;
  let readable = true;
  let missingCode = 1228;
  const checked: string[] = [];
  const user = { id: 42, username: 'owner' };
  const projects = [{ name: 'unmigrated' }, { name: 'actual' }];
  const handler = createEnterpriseKnowledgeHandler({
    store: { mediaReadable: async (database: string, requested: string, current: unknown) => {
      checked.push(database);
      expect(requested).toBe(path);
      expect(current).toBe(user);
      if (database === 'unmigrated') throw Object.assign(new Error('not found'), { status: 404, body: { errorNum: missingCode } });
      return readable;
    } } as any,
    getUser: () => user, getProject: name => projects.find(project => project.name === name) || null,
    listProjects: () => projects, canCreate: () => false,
    serveMedia: async () => { served++; return new Response('image', { headers: { 'Content-Type': 'image/png' } }); },
  });
  const request = async (query = '') => {
    const req = new Request(`http://local${path}${query}`);
    return (await handler(req, new URL(req.url), 'GET'))!;
  };
  try {
    expect((await request()).status).toBe(200);
    expect(checked).toEqual(['unmigrated', 'actual']);
    expect(served).toBe(1);
    readable = false;
    expect((await request()).status).toBe(404);
    expect(served).toBe(1);
    expect((await request('?db=unmigrated')).status).toBe(404);
    missingCode = 1203; // Missing collection is a real backend failure.
    expect((await request()).status).toBe(503);
    expect(served).toBe(1);
    readable = true;
    expect((await request()).status).toBe(200);
  } finally {
    log.mockRestore();
    if (previous === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND;
    else process.env.KNOWLEDGE_STORAGE_BACKEND = previous;
  }
});
