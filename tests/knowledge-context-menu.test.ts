import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync('public/assets/scripts/entity-manage-table.js', 'utf8');
function setup(initial: string[]) {
  const selected = new Set(initial);
  const window: any = {};
  const updates: string[][] = [];
  const synced: string[] = [];
  let countUpdates = 0;
  const start = source.indexOf('  window.selectEntityManageContextRow =');
  const end = source.indexOf('  function filteredNodes()', start);
  new Function('window', 'selected', 'normalizeId', 'entityGrid', 'syncGlobalSelection', 'updateCount', source.slice(start, end))(
    window, selected, (node: any) => String(node.id).replace(/^entity\//, ''),
    { setSelectedRows: (ids: Set<string>) => updates.push([...ids]) },
    (id: string) => synced.push(id), () => countUpdates++,
  );
  return { select: window.selectEntityManageContextRow, selected, updates, synced, countUpdates: () => countUpdates };
}

test('right-clicking a selected entity preserves the batch selection', () => {
  const h = setup(['a', 'b']); h.select('entity/b');
  expect([...h.selected]).toEqual(['a', 'b']);
  expect(h.updates).toEqual([]);
  expect(h.synced).toEqual([]);
});

test('right-clicking another entity replaces selection and synchronizes actions', () => {
  const h = setup(['a', 'b']); h.select('entity/c');
  expect([...h.selected]).toEqual(['c']);
  expect(h.updates).toEqual([['c']]);
  expect(h.synced).toEqual(['c']);
  expect(h.countUpdates()).toBe(1);
});

test('table right-click is captured for cells, headers and empty space', () => {
  const menuSource = readFileSync('public/assets/scripts/knowledge-context-menu.js', 'utf8');
  const start = menuSource.indexOf('  for (const host of');
  const end = menuSource.indexOf('  // Close before', start);
  let handler: any;
  let capture: any;
  const selected: string[] = [];
  const opened: any[] = [];
  const boundHosts: string[] = [];
  const host = {
    id: 'entityManageRows', contains: () => true,
    getBoundingClientRect: () => ({ left: 10, top: 10 }),
    addEventListener: (_type: string, callback: any, options: any) => { handler = callback; capture = options; },
  };
  new Function('document', 'window', 'open', 'normalize', menuSource.slice(start, end))(
    { getElementById: (id: string) => id === host.id ? host : { addEventListener: () => boundHosts.push(id) } },
    { selectEntityManageContextRow: (id: string) => selected.push(id) },
    (...args: any[]) => opened.push(args), (id: string) => id,
  );
  expect(capture).toBe(true);
  expect(boundHosts).toEqual([]);
  for (const row of [null, { dataset: { dhxId: 'a' }, getBoundingClientRect: host.getBoundingClientRect }]) {
    let prevented = false, stopped = false;
    handler({
      target: { closest: (selector: string) => selector.startsWith('[data-id]') ? row : null },
      clientX: 120, clientY: 80,
      preventDefault: () => { prevented = true; }, stopPropagation: () => { stopped = true; },
    });
    expect(prevented && stopped).toBe(true);
  }
  expect(selected).toEqual(['a']);
  expect(opened.length).toBe(2);
  expect(opened[0]).toEqual([120, 80, host]);
});
