import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync('public/assets/scripts/home-waterfall.js','utf8');
const layout = new Function(source.slice(source.indexOf('  function masonryPositions('), source.indexOf('  let current ='))+'; return masonryPositions;')();

test('masonry places each new card in the shortest column without changing previous positions', () => {
  const initial=layout([100,200,150],860);
  const appended=layout([100,200,150,80,90],860);
  expect(appended.positions.slice(0,3)).toEqual(initial.positions);
  expect(appended.positions[3].x).toBe(0);
  expect(appended.positions[3].y).toBe(116);
  for(let i=0;i<appended.positions.length;i++)for(let j=i+1;j<appended.positions.length;j++){
    const a=appended.positions[i],b=appended.positions[j];
    if(a.x===b.x)expect(b.y).toBeGreaterThanOrEqual(a.y+[100,200,150,80,90][i]!+16);
  }
});

test('narrow feeds fit one column and large screens cap at four columns', () => {
  const narrow=layout([100,200],220);
  expect(narrow.positions.map((p:any)=>p.x)).toEqual([0,0]);
  expect(narrow.width).toBe(220);
  expect(narrow.height).toBe(316);
  const wide=layout([10,10,10,10,10],1800);
  expect(wide.positions[4].x).toBe(0);
  expect(wide.positions[4].y).toBe(26);
});

test('settled bottom scroll loads another page without chaining on layout or media updates', () => {
  let frame: Function | undefined, timer: Function | undefined;
  const listeners: Record<string, Function> = {};
  const media: Record<string, Function> = {};
  const root = { getClientRects: () => [1], getBoundingClientRect: () => ({ bottom: 600 }),
    addEventListener: (name: string, fn: Function) => { listeners[name] = fn; },
    removeEventListener: (name: string) => { delete listeners[name]; } };
  const container = { clientWidth: 800, children: [], style: {}, classList: { add() {} },
    addEventListener(name: string, fn: Function) { media[name] = fn; }, removeEventListener() {}, insertAdjacentHTML() {} };
  const window: any = { kbViewMode: 'app_home', addEventListener() {}, removeEventListener() {} };
  new Function('window', 'requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver', 'setTimeout', 'clearTimeout', source)(
    window, (callback: Function) => { frame = callback; return 1; }, () => {}, undefined,
    (callback: Function) => { timer = callback; return 1; }, () => { timer = undefined; });
  let requests = 0, tailTop = 650;
  const flush = () => { const callback = timer; timer = undefined; callback?.(); };
  window.homeWaterfall.mount({ container, root, sentinel: { getBoundingClientRect: () => ({ top: tailTop }) }, onMore: () => requests++ });
  frame!();
  expect(requests).toBe(0);
  tailTop = 1500; listeners.scroll!(); flush();
  expect(requests).toBe(0);
  tailTop = 650;
  for (let i = 0; i < 10; i++) listeners.scroll!();
  expect(requests).toBe(0);
  flush(); expect(requests).toBe(1);
  for (let i = 0; i < 5; i++) {
    window.homeWaterfall.append(''); frame!();
    media.load!(); frame!(); window.homeWaterfall.update(); frame!(); flush();
  }
  expect(requests).toBe(1);
  // A later bottom scroll works even when the tail never left the preload area.
  listeners.scroll!(); flush(); expect(requests).toBe(2);
  window.kbViewMode = 'other'; listeners.scroll!(); flush(); expect(requests).toBe(2);
  window.kbViewMode = 'app_home'; listeners.scroll!();
  window.homeWaterfall.destroy(); flush(); expect(requests).toBe(2);
  expect(listeners.scroll).toBeUndefined();
});
