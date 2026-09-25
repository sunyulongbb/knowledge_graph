import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../public/assets/scripts/application-pages.js', import.meta.url), 'utf8');
function setup() {
  const elements: Record<string, any> = {};
  class Element {
    id = ''; style = { display: '' }; open = false; isConnected = true;
    parentNode: Element | null = null; children: Element[] = []; handlers: Record<string, Function[]> = {};
    classList = { remove() {} }; focusCount = 0;
    appendChild(child: Element) { child.remove(); child.parentNode = this; this.children.push(child); if (child.id) elements[child.id] = child; }
    before(child: Element) { child.parentNode = this.parentNode; this.parentNode!.children.splice(this.parentNode!.children.indexOf(this), 0, child); }
    remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter((item) => item !== this); this.parentNode = null; } }
    replaceWith(child: Element) { child.remove(); const parent = this.parentNode!; parent.children[parent.children.indexOf(this)] = child; child.parentNode = parent; this.parentNode = null; }
    setAttribute() {} addEventListener(name: string, fn: Function) { (this.handlers[name] ||= []).push(fn); }
    showModal() { this.open = true; } close() { this.open = false; this.handlers.close?.forEach((fn) => fn()); }
    querySelectorAll() { return []; } focus() { this.focusCount++; }
  }
  const body = new Element(), original = new Element(), panel = new Element(), focus = new Element();
  panel.id = 'detailPanel'; panel.style.display = 'none'; original.appendChild(panel); body.appendChild(original);
  const calls: any[] = [];
  const document = { body, activeElement: focus, createElement: () => new Element(), createComment: () => new Element() };
  const block = source.slice(source.indexOf('  let homeDetailDrawer'), source.indexOf('  function homeKnowledgeCard'));
  const api = new Function('byId', 'document', 'window', `${block}; return { open: openHomeNodeDetail, close: closeHomeDetailDrawer };`)(
    (id: string) => elements[id], document, { showNodeDetailInline: (...args: any[]) => calls.push(args) },
  );
  return { ...api, elements, original, panel, focus, calls };
}

test('home card opens right drawer using existing detail renderer; closing restores original panel and focus', () => {
  const h = setup();
  h.open({ id: 'Q1' });
  const drawer = h.elements.homeKnowledgeDrawer;
  expect(drawer.open).toBe(true);
  expect(h.panel.parentNode).toBe(drawer);
  expect(h.calls).toEqual([['Q1', { preserveSidebarState: true }]]);
  h.close();
  expect(drawer.open).toBe(false);
  expect(h.panel.parentNode).toBe(h.original);
  expect(h.panel.style.display).toBe('none');
  expect(h.focus.focusCount).toBe(1);
  h.open({ id: 'Q2' });
  expect(h.panel.parentNode).toBe(drawer);
  expect(h.calls.at(-1)[0]).toBe('Q2');
});

test('native dialog close such as Escape restores panel once', () => {
  const h = setup(); h.open({ id: 'Q1' });
  h.elements.homeKnowledgeDrawer.close(); h.close();
  expect(h.panel.parentNode).toBe(h.original);
  expect(h.original.children).toHaveLength(1);
  expect(h.focus.focusCount).toBe(1);
});
