import type { Database } from 'bun:sqlite';
export function randomKnowledge(db: Database, projectId: number | null, currentId: string, recent: string[] = []) {
  const current = currentId.replace(/^entity\//, '');
  const excluded = [...new Set([current, ...recent.map((id) => id.replace(/^entity\//, ''))].filter(Boolean))].slice(0, 51);
  const query = (ids: string[]) => db.query(`SELECT * FROM nodes WHERE project_id IS ? ${ids.length ? `AND id NOT IN (${ids.map(() => '?').join(',')})` : ''} ORDER BY RANDOM() LIMIT 1`).get(projectId, ...ids);
  return query(excluded) || (excluded.length > 1 ? query(current ? [current] : []) : null);
}
