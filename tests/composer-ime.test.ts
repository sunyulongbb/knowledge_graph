import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
function setup() {
  const listeners: Record<string, Function> = {};
  const pending = new Map<number, Function>();
  let id = 0, syncs = 0, renders = 0;
  const editor = { composerIsComposing: false, addEventListener: (name: string, fn: Function) => { listeners[name] = fn; } };
  const start = html.indexOf('      let compositionCommitTimer =');
  const end = html.indexOf("      entityDisplayName.addEventListener('paste'", start);
  new Function('entityDisplayName', 'syncComposerToHiddenFields', 'renderComposerDecorationsPreserveCaret', 'setTimeout', 'clearTimeout', html.slice(start, end))(
    editor, () => syncs++, () => renders++,
    (fn: Function) => { pending.set(++id, fn); return id; }, (key: number) => pending.delete(key),
  );
  return { listeners, editor, counts: () => [syncs, renders], flush: () => { for (const [key, fn] of pending) { pending.delete(key); fn(); } } };
}

test('pinyin intermediate input does not sync or rebuild the editor; committed text syncs once', () => {
  const h = setup();
  h.listeners.compositionstart();
  h.listeners.input({ isComposing: true });
  h.listeners.input({ isComposing: false });
  expect(h.counts()).toEqual([0, 0]);
  h.listeners.compositionend();
  expect(h.counts()).toEqual([0, 0]);
  h.listeners.input({ isComposing: false });
  h.flush();
  expect(h.counts()).toEqual([1, 1]);
});

test('composition without a final input commits, but a new composition cancels pending repaint', () => {
  const h = setup();
  h.listeners.compositionstart(); h.listeners.compositionend(); h.flush();
  expect(h.counts()).toEqual([1, 1]);
  h.listeners.compositionstart(); h.listeners.compositionend(); h.listeners.compositionstart(); h.flush();
  expect(h.counts()).toEqual([1, 1]);
});

test('IME keys never enter the newline, submit or mention handlers', () => {
  const start = html.indexOf("      entityDisplayName.addEventListener('keydown', (event) => {");
  const end = html.indexOf('      // @mention 搜索逻辑', start);
  let handler: Function = () => {};
  const editor = { composerIsComposing: false, addEventListener: (_: string, fn: Function) => { handler = fn; } };
  new Function('entityDisplayName', html.slice(start, end))(editor);
  for (const key of ['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Escape']) {
    handler({ key, isComposing: true, preventDefault: () => { throw Error('IME key intercepted'); } });
    handler({ key, keyCode: 229, ctrlKey: true });
    editor.composerIsComposing = true;
    handler({ key, isComposing: false });
    editor.composerIsComposing = false;
  }
});
