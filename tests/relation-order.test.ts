import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { createKnowledgeDatabase, ensureKnowledgeAccessSchema, knowledgeContext } from '../src/server/knowledge-access.ts';
import { orderedRelationItems, relationAttributeResponse, resolveRelationOrder, saveRelationOrder, normalizeIncomingOrder } from '../src/server/relation-order.ts';

function setup() {
  const db = new Database(':memory:');
  db.run('CREATE TABLE nodes(id TEXT PRIMARY KEY,name TEXT)');
  ensureKnowledgeAccessSchema(db);
  db.run("INSERT INTO nodes(id,name,owner_user_id) VALUES('one','One',1),('two','Two',2)");
  db.run('CREATE TABLE attributes(id TEXT PRIMARY KEY,node_id TEXT,key TEXT,value TEXT,statement_json TEXT)');
  db.run(`INSERT INTO attributes VALUES('a','one','P1','["a","b"]','{"qualifiers":[1]}'),('b','one','P1','"c"','{}'),('c','one','P2','"d"','{}'),('foreign','two','P1','"secret"','{}')`);
  const user = { id: 1, username: 'owner' };
  const move = (body: any, actor: any = user) => saveRelationOrder(db, actor, { id: 'entity/one', placement: 'before', ...body });
  const saved = () => JSON.parse((db.query("SELECT relation_order FROM nodes WHERE id='one'").get() as any).relation_order);
  return { db, move, saved };
}

test('property and value order persist independently in the entity without changing statements', async () => {
  const { db, move, saved } = setup();
  try {
    const before = db.query('SELECT * FROM attributes').all();
    expect(move({ kind: 'property', source: '2', target: '1' }).status).toBe(200);
    expect(move({ kind: 'value', source: 'a::1', target: 'a::0' }).status).toBe(200);
    expect(move({ kind: 'value', source: 'b::0', target: 'a::0' }).status).toBe(200);
    expect(saved().properties).toEqual(['2', '1']);
    expect(saved().values['1']).toEqual(['a::1', 'b::0', 'a::0']);
    const items = orderedRelationItems(db.query("SELECT * FROM attributes WHERE node_id='one'").all(), saved());
    expect(items.map((item) => item.id)).toEqual(['c', 'a', 'b']);
    expect(items.find((item) => item.id === 'a')!.value_order).toEqual([2, 0]);
    const response = relationAttributeResponse(db.query("SELECT * FROM attributes WHERE node_id='one'").all(), saved());
    expect(response.row_order).toEqual(['c::0', 'a::1', 'b::0', 'a::0']);
    expect(response.items.find((item) => item.id === 'a')!.value).toBe('["a","b"]');
    expect(db.query('SELECT * FROM attributes').all()).toEqual(before);
    expect((db.query("SELECT relation_order FROM nodes WHERE id='two'").get() as any).relation_order).toBe('{}');
    ensureKnowledgeAccessSchema(db);
    expect(saved().properties).toEqual(['2', '1']);
  } finally { db.close(); }
});

test('sorting rejects unauthorized, foreign, cross-property and stale values atomically', () => {
  const { db, move, saved } = setup();
  try {
    const operation = { kind: 'property', source: '2', target: '1' };
    expect(move(operation, null).status).toBe(401);
    expect(move(operation, { id: 2, username: 'reader' }).status).toBe(403);
    expect(move(operation, { id: 3, username: 'admin', role: 'admin' }).status).toBe(403);
    for (const target of ['foreign::0', 'c::0', 'a::99']) {
      expect(move({ kind: 'value', source: 'a::0', target }).status).toBe(409);
      expect(saved()).toEqual({});
    }
    expect(move({ ...operation, placement: 'invalid' }).status).toBe(400);
    db.run("INSERT INTO knowledge_maintainers(node_id,user_id,approved_by) VALUES('one',2,1)");
    expect(move(operation, { id: 2, username: 'maintainer' }).status).toBe(200);
    db.run("DELETE FROM knowledge_maintainers WHERE node_id='one'");
    expect(move(operation, { id: 2, username: 'maintainer' }).status).toBe(403);
  } finally { db.close(); }
});

test('new values append and deleted attributes do not invalidate saved order', () => {
  const order = resolveRelationOrder([{ id: 'a', key: 'P1', value: ['a'] }, { id: 'b', key: 'P2', value: 'b' }], {});
  order.properties.reverse();
  const next = resolveRelationOrder([{ id: 'a', key: 'P1', value: ['a', 'new'] }, { id: 'c', key: 'P3', value: 'c' }], JSON.stringify(order));
  expect(next.properties).toEqual(['1', '3']);
  expect(next.values['1']).toEqual(['a::0', 'a::1']);
});

test('deleting an array value retains the custom order of surviving values', () => {
  const order = resolveRelationOrder([{ id: 'a', key: 'P1', value: ['a', 'b', 'c'] }], {});
  order.values['1'] = ['a::2', 'a::0', 'a::1'];
  const next = resolveRelationOrder([{ id: 'a', key: 'P1', value: ['b', 'c'] }], order);
  expect(next.values['1']).toEqual(['a::1', 'a::0']);
});

test('detail relation order saves groups and per-group entries without touching attribute order', async () => {
  const { db, move, saved } = setup();
  const user = { id: 1, username: 'owner' };
  try {
    expect(move({ kind: 'property', source: '2', target: '1' }).status).toBe(200);
    const response = saveRelationOrder(db, user, {
      id: 'one',
      kind: 'incoming',
      incoming: {
        groups: ['role', 'person'],
        items: { person: ['b', 'a'], role: ['c'] },
        children: { b: ['d', 'e'] },
      },
    });
    expect(response.status).toBe(200);
    const order = saved();
    // 属性顺序保持不变，只新增管理详情页关联信息的 incoming 段
    expect(order.properties).toEqual(['2', '1']);
    expect(order.incoming).toEqual({
      groups: ['role', 'person'],
      items: { person: ['b', 'a'], role: ['c'] },
      children: { b: ['d', 'e'] },
    });
    // 只更新二级关联顺序时其它段继续保留
    expect(saveRelationOrder(db, user, {
      id: 'one',
      kind: 'incoming',
      incoming: { groups: ['role', 'person'], items: { person: ['b', 'a'], role: ['c'] }, children: { b: ['e', 'd'] } },
    }).status).toBe(200);
    expect(saved().incoming.children).toEqual({ b: ['e', 'd'] });
    expect(saved().properties).toEqual(['2', '1']);
  } finally { db.close(); }
});

test('detail relation order rejects unauthorized, missing and malformed payloads', () => {
  const { db, move, saved } = setup();
  const payload = { id: 'entity/one', kind: 'incoming', incoming: { groups: ['person'], items: { person: ['b'] } } };
  try {
    expect(saveRelationOrder(db, null, payload).status).toBe(401);
    expect(saveRelationOrder(db, { id: 2, username: 'reader' }, payload).status).toBe(403);
    expect(saveRelationOrder(db, { id: 1, username: 'owner' }, { ...payload, id: 'entity/missing' }).status).toBe(403);
    const owner = { id: 1, username: 'owner' };
    for (const incoming of [null, {}, { groups: [] }, { groups: 'x', items: 1 }, { groups: [1, 2], items: { person: [null] } }]) {
      expect(saveRelationOrder(db, owner, { id: 'entity/one', kind: 'incoming', incoming }).status).toBe(400);
    }
    expect(saved()).toEqual({});
    // 只带 kind 不带整体顺序的请求（旧的单条移动协议）同样被拒
    expect(move({ kind: 'incoming', source: 'a', target: 'b' }).status).toBe(400);
    expect(saved()).toEqual({});
  } finally { db.close(); }
});

test('incoming order normalizes keys, drops duplicates and caps stored entries', () => {
  const order = normalizeIncomingOrder({
    groups: ['person', 'person', 42, '', 'x'.repeat(200), 'role'],
    items: { person: ['a', 'a', 'b', '', 7], role: ['c'], '': ['d'] },
    children: { b: ['d', 'd', 'e'], '': ['f'], c: [] },
  });
  expect(order.groups).toEqual(['person', 'role']);
  expect(order.items).toEqual({ person: ['a', 'b'], role: ['c'] });
  expect(order.children).toEqual({ b: ['d', 'e'] });
  const many = normalizeIncomingOrder({ groups: Array.from({ length: 400 }, (_, index) => `g${index}`) });
  expect(many.groups).toHaveLength(200);
  expect(many.children).toEqual({});
});

test('sorting works through the request-scoped database used by the server', () => {
  const { db, saved } = setup();
  const user = { id: 1, username: 'owner' };
  try {
    knowledgeContext.run({ user }, () => {
      const scoped = createKnowledgeDatabase(db);
      const response = saveRelationOrder(scoped, user, { id: 'one', kind: 'property', source: '2', target: '1', placement: 'after' });
      expect(response.status).toBe(200);
      expect(saved().properties).toEqual(['1', '2']);
    });
  } finally { db.close(); }
});
