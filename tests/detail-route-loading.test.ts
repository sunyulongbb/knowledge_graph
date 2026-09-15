import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/assets/scripts/detail-panel.js', import.meta.url), 'utf8');
const block = source.slice(source.indexOf('  function resolveInitialDetailRoute()'), source.indexOf('  window.hideDetailPanel ='));

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
