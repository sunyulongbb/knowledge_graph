import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { categoryChain, createJevClassificationHandler } from '../src/server/jev-classification.ts';

function setup() {
  const db = new Database(':memory:');
  db.run('CREATE TABLE nodes(id TEXT PRIMARY KEY,name TEXT,description TEXT,owner_user_id INTEGER,project_id INTEGER,visibility TEXT)');
  db.run('CREATE TABLE classes(id TEXT PRIMARY KEY,name TEXT,description TEXT,parent_id TEXT,project_id INTEGER)');
  db.run('CREATE TABLE attributes(node_id TEXT,key TEXT,value TEXT)');
  db.run('CREATE TABLE knowledge_maintainers(node_id TEXT,user_id INTEGER)');
  db.run('CREATE TABLE entity_classes(entity_id TEXT,class_id TEXT,PRIMARY KEY(entity_id,class_id))');
  db.run("INSERT INTO nodes VALUES('n','某大学教授','从事物理教学和研究',1,10,'public')");
  db.run("INSERT INTO classes VALUES('a','人物','人物',NULL,10),('b','教师','从事教学','a',10),('c','已有分类','',NULL,10),('foreign','其他应用分类','',NULL,20)");
  db.run("INSERT INTO attributes VALUES('n','职业','大学教授')");
  db.run("INSERT INTO entity_classes VALUES('n','c')");
  let user: any = { id: 1, username: 'owner' };
  let key = 'test-key';
  let calls = 0;
  let requestBody: any;
  let answer: any = { choice: 'category_1', confidence: 0.9 };
  let beforeResponse: () => void | Promise<void> = () => {};
  const handler = createJevClassificationHandler({
    db, getUser: () => user, getApiKey: () => key,
    getProject: (slug) => slug === 'mine' ? { id: 10 } : { id: 20 },
    request: (async (_url: unknown, init: RequestInit) => {
      calls++; requestBody = JSON.parse(String(init.body)); await beforeResponse();
      return Response.json({ data: { answers: { category: answer } } });
    }) as typeof fetch,
  });
  return {
    db, setUser: (value: any) => { user = value; }, setKey: (value: string) => { key = value; },
    setAnswer: (value: any) => { answer = value; }, beforeResponse: (fn: () => void | Promise<void>) => { beforeResponse = fn; },
    calls: () => calls, requestBody: () => requestBody,
    assigned: () => db.query('SELECT class_id FROM entity_classes ORDER BY class_id').all(),
    call: (scope = 'mine', stream = false) => { const url = new URL(`http://localhost/api/jev/classify?db=${scope}`); return handler(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(stream ? { Accept: 'application/x-ndjson' } : {}) }, body: JSON.stringify({ id: 'entity/n' }) }), url); },
  };
}

test('JEV sees entity evidence and current tree only; classification adds ancestors and retains existing assignments', async () => {
  const h = setup();
  try {
    const response = await h.call();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'classified', added: 2 });
    expect(h.assigned()).toEqual([{ class_id: 'a' }, { class_id: 'b' }, { class_id: 'c' }]);
    expect(h.requestBody().state.attributes).toEqual([{ key: '职业', value: '大学教授' }]);
    expect(h.requestBody().questions.category.criteria.category_1).toContain('人物 / 教师');
    expect(JSON.stringify(h.requestBody())).not.toContain('其他应用分类');
    expect(await (await h.call()).json()).toMatchObject({ added: 0 });
  } finally { h.db.close(); }
});

test('insufficient evidence, low confidence and invalid choices never write classifications', async () => {
  const h = setup();
  try {
    for (const answer of [{ choice: 'insufficient' }, { choice: 'category_1', confidence: 0.2 }]) {
      h.setAnswer(answer);
      expect(await (await h.call()).json()).toMatchObject({ status: 'skipped' });
    }
    for (const answer of [null, { choice: 'foreign' }, { choice: 'category_99' }]) {
      h.setAnswer(answer); expect((await h.call()).status).toBe(502);
    }
    expect(h.assigned()).toEqual([{ class_id: 'c' }]);
  } finally { h.db.close(); }
});

test('login, edit permissions, application scope and API key are checked before external requests', async () => {
  const h = setup();
  try {
    h.setUser(null); expect((await h.call()).status).toBe(401);
    h.setUser({ id: 2, username: 'other' }); expect((await h.call()).status).toBe(403);
    h.setUser({ id: 1, username: 'owner' }); expect((await h.call('other')).status).toBe(400);
    h.setKey(''); expect((await h.call()).status).toBe(503);
    expect(h.calls()).toBe(0);
    expect(h.assigned()).toEqual([{ class_id: 'c' }]);
  } finally { h.db.close(); }
});

test('changed category trees or revoked edit access cannot be saved after a slow JEV response', async () => {
  for (const revoke of [false, true]) {
    const h = setup();
    try {
      h.beforeResponse(() => {
        if (revoke) h.setUser({ id: 2, username: 'other' });
        else h.db.run("UPDATE classes SET parent_id=NULL WHERE id='b'");
      });
      expect((await h.call()).status).toBe(revoke ? 403 : 409);
      expect(h.assigned()).toEqual([{ class_id: 'c' }]);
    } finally { h.db.close(); }
  }
});

test('cyclic category data does not loop indefinitely', () => {
  expect(categoryChain([{ id: 'a', name: 'A', parent_id: 'b' }, { id: 'b', name: 'B', parent_id: 'a' }], 'a').map((item) => item.id)).toEqual(['b', 'a']);
});

test('changed attribute evidence prevents stale classification writes', async () => {
  const h = setup();
  try {
    h.beforeResponse(() => h.db.run("UPDATE attributes SET value='工程师' WHERE node_id='n'"));
    expect((await h.call()).status).toBe(409);
    expect(h.assigned()).toEqual([{ class_id: 'c' }]);
  } finally { h.db.close(); }
});

test('stream reports real stages before JEV finishes and ends with saved results', async () => {
  const h = setup();
  let release!: () => void;
  h.beforeResponse(() => new Promise<void>((resolve) => { release = resolve; }));
  try {
    const response = await h.call('mine', true);
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    while (!text.includes('analyzing')) text += decoder.decode((await reader.read()).value);
    expect(text).not.toContain('"type":"result"');
    expect(h.assigned()).toEqual([{ class_id: 'c' }]);
    release();
    while (true) { const chunk = await reader.read(); if (chunk.done) break; text += decoder.decode(chunk.value); }
    const events = text.trim().split('\n').map((line) => JSON.parse(line));
    expect(events.filter((event) => event.type === 'progress').map((event) => event.stage)).toEqual(['reading', 'prepared', 'analyzing', 'validating', 'saving']);
    expect(events.at(-1)).toMatchObject({ type: 'result', httpStatus: 200, data: { status: 'classified', added: 2 } });
  } finally { release?.(); h.db.close(); }
});

test('stream preserves authorization error status without starting JEV', async () => {
  const h = setup();
  try {
    h.setUser(null);
    const events = (await (await h.call('mine', true)).text()).trim().split('\n').map((line) => JSON.parse(line));
    expect(events.at(-1)).toMatchObject({ type: 'result', httpStatus: 401 });
    expect(h.calls()).toBe(0);
  } finally { h.db.close(); }
});
