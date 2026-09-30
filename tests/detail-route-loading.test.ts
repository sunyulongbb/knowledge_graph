import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/assets/scripts/detail-panel.js', import.meta.url), 'utf8');
const block = source.slice(source.indexOf('  function resolveInitialDetailRoute()'), source.indexOf('  window.hideDetailPanel ='));
const tableSelectionSource = readFileSync(new URL('../public/assets/scripts/table-selection.js', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const manageTableSource = readFileSync(new URL('../public/assets/scripts/entity-manage-table.js', import.meta.url), 'utf8');

function hydrate(window: any) {
  const loads: any[] = [];
  const panel = { style: { display: 'none' } };
  const document = { getElementById: () => panel };
  new Function('window', 'document', 'showNodeDetailInline', 'normalizeEntityIdForApi', `${block}\nhydrateDetailFromCurrentRoute();`)(
    window, document, (...args: any[]) => loads.push(args), (id: string) => `entity/${id}`,
  );
  return { loads, panel };
}

for (const view of ['detail', 'knowledge_detail']) {
  for (const routeSource of ['hash helper', 'query helper', 'hash', 'short hash']) {
    test(`refresh loads ${view} from ${routeSource} after the detail script becomes available`, () => {
      const window: any = { location: { hash: '', search: '' } };
      if (routeSource === 'hash helper') window.getRouteStateFromHash = () => ({ view, node: 'Q1' });
      if (routeSource === 'query helper') window.getUrlParams = () => ({ view, node: 'Q1' });
      if (routeSource === 'hash') window.location.hash = `#view=${view}&node=Q1`;
      if (routeSource === 'short hash') window.location = { hash: `#${view}`, search: '?node=Q1' };
      const { loads, panel } = hydrate(window);
      expect(loads).toEqual([['Q1', { preserveSidebarState: view === 'knowledge_detail' }]]);
      expect(panel.style.display).toBe('');
      expect(window.kbActiveDetailRouteId).toBe('Q1');
      expect(window.kbActiveDetailNodeId).toBe('entity/Q1');
    });
  }
}

test('refresh does not load details for other views or a missing node', () => {
  for (const hash of ['#view=table&node=Q1', '#view=knowledge_detail', '']) {
    expect(hydrate({ location: { hash, search: '' } }).loads).toEqual([]);
  }
});

test('route selection treats raw and canonical entity ids as the same knowledge', () => {
  const helperBlock = tableSelectionSource.slice(
    tableSelectionSource.indexOf('  function normalizeEntityIdLike'),
    tableSelectionSource.indexOf('  function getNodeVideoEntryKey'),
  );
  const isSameEntityId = new Function(`${helperBlock}\nreturn isSameEntityId;`)();
  expect(isSameEntityId('Q1', 'entity/Q1')).toBe(true);
  expect(isSameEntityId('entity/Q1', 'Q2')).toBe(false);
  expect(isSameEntityId('', '')).toBe(false);
});

test('refresh hydration keeps entity reads in the selected application scope', () => {
  const restoreBlock = indexSource.slice(
    indexSource.indexOf('    function restoreKnowledgeRouteState'),
    indexSource.indexOf('    async function enforceRouteNodeSelectionAndEdit'),
  );
  const enforceBlock = indexSource.slice(
    indexSource.indexOf('    async function enforceRouteNodeSelectionAndEdit'),
    indexSource.indexOf('    function normalizeTimestamp'),
  );
  expect(restoreBlock).toContain('window.appendCurrentDbParam(url)');
  expect(enforceBlock).toContain('window.appendCurrentDbParam(url)');
});

test('opening the entity management table selects the entity from the route', () => {
  expect(manageTableSource).toContain('function hydrateSelectionFromRoute()');
  const openBlock = manageTableSource.slice(
    manageTableSource.indexOf('window.openEntityManageTable ='),
    manageTableSource.indexOf('window.closeEntityManageTable ='),
  );
  expect(openBlock).toContain('hydrateSelectionFromRoute();');
  expect(openBlock.indexOf('hydrateSelectionFromRoute();')).toBeLessThan(openBlock.indexOf('void render();'));
});

test('deselecting invalidates pending entity hydration before clearing the editor', () => {
  const selectionBlock = tableSelectionSource.slice(
    tableSelectionSource.indexOf('  function setTableSelection'),
    tableSelectionSource.indexOf('  function toggleCtrlSelection'),
  );
  expect(selectionBlock).toContain('window.kbEnterEditRequestSeq =');
  expect(selectionBlock).toContain('window.kbRouteEnforceSeq =');
  expect(selectionBlock).toContain('window.kbCurrentNodePayload = null');

  const resetBlock = indexSource.slice(
    indexSource.indexOf('    function resetFormToAdd()'),
    indexSource.indexOf('    window.resetFormToAdd = resetFormToAdd'),
  );
  expect(resetBlock).toContain('window.kbCurrentNodePayload = null');
});

test('entity image deletion is staged and persisted by the normal save action', () => {
  expect(indexSource).toContain('window.kbReplaceEntityImagesOnSave = true');
  expect(indexSource).toContain("'已删除图片预览，点击保存后同步到知识。'");
  expect(indexSource).toContain('? { images: pendingHeaderImages }');
});
