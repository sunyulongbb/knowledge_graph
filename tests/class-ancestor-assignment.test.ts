import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/assets/scripts/schema-panel.js', import.meta.url), 'utf8');
const start = source.indexOf('  function getParentClassId(');
const end = source.indexOf('  async function autoAssignSelectedClassToNode(', start);
function setup(classes: object[], assigned: object[] = [], parentMap?: Map<string, string>) {
  const saved: string[] = [];
  const assign = new Function('window', 'setEntityClass', `${source.slice(start, end)}; return assignEntityClassWithAncestors;`)(
    { kbClasses: classes, kbEntityClasses: assigned, kbClassMeta: parentMap ? { parentMap } : undefined },
    async (_entity: string, id: string) => { saved.push(id); },
  );
  return { saved, assign };
}

test('selecting a nested category saves every ancestor root first, without siblings', async () => {
  const h = setup([{ id: 'root' }, { id: 'parent', parent_id: 'root' }, { id: 'child', parent_id: 'parent' }, { id: 'sibling', parent_id: 'root' }]);
  await h.assign('entity/1', 'child');
  expect(h.saved).toEqual(['root', 'parent', 'child']);
});

test('tree metadata is supported and existing assignments are not posted again', async () => {
  const h = setup([], [{ id: 'root' }], new Map([['child', 'parent'], ['parent', 'root']]));
  await h.assign('entity/1', 'child');
  expect(h.saved).toEqual(['parent', 'child']);
});

test('root categories and malformed cycles terminate without duplicate writes', async () => {
  const root = setup([{ id: 'root' }]);
  await root.assign('entity/1', 'root');
  expect(root.saved).toEqual(['root']);
  const cycle = setup([{ id: 'a', parent: 'b' }, { id: 'b', parent: 'a' }]);
  await cycle.assign('entity/1', 'a');
  expect(cycle.saved).toEqual(['b', 'a']);
});
