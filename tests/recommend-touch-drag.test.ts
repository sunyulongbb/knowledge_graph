import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function setup() {
  class Element {
    captured = false; scrollTop = 100; style = {}; offsetWidth = 100; classes = new Set();
    classList = { add: (s: string) => this.classes.add(s), remove: (s: string) => this.classes.delete(s), toggle: (s: string, yes: boolean) => yes ? this.classes.add(s) : this.classes.delete(s) };
    closest(selector: string): any { if (selector === '[data-recommend-drag]') return this; if (selector === '[data-recommend-node-id]') return card; return null; }
    setPointerCapture() { this.captured = true; } hasPointerCapture() { return this.captured; } releasePointerCapture() { this.captured = false; }
    getBoundingClientRect() { return { left: 100, right: 500, top: 0, bottom: 400 }; }
    contains(hit: any) { return hit === canvas; } remove() {}
  }
  const handle = new Element(), card = new Element(), canvas = new Element(), body = new Element();
  card.closest = selector => selector === '[data-recommend-node-id]' ? card : selector === '.vis-recommend-list' ? body : null;
  const payload = { kind: 'node', id: 'entity/a', label: 'A' };
  const calls: any[] = []; let hit: any = canvas; let timer: any;
  const context: any = { Element, document: { readyState: 'loading', addEventListener() {}, body, elementFromPoint: () => hit,
    getElementById: () => canvas, querySelector: () => body }, window: { innerWidth: 800 }, Date, clearTimeout:()=>{timer=null;}, setTimeout:(fn:any)=>{timer=fn;return 1;}, calls, payload };
  const source = readFileSync(new URL('../public/assets/scripts/vis-ontology-panel.js', import.meta.url), 'utf8').replaceAll('export function', 'function');
  runInNewContext(source + `
    resolveDragPayload = () => payload;
    buildDragChip = () => ({style:{},offsetWidth:100,remove(){}});
    closePopover = () => {};
    addRecommendedNodeToGraph = (payload, point) => calls.push({payload, point});
    globalThis.api = {down:onPanelPointerDown,move:onPointerMove,up:onPointerUp,clear:clearDragState,state:()=>pointerDrag,drop:isGraphDropPoint};
  `, context);
  let prevented = false;
  const event = (target: any, x = 20, pointerType = 'touch') => ({ target, button: 0, isPrimary: true, pointerId: 1, pointerType, clientX: x, clientY: 100, preventDefault() { prevented = true; } });
  return { ...context.api, handle, card, calls, body, event, prevented: () => prevented, hold:()=>timer?.(), overlay: () => hit = card };
}

test('touch whole-card drags immediately without long press or buttons', () => {
  const s=setup();s.down(s.event(s.card));expect(s.card.captured).toBe(true);expect(s.prevented()).toBe(true);
  s.move(s.event(s.card,200));expect(s.state().started).toBe(true);
  s.up(s.event(s.card,200));expect(s.calls).toHaveLength(1);expect(s.card.captured).toBe(false);
});
test('quick touch swipe scrolls the list without adding a node', () => {
  const s=setup();s.down(s.event(s.card));s.move({...s.event(s.card),clientY:50});s.hold();
  expect(s.body.scrollTop).toBe(150);expect(s.state().started).toBe(false);s.up(s.event(s.card,200));expect(s.calls).toHaveLength(0);
});
test('mouse direct drag translates the drop to graph coordinates', () => {
  const s=setup();s.down(s.event(s.card,20,'mouse'));s.hold();s.move(s.event(s.card,200,'mouse'));s.up(s.event(s.card,200,'mouse'));
  expect(s.calls[0].point).toEqual({x:100,y:100});
});
test('tap, drop outside, covered canvas and cancellation do not add knowledge', () => {
  for (const reason of ['tap', 'outside', 'overlay', 'cancel']) {
    const s = setup(); s.down(s.event(s.handle));
    if (reason !== 'tap') {s.hold();s.move(s.event(s.handle, 200));}
    if (reason === 'overlay') s.overlay();
    if (reason === 'cancel') s.clear(); else s.up(s.event(s.handle, reason === 'outside' || reason === 'tap' ? 20 : 200));
    expect(s.calls).toHaveLength(0); expect(s.card.captured).toBe(false); expect(s.card.classes.has('is-dragging')).toBe(false);
  }
});

test('selected recommendation can be dragged vertically without scrolling the list', () => {
  const s=setup();s.down(s.event(s.card));s.up(s.event(s.card));
  s.down(s.event(s.card));s.move({...s.event(s.card),clientY:140});
  expect(s.state().started).toBe(true);expect(s.body.scrollTop).toBe(100);
  s.up(s.event(s.card,200));expect(s.calls).toHaveLength(1);
});
