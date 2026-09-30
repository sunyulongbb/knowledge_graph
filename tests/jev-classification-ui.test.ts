import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../public/assets/scripts/table-selection.js', import.meta.url), 'utf8');
function setup(responses: any[]) {
  const elements = new Map<string, any>();
  const element = () => ({ open: false, textContent: '', title: '', hidden: false, disabled: false, dataset: {}, children: [] as any[], handlers: {} as Record<string, Function>,
    appendChild(child: any) { this.children.push(child); }, replaceChildren() { this.children = []; },
    addEventListener(name: string, fn: Function) { this.handlers[name] = fn; }, showModal() { this.open = true; }, close() { this.open = false; },
  });
  const byId = (id: string) => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  let scope = 'mine';
  const calls: string[] = [];
  let beforeResponse = () => {};
  let refreshes = 0;
  const window = { authUser: {}, kbSelectedRowIds: new Set(['a', 'b']), kbTableNodes: [{ id: 'a', name: '<script>不执行</script>' }, { id: 'b', name: '乙' }], canOperateKnowledgeSelection: () => true, loadTablePage: async () => { refreshes++; } };
  const start = source.indexOf("  const btnJevClassify =");
  const end = source.indexOf('  const tblNodes =', start);
  new Function('byId', 'window', 'document', 'location', 'appendCurrentDbToUrl', 'ensureTableSelectedButtonsState', 'fetch', source.slice(start, end))(
    byId, window, { createElement: element }, { origin: 'http://localhost' },
    (url: URL) => { url.searchParams.set('db', scope); return url; }, () => {},
    async (_url: URL, init: any) => {
      calls.push(JSON.parse(init.body).id); beforeResponse();
      const value = responses.shift() || { status: 'skipped', reason: '信息不足' };
      if (value instanceof Response) return value;
      return { ok: !value.error, status: value.httpStatus || 200, json: async () => value };
    },
  );
  return { byId, calls, window, refreshes: () => refreshes, start: () => byId('btnJevClassify').handlers.click(), retry: () => byId('btnJevClassifyRetry').handlers.click(), beforeResponse: (fn: () => void) => { beforeResponse = fn; }, setScope: (value: string) => { scope = value; } };
}

test('batch results show paths and safe entity text; retry only sends failed items', async () => {
  const h = setup([{ status: 'classified', categories: [{ name: '人物' }, { name: '教师' }], added: 2 }, { error: '服务不可用', httpStatus: 502 }, { status: 'classified', categories: [{ name: '科学家' }], added: 1 }]);
  await h.start();
  const rows = h.byId('jevClassifyResultBody').children;
  expect(rows[0].children[0].textContent).toBe('<script>不执行</script>');
  expect(rows[0].children[2].textContent).toContain('人物 / 教师');
  expect(rows[1].children[2].textContent).toBe('服务不可用');
  await h.retry();
  expect(h.calls).toEqual(['a', 'b', 'b']);
  expect(h.byId('jevClassifyStatus').textContent).toContain('已分类 2');
});

test('stop finishes current entity and leaves later entities available for retry', async () => {
  const h = setup([]);
  h.beforeResponse(() => h.byId('btnJevClassifyCancel').handlers.click());
  await h.start();
  expect(h.calls).toEqual(['a']);
  expect(h.byId('jevClassifyStatus').textContent).toContain('未处理 1');
  expect(h.byId('btnJevClassifyRetry').disabled).toBe(false);
});

test('switching applications prevents subsequent requests, stale refreshes and retries', async () => {
  const h = setup([{ status: 'classified', categories: [{ name: '人物' }], added: 1 }]);
  h.beforeResponse(() => h.setScope('other'));
  await h.start(); await h.retry();
  expect(h.calls).toEqual(['a']);
  expect(h.refreshes()).toBe(0);
  expect(h.byId('btnJevClassifyRetry').disabled).toBe(true);
});

test('one forbidden entity does not stop other entities in the batch', async () => {
  const h = setup([{ error: '无权分类', httpStatus: 403 }, { status: 'skipped', reason: '信息不足' }]);
  await h.start();
  expect(h.calls).toEqual(['a', 'b']);
  expect(h.byId('jevClassifyStatus').textContent).toContain('跳过 1 · 失败 1');
});

test('unchanged classify-button state does not repeatedly mutate disabled attributes', () => {
  const start = source.indexOf('  function ensureTableSelectedButtonsState()');
  const end = source.indexOf('  function appendCurrentDbToUrl(', start);
  let writes = 0, disabled = true;
  const button = { get disabled() { return disabled; }, set disabled(value: boolean) { writes++; disabled = value; } };
  const sync = new Function('btnJevClassify', 'btnDeleteSelected', 'window', 'classifying', 'classificationSelection', source.slice(start, end) + ';return ensureTableSelectedButtonsState;')(
    button, null, { kbSelectedRowIds: new Set(), authUser: null }, false, () => [],
  );
  sync(); sync(); sync();
  expect(writes).toBe(1);
});

test('click opens process window and renders streamed stages before final result, including split UTF-8 chunks', async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const response = new Response(new ReadableStream<Uint8Array>({ start(value) { controller = value; } }), { headers: { 'Content-Type': 'application/x-ndjson' } });
  const h = setup([response]);
  const task = h.start();
  expect(h.byId('jevClassifyResults').open).toBe(true);
  const encoder = new TextEncoder();
  const line = encoder.encode(JSON.stringify({ type: 'progress', stage: 'analyzing', message: 'JEV 正在匹配分类' }) + '\n');
  controller.enqueue(line.slice(0, line.length - 4));
  controller.enqueue(line.slice(line.length - 4));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(h.byId('jevClassifyResultBody').children[0].children[2].textContent).toContain('JEV 正在匹配分类');
  expect(h.byId('jevClassifyProgress').value).toBe(0);
  expect(h.byId('jevClassifyLiveStatus').textContent).toContain('正在处理');
  controller.enqueue(encoder.encode(JSON.stringify({ type: 'result', httpStatus: 200, data: { status: 'classified', added: 1, categories: [{ name: '人物' }] } }) + '\n'));
  controller.close();
  await task;
  expect(h.byId('jevClassifyProgress').value).toBe(2);
  expect(h.byId('jevClassifyResultBody').children[0].children[2].textContent).toContain('人物（已保存）');
});

test('truncated progress stream is shown as a failure and can be retried', async () => {
  const response = new Response('{"type":"progress","message":"正在分析"}\n', { headers: { 'Content-Type': 'application/x-ndjson' } });
  const h = setup([response]);
  await h.start();
  expect(h.byId('jevClassifyResultBody').children[0].dataset.status).toBe('failed');
  expect(h.byId('btnJevClassifyRetry').disabled).toBe(false);
});

test('click with no selection opens guidance instead of silently doing nothing', async () => {
  const h = setup([]);
  h.window.kbSelectedRowIds.clear();
  await h.start();
  expect(h.byId('jevClassifyResults').open).toBe(true);
  expect(h.byId('jevClassifyResultSummary').textContent).toContain('请先在知识表格中勾选');
  expect(h.calls).toEqual([]);
});

test('logged-out clicks explain login and API key requirements without sending requests', async () => {
  const h = setup([]);
  h.window.authUser = null as any;
  await h.start();
  expect(h.byId('jevClassifyResults').open).toBe(true);
  expect(h.byId('jevClassifyResultSummary').textContent).toContain('请先登录');
  expect(h.calls).toEqual([]);
});

test('missing frontend permission data still allows the server to return an explicit decision', async () => {
  const h = setup([{ error: '知识不存在或无权分类', httpStatus: 403 }]);
  h.window.canOperateKnowledgeSelection = undefined as any;
  await h.start();
  expect(h.byId('jevClassifyResults').open).toBe(true);
  expect(h.calls).toEqual(['a', 'b']);
  expect(h.byId('jevClassifyResultBody').children[0].children[2].textContent).toContain('无权分类');
});

test('click during classification reopens progress without submitting another batch', async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const response = new Response(new ReadableStream<Uint8Array>({ start(value) { controller = value; } }), { headers: { 'Content-Type': 'application/x-ndjson' } });
  const h = setup([response]);
  const task = h.start();
  h.byId('jevClassifyResults').close();
  await h.start();
  expect(h.byId('jevClassifyResults').open).toBe(true);
  expect(h.calls).toEqual(['a']);
  controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'result', httpStatus: 200, data: { status: 'skipped' } }) + '\n'));
  controller.close();
  await task;
  expect(h.calls).toEqual(['a', 'b']);
});
