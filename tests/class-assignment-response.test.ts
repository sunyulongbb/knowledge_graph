import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../public/assets/scripts/schema-panel.js', import.meta.url), 'utf8');
const start = source.indexOf('  function appendCurrentDbToUrl(');
const end = source.indexOf('  function openClassModal(', start);
function setup(window: any) {
  return new Function('window', source.slice(start, end) + '\nreturn {appendCurrentDbToUrl,readEntityClassResponse};')(window);
}
test('LAN classification URL preserves application scope even before shared helper is ready', () => {
  const h = setup({ location: { href: 'http://192.168.1.10:8080/?db=default' } });
  const url = h.appendCurrentDbToUrl(new URL('http://192.168.1.10:8080/api/kb/entity/class'));
  expect(url.origin).toBe('http://192.168.1.10:8080');
  expect(url.searchParams.get('db')).toBe('default');
});
test('classification errors preserve the server reason and explain non-admin maintenance access', async () => {
  const h = setup({});
  await expect(h.readEntityClassResponse(Response.json({error:'无权修改该知识'}, {status:403}))).rejects.toThrow('无权修改该知识');
  await expect(h.readEntityClassResponse(Response.json({error:'无权修改该知识'}, {status:403}))).rejects.toThrow('应用成员');
  await expect(h.readEntityClassResponse(Response.json({error:'请先登录'}, {status:401}))).rejects.toThrow('当前访问地址登录');
  expect(await h.readEntityClassResponse(Response.json({ok:true}))).toEqual({ok:true});
});
