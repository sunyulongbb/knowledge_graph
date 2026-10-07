import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../public/assets/scripts/home-media-viewer.js', import.meta.url), 'utf8');
function setup(play?: (video: any) => Promise<void>, videosOnly = false) {
  let refs: Record<string, any> = {};
  const elements: any[] = [];
  class Element {
    tag: string; children: any[] = []; handlers: Record<string, Function[]> = {}; dataset: any = {}; style: any = {}; open = false; textContent = ''; value = ''; hidden = false; paused = true; duration = 60; currentTime = 0; isConnected = true;
    classList = { toggle() {} };
    constructor(tag: string) { this.tag = tag; }
    set innerHTML(value: string) { for (const match of value.matchAll(/data-ref="([^"]+)"/g)) { const el = new Element(match[1] === 'seek' ? 'input' : 'div'); el.dataset.ref = match[1]; refs[match[1]] = el; } }
    append(...items: any[]) { this.children.push(...items); items.forEach((item) => item.parentNode = this); }
    replaceChildren() { this.children = []; }
    querySelectorAll(selector: string) { if (selector === '[data-ref]') return Object.values(refs); if (selector === 'button') return []; return this.children.filter((el) => el.tag === selector); }
    querySelector(selector: string) { return this.querySelectorAll(selector)[0] || null; }
    addEventListener(name: string, fn: Function) { (this.handlers[name] ||= []).push(fn); }
    setAttribute() {} removeAttribute() {} load() {} pause() { this.paused = true; } play() { if (play) return play(this); this.paused = false; return Promise.resolve(); }
    showModal() { this.open = true; } close() { this.open = false; this.handlers.close?.forEach((fn) => fn()); } focus() {}
  }
  const window: any = { addEventListener() {} };
  const body = new Element('body'); body.style.overflow = 'auto';
  const requests: string[] = [];
  const first = { id: 'one', name: '一', images: ['/a.jpg', '/b.jpg'], videos: ['/c.mp4'] };
  const second = { id: 'two', name: '二', images: ['/d.jpg'], videos: ['/e.mp4'] };
  if (videosOnly) { first.images = []; second.images = []; }
  const document = { body, activeElement: new Element('button'), createElement: (tag: string) => { const el = new Element(tag); elements.push(el); return el; } };
  new Function('window', 'document', 'location', 'fetch', 'navigator', source)(window, document, { origin: 'https://example.test', search: '?db=mine' }, async (url: URL) => {
    requests.push(url.toString());
    return { ok: true, json: async () => url.pathname.endsWith('/random') ? { node: second } : url.pathname === '/api/kb/node' ? { node: url.searchParams.get('id') === 'two' ? second : first } : { comments: [], likeCount: 2 } };
  }, {});
  return { viewer: window.homeKnowledgeMediaViewer, get refs() { return refs; }, body, elements, requests };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('portrait reuses media navigation and receives loaded knowledge on each page', async () => {
  const h = setup(), seen: string[] = [];
  let closed = 0;
  h.viewer.open('one', { nodes: [{ id: 'one' }, { id: 'two' }], portrait: {
    onNodeChange: (node: any) => seen.push(node.id), onClose: () => closed++,
  } });
  await tick();
  expect(seen).toEqual(['one']);
  h.refs.right.onclick(); expect(h.refs.counter.textContent).toBe('2 / 3');
  await h.refs.down.onclick(); expect(seen).toEqual(['one', 'two']);
  await h.refs.up.onclick(); expect(seen).toEqual(['one', 'two', 'one']);
  h.viewer.close(); expect(closed).toBe(1);
  h.viewer.open('two'); await tick(); expect(seen).toHaveLength(3);
});

test('journey follows route in both directions, reports loaded stations and finishes at the boundary', async () => {
  const h = setup(), seen: string[] = [];
  let finished = 0, closed = 0;
  h.viewer.open('one', { nodes: [{ id: 'one' }, { id: 'two' }], journey: {
    onNodeChange: (id: string) => seen.push(id), onFinish: () => finished++, onClose: () => closed++,
  } });
  await tick();
  expect(seen).toEqual(['one']);
  await h.refs.up.onclick(); expect(seen).toEqual(['one']);
  await h.refs.down.onclick(); expect(seen).toEqual(['one', 'two']);
  await h.refs.down.onclick(); expect(finished).toBe(1);
  await h.refs.up.onclick(); expect(seen).toEqual(['one', 'two', 'one']);
  await h.viewer.goTo('outside'); expect(seen).toHaveLength(3);
  await h.viewer.goTo('two'); expect(seen).toEqual(['one', 'two', 'one', 'two']);
  h.viewer.close(); expect(closed).toBe(1);
  h.viewer.open('one', { nodes: [{ id: 'one' }, { id: 'two' }] }); await tick();
  await h.refs.down.onclick();
  expect(seen).toHaveLength(4); expect(finished).toBe(1);
});

test('collects mixed image/video lists safely and deduplicates media', () => {
  const h = setup();
  expect(h.viewer.collectMedia({ images: '["/a.jpg","javascript:bad"]', image: '/a.jpg', videos: [{ url: '/b.mp4' }] })).toEqual([{ kind: 'image', url: '/a.jpg' }, { kind: 'video', url: '/b.mp4' }]);
  expect(h.viewer.textPages('甲乙丙丁', 2)).toEqual(['甲乙', '丙丁']);
});

test('left/right cycle media; old video pauses; close restores page scroll', async () => {
  const h = setup(); h.viewer.open('one'); await tick();
  expect(h.body.style.overflow).toBe('hidden');
  expect(h.refs.counter.textContent).toBe('1 / 3');
  h.refs.right.onclick(); expect(h.refs.counter.textContent).toBe('2 / 3');
  h.refs.right.onclick(); const video = h.refs.stage.querySelector('video'); expect(video.paused).toBe(false);
  h.refs.left.onclick(); expect(video.paused).toBe(true);
  h.viewer.close(); expect(h.body.style.overflow).toBe('auto');
});

test('vertical paging stays inside home category and never calls global random endpoint', async () => {
  const h = setup(); h.viewer.open('one', { nodes: [{ id: 'one' }, { id: 'two' }], category: '分类甲' }); await tick();
  await h.refs.down.onclick(); await tick();
  expect(h.refs.title.textContent).toBe('二');
  expect(h.refs.identity.textContent).toBe('分类甲');
  expect(h.requests.some((url) => url.includes('/random'))).toBe(false);
  expect(h.requests.some((url) => url.includes('id=two'))).toBe(true);
  await h.refs.up.onclick(); await tick();
  expect(h.refs.title.textContent).toBe('一');
});

test('single-item category never falls back to other application knowledge', async () => {
  const h = setup(); h.viewer.open('one', { nodes: [{ id: 'one' }] }); await tick();
  const before = h.requests.length;
  await h.refs.down.onclick();
  expect(h.requests.length).toBe(before);
  expect(h.refs.status.textContent).toBe('当前分类暂无其他知识');
});

test('slide uses opposite transforms, moves decoded media and removes outgoing page', async () => {
  const h = setup(); h.viewer.open('one', { nodes: [{ id: 'one' }, { id: 'two' }] }); await tick();
  const frames: any[] = []; const finished: Function[] = [];
  const animate = (keys: any, options: any) => {
    frames.push({ keys, options });
    return { finished: new Promise((resolve) => finished.push(resolve)), cancel() {} };
  };
  const oldMedia = [...h.refs.stage.children];
  h.refs.stage.childNodes = oldMedia;
  let moved: any[] = [], removed = false;
  const departing = { classList: { add() {} }, setAttribute() {},
    querySelector: () => ({ replaceChildren: (...items: any[]) => { moved = items; h.refs.stage.children = []; } }),
    querySelectorAll: () => [], animate, remove() { removed = true; } };
  h.refs.main.cloneNode = () => departing;
  h.refs.main.animate = animate;
  const page = h.refs.down.onclick(); await tick();
  expect(moved).toEqual(oldMedia);
  expect(frames[0].keys[1].transform).toBe('translate3d(0,-100%,0)');
  expect(frames[1].keys[0].transform).toBe('translate3d(0,100%,0)');
  expect(frames[0].options.duration).toBe(300);
  const requests = h.requests.length;
  await h.refs.down.onclick(); expect(h.requests.length).toBe(requests);
  finished.forEach((resolve) => resolve()); await page;
  expect(removed).toBe(true);
});

test('up traverses history without random fallback and opening a new card resets history', async () => {
  const h = setup(); const options = { nodes: [{ id: 'one' }, { id: 'two' }] };
  h.viewer.open('one', options); await tick();
  const initialRequests = h.requests.length;
  await h.refs.up.onclick();
  expect(h.requests.length).toBe(initialRequests);
  expect(h.refs.status.textContent).toBe('已经是本次浏览的第一条知识');
  await h.refs.down.onclick(); // one -> two
  await h.refs.down.onclick(); // two -> one
  await h.refs.up.onclick(); expect(h.refs.title.textContent).toBe('二');
  await h.refs.up.onclick(); expect(h.refs.title.textContent).toBe('一');
  const requests = h.requests.length;
  await h.refs.up.onclick(); expect(h.requests.length).toBe(requests);
  await h.refs.down.onclick();
  h.viewer.close(); h.viewer.open('two', options); await tick();
  const reopened = h.requests.length;
  await h.refs.up.onclick(); expect(h.requests.length).toBe(reopened);
});

test('detail videos autoplay with sound by default and reopening restores sound default', async () => {
  const h = setup(); h.viewer.open('one'); await tick();
  h.refs.right.onclick(); h.refs.right.onclick();
  const video = h.refs.stage.querySelector('video');
  expect(video.autoplay).toBe(true); expect(video.muted).toBe(false); expect(video.paused).toBe(false);
  h.refs.mute.onclick(); expect(video.muted).toBe(true);
  h.viewer.close(); h.viewer.open('one'); await tick();
  h.refs.right.onclick(); h.refs.right.onclick();
  expect(h.refs.stage.querySelector('video').muted).toBe(false);
});

for (const name of ['AbortError', 'NotAllowedError', 'NotSupportedError']) {
  test(`play rejection distinguishes ${name}`, async () => {
    const h = setup(() => Promise.reject(Object.assign(new Error(name), { name })));
    h.viewer.open('one'); await tick();
    h.refs.right.onclick(); h.refs.right.onclick(); await tick();
    const status = h.refs.status.textContent;
    if (name === 'AbortError') expect(status).toBe('');
    if (name === 'NotAllowedError') expect(status).toContain('浏览器暂未允许');
    if (name === 'NotSupportedError') expect(status).toContain('格式或编码');
  });
}

test('late rejection from outgoing video cannot overwrite the new page status', async () => {
  let rejectPlay: (error: any) => void = () => {};
  const h = setup(() => new Promise((_, reject) => { rejectPlay = reject; }));
  h.viewer.open('one', { nodes: [{ id: 'one' }, { id: 'two' }] }); await tick();
  h.refs.right.onclick(); h.refs.right.onclick();
  await h.refs.down.onclick();
  rejectPlay(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
  await tick();
  expect(h.refs.title.textContent).toBe('二');
  expect(h.refs.status.textContent).toBe('');
});


test('vertical paging automatically falls back to muted playback and retries sound on the next page', async () => {
  const attempts: boolean[] = [];
  let allowSound = false;
  const h = setup(async (video) => {
    attempts.push(video.muted);
    if (!video.muted && !allowSound) throw Object.assign(new Error('blocked'), { name: 'NotAllowedError' });
    video.paused = false;
  }, true);
  h.viewer.open('one', { nodes: [{ id: 'one' }, { id: 'two' }] }); await tick();
  expect(attempts).toEqual([false, true]);
  expect(h.refs.stage.querySelector('video').paused).toBe(false);
  expect(h.refs.centerPlay.hidden).toBe(true);
  expect(h.refs.status.textContent).toBe('');
  await h.refs.down.onclick(); await tick();
  expect(attempts).toEqual([false, true, false, true]);
  expect(h.refs.title.textContent).toBe('二');
  expect(h.refs.stage.querySelector('video').paused).toBe(false);
  allowSound = true;
  h.refs.mute.onclick(); await tick();
  expect(h.refs.stage.querySelector('video').muted).toBe(false);
  await h.refs.up.onclick(); await tick();
  expect(h.refs.stage.querySelector('video').paused).toBe(false);
  expect(h.refs.stage.querySelector('video').muted).toBe(false);
});

test('explicit mute persists across vertical paging without attempting sound', async () => {
  const h = setup(undefined, true);
  h.viewer.open('one', { nodes: [{ id: 'one' }, { id: 'two' }] }); await tick();
  h.refs.mute.onclick();
  await h.refs.down.onclick(); await tick();
  expect(h.refs.stage.querySelector('video').muted).toBe(true);
  expect(h.refs.stage.querySelector('video').paused).toBe(false);
});
