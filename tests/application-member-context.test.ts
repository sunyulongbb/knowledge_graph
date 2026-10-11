import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync('src/server/auth-context.ts','utf8');
const segment = source.slice(source.indexOf('export function getKnowledgeUser'),source.indexOf('export function isAdmin')).replace('export ','');
const js = new Bun.Transpiler({loader:'ts'}).transformSync(segment);
test('request identity reloads membership each time, independent of LAN host and user role', () => {
  let memberships = [10];
  const db = { query: (sql: string) => ({ all: (id: number) => sql.includes('application_members') ? memberships.map(project_id=>({project_id})) : [{id:20}] }) };
  const getUser = new Function('adminDb','getCurrentUser',js+';return getKnowledgeUser;')(db,()=>({id:3,username:'member',role:'user'}));
  const req = new Request('http://192.168.1.10:8080/api/kb/entity/class?db=mine');
  expect(getUser(req)).toMatchObject({role:'user',memberProjectIds:[10],ownedProjectIds:[20]});
  memberships=[];
  expect(getUser(req).memberProjectIds).toEqual([]);
});
