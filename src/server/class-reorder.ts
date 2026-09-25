import type { Database } from 'bun:sqlite';

export function reorderClasses(db: Database, projectId: number | null, updates: unknown) {
  if (!Array.isArray(updates) || !updates.length) throw new Error('请选择要移动的分类');
  return db.transaction(() => {
    const classes = db.query('SELECT id,parent_id FROM classes WHERE project_id IS ?').all(projectId) as { id: string; parent_id: string | null }[];
    const parents = new Map(classes.map((item) => [item.id, item.parent_id]));
    const seen = new Set<string>();
    const rows = updates.map((item: any) => {
      const id = typeof item?.id === 'string' ? item.id : '';
      const parent = item?.parent_id == null || item.parent_id === '' ? null : item.parent_id;
      const order = Number(item?.sort_order);
      if (!parents.has(id) || seen.has(id)) throw new Error('分类不存在、重复或不属于当前应用');
      if (parent !== null && (typeof parent !== 'string' || !parents.has(parent))) throw new Error('目标父分类不属于当前应用');
      if (item.sort_order == null || !Number.isFinite(order) || order < 0) throw new Error('分类顺序无效');
      seen.add(id);
      parents.set(id, parent);
      return { id, parent, order };
    });
    for (const { id } of rows) {
      const path = new Set<string>();
      let current: string | null = id;
      while (current) {
        if (path.has(current)) throw new Error('不能将分类移动到自身或其后代下面');
        path.add(current);
        current = parents.get(current) || null;
      }
    }
    const statement = db.prepare('UPDATE classes SET parent_id=?,sort_order=? WHERE id=? AND project_id IS ?');
    for (const row of rows) statement.run(row.parent, row.order, row.id, projectId);
    return rows.length;
  })();
}
