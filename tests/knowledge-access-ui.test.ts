import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

test('UI grants anonymous access only in the default application and rejects unauthorized selections elsewhere', () => {
  const source = readFileSync(new URL('../public/assets/scripts/knowledge-access.js', import.meta.url), 'utf8');
  const policy = source.slice(source.indexOf('  const hasAnonymousDefaultAccess'), source.indexOf('  const editControls')).replace('  let editorNode = null;\n', '');
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
  expect(window.canOperateKnowledgeSelection(['own', 'maintained'], 'manage')).toBe(false);
  expect(window.canOperateKnowledgeSelection(['own', 'public'], 'edit')).toBe(false);
  expect(window.canOperateKnowledgeSelection(['missing'], 'edit')).toBe(false);
  expect(window.canOperateKnowledgeSelection([], 'manage')).toBe(false);
  field.value = 'public';
  editorNode.can_edit = false;
  expect(window.canEditCurrentKnowledge()).toBe(false);
  field.value = '';
  window.kbApplicationScope = 'restricted';
  expect(window.canEditCurrentKnowledge()).toBe(false);
  window.kbApplicationProjects = [{ slug: 'restricted', member: true }];
  expect(window.canEditCurrentKnowledge()).toBe(true);
});
