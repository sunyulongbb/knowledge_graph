import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync('public/assets/scripts/shorts-page.js', 'utf8');
function setup(fetcher: Function) {
  const opened: any[] = [], routes: URL[] = [];
  let isPage = false, feed: any[] = [];
  const viewer = { open: (id: string, options: any) => { isPage = true; opened.push({ id, options }); },
    isPage: () => isPage, close: () => { isPage = false; }, updateFeed: (nodes: any[]) => { feed = nodes; } };
  const window: any = { kbViewMode: 'app_home', homeKnowledgeMediaViewer: viewer, history: { state: {}, replaceState: (_a: any, _b: any, url: URL) => routes.push(url) } };
  const mounts: string[] = [];
  const element = () => ({ append() {}, setAttribute() {}, replaceChildren() {}, classList: { add() {} }, textContent: '' });
  const document = { getElementById: (id: string) => ({ ...element(), append: () => mounts.push(id) }), createElement: element };
  new Function('window', 'document', 'location', 'fetch', source)(window, document,
    { origin: 'http://localhost', href: 'http://localhost/kb?db=demo#shorts', search: '?db=demo', hash: '#shorts' }, fetcher);
  window.kbViewMode = 'shorts';
  return { window, viewer, opened, routes, mounts, feed: () => feed };
}
test('home launch immediately opens the selected knowledge with the existing feed and writes a refreshable route', async () => {
  const h = setup(() => { throw Error('feed should be reused'); });
  expect(h.mounts).toContain('applicationHomePanel');
  expect(h.mounts).not.toContain('globalPage');
  h.window.kbShortsLaunch = { nodes: [{ id: 'one' }, { id: 'two' }], category: '分类' };
  await h.window.loadShortsPage('entity/two');
  expect(h.opened[0].id).toBe('two');
  expect(h.opened[0].options.nodes).toHaveLength(2);
  h.opened[0].options.page.onNodeChange('one');
  expect(h.routes[0]?.hash).toBe('#view=shorts&node=one');
  expect(h.routes[0]?.search).toBe('?db=demo');
  await h.window.loadShortsPage('one');
  expect(h.opened).toHaveLength(1);
});
test('direct shorts navigation loads a scoped feed and leaving prevents a late response from reopening it', async () => {
  let resolve: Function;
  let requested: URL;
  const h = setup((url: URL) => { requested = url; return new Promise(done => { resolve = done; }); });
  const loading = h.window.loadShortsPage();
  expect(requested!.searchParams.get('db')).toBe('demo');
  h.window.closeShortsPage(); h.window.kbViewMode = 'app_home';
  resolve!({ ok: true, json: async () => ({ nodes: [{ id: 'one' }] }) });
  await loading;
  expect(h.opened).toHaveLength(0);
});
test('refresh with a node opens that detail before waiting for the full feed', async () => {
  const h = setup(async () => ({ ok: true, json: async () => ({ nodes: [{ id: 'one' }, { id: 'two' }] }) }));
  await h.window.loadShortsPage('two');
  expect(h.opened[0].id).toBe('two');
  expect(h.feed()).toHaveLength(2);
  h.window.closeShortsPage();
  expect(h.viewer.isPage()).toBe(false);
});
