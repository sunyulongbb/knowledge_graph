import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

test('UI grants every user full access in the default application and rejects unauthorized selections elsewhere', () => {
  const source = readFileSync(new URL('../public/assets/scripts/knowledge-access.js', import.meta.url), 'utf8');
  const policy = source.slice(source.indexOf('  const hasDefaultApplicationAccess'), source.indexOf('  const editControls')).replace('  let editorNode = null;\n', '');
  const window: any = { authUser: null, location: { search: '?db=other' }, kbTableNodes: [
    { id: 'own', can_edit: true, can_manage: true },
    { id: 'maintained', can_edit: true, can_manage: false },
    { id: 'public', can_edit: false, can_manage: false },
  ] };
  const field = { value: '' };
  const editorNode = { can_edit: true };
  new Function('window', 'byId', 'editorNode', 'normalizeId', policy)(window, () => field, editorNode, (id: string) => String(id).replace(/^entity\//, ''));
  expect(window.canEditCurrentKnowledge()).toBe(false);
  expect(window.canOperateKnowledgeSelection(['own'], 'manage')).toBe(false);
  window.location.search = '?db=default';
  window.kbApplicationScope = 'default';
  window.kbApplicationProjects = [{ slug: 'default', member: true }];
  expect(window.canEditCurrentKnowledge()).toBe(true);
  expect(window.canOperateKnowledgeSelection(['own'], 'manage')).toBe(true);
  window.authUser = { id: 1 };
  expect(window.canEditCurrentKnowledge()).toBe(true);
  expect(window.canOperateKnowledgeSelection(['entity/own'], 'manage')).toBe(true);
  expect(window.canOperateKnowledgeSelection(['own', 'maintained'], 'edit')).toBe(true);
  expect(window.canOperateKnowledgeSelection(['own', 'maintained'], 'manage')).toBe(true);
  expect(window.canOperateKnowledgeSelection(['own', 'public'], 'edit')).toBe(true);
  expect(window.canOperateKnowledgeSelection(['missing'], 'edit')).toBe(true);
  expect(window.canOperateKnowledgeSelection([], 'manage')).toBe(false);
  field.value = 'public';
  editorNode.can_edit = false;
  expect(window.canEditCurrentKnowledge()).toBe(true);
  field.value = '';
  window.location.search = '?db=restricted';
  window.kbApplicationScope = 'restricted';
  expect(window.canEditCurrentKnowledge()).toBe(false);
  window.kbApplicationProjects = [{ slug: 'restricted', member: true }];
  expect(window.canEditCurrentKnowledge()).toBe(true);
});

test('visibility label update does not retrigger the document mutation observer indefinitely', () => {
  const script = readFileSync('public/assets/scripts/knowledge-access.js', 'utf8');
  expect(script).toContain("if (label && label.textContent !== labelText) label.textContent = labelText;");
  expect(script).not.toContain("if (label) label.textContent = isPrivate ? '仅成员可见' : '公开可见';");
});
