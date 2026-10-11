import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function setup(pointerType = 'mouse') {
  class Element {
    style = {}; hidden = false; textContent = ''; listeners = new Map<string, any>(); children: any[] = [];
    classList = { toggle() {} }; captured = false;
    setAttribute() {} append(...items: any[]) { this.children.push(...items); }
    addEventListener(name: string, fn: any) { this.listeners.set(name, fn); }
    removeEventListener() {} remove() {} getBoundingClientRect() { return { left: 10, top: 20 }; }
    setPointerCapture() { this.captured = true; } hasPointerCapture() { return this.captured; } releasePointerCapture() { this.captured = false; }
  }
  const node = (id: string, x: number, selected: boolean) => {
    let pos = { x, y: 100 }; const classes = new Set(); const emitted: string[] = [];
    return { id: () => id, selected: () => selected, visible: () => true, locked: () => false, removed: () => false,
      hasClass: (name: string) => classes.has(name), addClass: (name: string) => classes.add(name), removeClass: (name: string) => classes.delete(name),
      renderedPosition: () => pos, renderedWidth: () => 40, renderedHeight: () => 40,
      position: (value?: any) => value ? pos = value : pos, data: () => id, emit: (name: string) => emitted.push(name), emitted };
  };
  const a = node('a', 100, true), b = node('b', 300, false);
  const events = new Map();
  const cy = { nodes: (selector?: string) => selector ? [a] : [a, b], zoom: () => 1, batch: (fn: any) => fn(),
    on: (name: string, selector: any, fn?: any) => events.set(name, fn || selector) };
  const doc = new Element(), container = new Element(); let timer: any;
  const calls: any[] = []; const window: any = { addEventListener() {}, removeEventListener() {} };
  runInNewContext(readFileSync(new URL('../public/assets/scripts/graph-connect.js', import.meta.url), 'utf8'), {
    window, document: Object.assign(doc, { createElement: () => new Element() }), Date,
    setTimeout: (fn: any) => { timer = fn; return 1; }, clearTimeout: () => { timer = null; },
  });
  const controller = window.installGraphConnect(cy, container, (...args: any[]) => calls.push(args));
  const fire = (name: string, x = 100, extra = {}) => {
    let prevented = false;
    container.listeners.get(name)?.({ button: 0, isPrimary: true, pointerId: 1, pointerType, clientX: x + 10, clientY: 120,
      preventDefault() { prevented = true; }, stopImmediatePropagation() {}, ...extra });
    return prevented;
  };
  return { a, b, calls, controller, fire, hold: () => timer?.(), doc, container };
}

for (const type of ['mouse', 'touch', 'pen']) {
  test(`${type}: selected node hold-drag-release connects and keeps source stationary`, () => {
    const s = setup(type);
    expect(s.fire('pointerdown')).toBe(true);
    s.hold(); s.fire('pointermove', 300); s.fire('pointerup', 300);
    expect(s.calls).toEqual([['a', 'b', null]]);
    expect(s.a.position()).toEqual({ x: 100, y: 100 });
    expect(s.controller.isActive()).toBe(false);
    expect(s.a.hasClass('graph-connect-source')).toBe(false);
    expect(s.b.hasClass('edge-drop-target')).toBe(false);
  });
}
test('empty canvas stays native; quick drag moves selected node without connecting', () => {
  const s = setup();
  expect(s.fire('pointerdown', 500)).toBe(false);
  s.fire('pointerdown'); s.fire('pointermove', 140); s.hold(); s.fire('pointerup', 140);
  expect(s.a.position()).toEqual({ x: 140, y: 100 });
  expect(s.a.emitted).toContain('free');
  expect(s.calls).toHaveLength(0);
});
test('short tap keeps selection; releasing on source or blank never creates a relation', () => {
  const s = setup(); s.fire('pointerdown'); s.fire('pointerup');
  expect(s.a.selected()).toBe(true);
  for (const end of [100, 500]) { s.fire('pointerdown'); s.hold(); s.fire('pointerup', end); }
  expect(s.calls).toHaveLength(0);
});
test('cancel, Escape, and a second finger clean up preview without saving', () => {
  for (const reason of ['pointercancel', 'lostpointercapture', 'escape', 'second']) {
    const s = setup('touch'); s.fire('pointerdown'); s.hold(); s.fire('pointermove', 300);
    if (reason === 'escape') s.doc.listeners.get('keydown')({ key: 'Escape', preventDefault() {} });
    else if (reason === 'second') s.fire('pointerdown', 300, { pointerId: 2, isPrimary: false });
    else s.fire(reason);
    expect(s.calls).toHaveLength(0);
    expect(s.controller.isActive()).toBe(false);
    expect(s.a.hasClass('graph-connect-source')).toBe(false);
    expect(s.b.hasClass('edge-drop-target')).toBe(false);
    expect(s.container.children[1].hidden).toBe(true);
  }
});
test('touch target has extra hit area and native compatibility events are blocked during hold', () => {
  const s = setup('touch'); s.fire('pointerdown');
  expect(s.fire('touchstart')).toBe(true);
  s.hold(); s.fire('pointerup', 340);
  expect(s.calls).toEqual([['a', 'b', null]]);
});

for (const type of ['mouse','touch','pen']) {
  test(type + ': unselected node can connect without changing selection or position',()=>{
    const s=setup(type);expect(s.fire('pointerdown',300)).toBe(true);
    s.hold();s.fire('pointermove',100);s.fire('pointerup',100);
    expect(s.calls).toEqual([['b','a',null]]);
    expect(s.b.selected()).toBe(false);expect(s.b.position()).toEqual({x:300,y:100});
  });
}
test('quick drag of an unselected node moves only that node; a short tap retains normal selection flow',()=>{
  const s=setup();s.fire('pointerdown',300);s.fire('pointermove',340);s.fire('pointerup',340);
  expect(s.b.position()).toEqual({x:340,y:100});expect(s.a.position()).toEqual({x:100,y:100});
  expect(s.calls).toHaveLength(0);
  s.fire('pointerdown',340);s.fire('pointerup',340);expect(s.b.emitted).toContain('tap');
  s.fire('pointerdown',340);s.fire('pointerup',340);expect(s.b.emitted).toContain('dbltap');
});
