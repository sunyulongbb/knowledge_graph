import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { apiErrorResponse } from '../src/server/api-error.ts';

const source = readFileSync('public/assets/scripts/user-profile.js', 'utf8');
const block = source.slice(source.indexOf('  async function api('), source.indexOf('  function avatar('));
const api = (response: Response) => new Function('fetch', 'location', `${block}; return api;`)(async () => response, { origin: 'http://localhost' });

test('profile handles plain-text errors and invalid success JSON without exposing parsing errors', async () => {
  for (const [status, body] of [[500, 'Internal Server Error'], [502, '<html>Bad gateway</html>'], [200, 'invalid']] as const) {
    try { await api(new Response(body, { status }))('summary'); throw Error('expected failure'); }
    catch (error: any) {
      expect(error.message).not.toContain('Unexpected token');
      expect(error.message).not.toContain(body);
      expect(error.status).toBe(status);
    }
  }
});

test('corrupt databases return private JSON errors that profile can display', async () => {
  const response = apiErrorResponse({ code: 'SQLITE_CORRUPT', message: '/private/database/path' });
  expect(response.status).toBe(503);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  const data = await response.clone().json();
  expect(data.code).toBe('DATABASE_CORRUPT');
  expect(data.error).toContain('数据库文件损坏');
  await expect(api(response)('summary')).rejects.toThrow(data.error);
});

test('generic exceptions do not expose internal details and auth errors retain their status', async () => {
  const response = apiErrorResponse(Error('private SQL and credentials'));
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain('private SQL');
  try { await api(Response.json({ error: '请先登录' }, { status: 401 }))('summary'); }
  catch (error: any) { expect(error.status).toBe(401); expect(error.message).toBe('请先登录'); return; }
  throw Error('expected auth failure');
});
