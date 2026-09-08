import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

test('direct checkbox clicks update once and bypass grid row selection', () => {
  const source = readFileSync(new URL('../public/assets/scripts/business-grid.ts', import.meta.url), 'utf8');
  const start = source.indexOf('  private handleSelectAll = (event: Event): void => {');
  const end = source.indexOf('\n  constructor(', start);
  const body = source.slice(start, end).replace('  private handleSelectAll = (event: Event): void => {', 'return function(event) {').replace(/;\s*$/, ';');
  class Input {
    checked = true;
    disabled = false;
    dataset: { gridSelectId?: string } = { gridSelectId: 'a' };
    matches() { return true; }
  }
  const compiled = new Bun.Transpiler({ loader: 'ts' }).transformSync(`function factory(HTMLInputElement) { ${body} }`);
  const handler = new Function(compiled + ';return factory;')()(Input);
  const calls: unknown[] = [];
  const controller = { selectAll: (ids: string[], checked: boolean) => calls.push([ids, checked]), grid: { data: { forEach: (fn: any) => [{ id: 'a' }, { id: 'b' }].forEach(fn) } } };
  const target = new Input();
  let stopped = 0;
  const dispatch = (type: string) => handler.call(controller, { type, target, stopPropagation() { stopped++; } });
  dispatch('pointerdown'); dispatch('mousedown'); dispatch('click'); dispatch('change');
  expect(calls).toEqual([[['a'], true]]);
  expect(stopped).toBe(4);
  target.checked = false;
  dispatch('click');
  expect(calls.at(-1)).toEqual([['a'], false]);
  target.dataset = {};
  target.checked = true;
  dispatch('click');
  expect(calls.at(-1)).toEqual([['a', 'b'], true]);
});

test('select all tracks current page, partial selection and empty pages', () => {
  const source = readFileSync(new URL('../public/assets/scripts/business-grid.ts', import.meta.url), 'utf8');
  const code = source.slice(source.indexOf('export class BusinessGridController'), source.indexOf('const registry =')).replace('export class', 'class');
  const Controller = new Function(new Bun.Transpiler({ loader: 'ts' }).transformSync(code) + ';return BusinessGridController;')();
  const controller = Object.create(Controller.prototype);
  const header: any = {};
  const checks = [{ dataset: { gridSelectId: 'a' }, checked: false }, { dataset: { gridSelectId: 'b' }, checked: false }];
  let rows = [{ id: 'a' }, { id: 'b' }];
  let reported: string[] = [];
  controller.options = { selectAll: true, onSelectionChange: (ids: string[]) => { reported = ids; } };
  controller.selectedRows = new Set(['other-page']);
  controller.grid = { data: { forEach: (fn: any) => rows.forEach(fn) }, addRowCss() {}, removeRowCss() {} };
  controller.host = { querySelectorAll: (selector: string) => selector === '.business-grid-select-all' ? [header] : checks };
  controller.selectAll(['a'], true);
  expect(header.indeterminate).toBe(true);
  expect(header.checked).toBe(false);
  controller.selectAll(['a', 'b'], true);
  expect(header.checked).toBe(true);
  expect(header.indeterminate).toBe(false);
  expect(checks.every((input) => input.checked)).toBe(true);
  expect(reported).toEqual(['other-page', 'a', 'b']);
  controller.selectAll(['a', 'b'], false);
  expect(header.checked).toBe(false);
  expect(checks.some((input) => input.checked)).toBe(false);
  expect(reported).toEqual(['other-page']);
  rows = [];
  controller.setSelectedRows(reported);
  expect(header.disabled).toBe(true);
  expect(header.indeterminate).toBe(false);
});
