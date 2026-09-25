import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { reorderClasses } from '../src/server/class-reorder.ts';
import { createOntologyMovePayload } from '../public/assets/scripts/ontology-tree-adapter.ts';

function setup() {
  const db = new Database(':memory:');
  db.run('CREATE TABLE classes(id TEXT PRIMARY KEY,parent_id TEXT,sort_order INTEGER,project_id INTEGER)');
  db.run("INSERT INTO classes VALUES('a',NULL,1,1),('b',NULL,2,1),('c','a',1,1),('d','c',1,1),('foreign',NULL,1,2)");
  return db;
}

test('category moves persist sibling order and new parent including promotion to root', () => {
  const db = setup();
  try {
    reorderClasses(db, 1, [{ id: 'b', parent_id: null, sort_order: 1 }, { id: 'a', parent_id: null, sort_order: 2 }]);
    expect(db.query('SELECT id FROM classes WHERE project_id=1 AND parent_id IS NULL ORDER BY sort_order').all()).toEqual([{ id: 'b' }, { id: 'a' }]);
    reorderClasses(db, 1, [{ id: 'c', parent_id: 'b', sort_order: 1 }]);
    expect(db.query("SELECT parent_id FROM classes WHERE id='c'").get()).toEqual({ parent_id: 'b' });
    expect(db.query("SELECT parent_id FROM classes WHERE id='d'").get()).toEqual({ parent_id: 'c' });
    reorderClasses(db, 1, [{ id: 'c', parent_id: null, sort_order: 3 }]);
    expect(db.query("SELECT parent_id FROM classes WHERE id='c'").get()).toEqual({ parent_id: null });
  } finally { db.close(); }
});

test('invalid cycles, cross-application moves and duplicate updates are atomic', () => {
  const db = setup();
  try {
    const before = db.query('SELECT * FROM classes ORDER BY id').all();
    for (const updates of [
      [{ id: 'a', parent_id: 'd', sort_order: 1 }],
      [{ id: 'a', parent_id: 'a', sort_order: 1 }],
      [{ id: 'a', parent_id: 'b', sort_order: 1 }, { id: 'b', parent_id: 'a', sort_order: 1 }],
      [{ id: 'a', parent_id: 'foreign', sort_order: 1 }],
      [{ id: 'a', parent_id: null, sort_order: 2 }, { id: 'foreign', parent_id: null, sort_order: 3 }],
      [{ id: 'a', sort_order: 1 }, { id: 'a', sort_order: 2 }],
    ]) {
      expect(() => reorderClasses(db, 1, updates)).toThrow();
      expect(db.query('SELECT * FROM classes ORDER BY id').all()).toEqual(before);
    }
  } finally { db.close(); }
});

test('shared tree dispatches category moves to custom saver and reloads on success or failure', async () => {
  const source = readFileSync(new URL('../public/assets/scripts/ontology-tree.ts', import.meta.url), 'utf8');
  const start = source.indexOf('  private async persistDrop(');
  const end = source.indexOf('  private showContextMenu(', start);
  const body = source.slice(start, end).replace('private async persistDrop', 'async function persistDrop');
  const transpiled = new Bun.Transpiler({ loader: 'ts' }).transformSync(body);
  const save = new Function('createOntologyMovePayload', 'moveOntology', transpiled + '; return persistDrop;')(createOntologyMovePayload, () => { throw Error('wrong endpoint'); });
  for (const fail of [false, true]) {
    const calls: any[] = [];
    const controller = {
      tree: { data: { getRoot: () => 'root', getParent: () => 'b', getItems: () => [{ id: 'c' }, { id: 'a' }] } },
      busy: false, container: { setAttribute() {}, removeAttribute() {} },
      options: { nodeLabel: '分类', onMove: async (id: string, items: any[]) => { calls.push([id, items]); if (fail) throw Error('保存失败'); }, onReload: async () => { calls.push('reload'); } },
      notify: (message: string) => calls.push(message),
    };
    await save.call(controller, 'a');
    expect(calls[0]).toEqual(['a', [{ id: 'c', parentId: 'b', sortOrder: 1 }, { id: 'a', parentId: 'b', sortOrder: 2 }]]);
    expect(calls.at(-1)).toBe('reload');
    expect(controller.busy).toBe(false);
  }
});
