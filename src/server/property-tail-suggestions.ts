import type { Database } from 'bun:sqlite';

export function loadPropertyTailSuggestions(db: Database, propertyKeys: string[], projectId: number | null, options: { limit?: number; query?: string; excludeId?: string } = {}) {
  const placeholders = propertyKeys.map(() => '?').join(',');
  if (!placeholders) return null;
  const property = db.query(`SELECT tail_ontology_id FROM properties WHERE id IN (${placeholders}) AND project_id IS ? LIMIT 1`).get(...propertyKeys, projectId) as any;
  const tailId = String(property?.tail_ontology_id || '').trim();
  if (!tailId) return null;
  const tail = db.query('SELECT id,name FROM ontologies WHERE id=? AND project_id IS ?').get(tailId, projectId) as any;
  if (!tail) return { items: [], source: 'tail_ontology', tailOntology: { id: tailId, name: tailId } };
  const query = String(options.query || '').trim();
  const limit = Math.max(1, Math.min(Number(options.limit) || 100, 100));
  const items = db.query(`WITH RECURSIVE tail_types(id,name) AS (
    SELECT id,name FROM ontologies WHERE id=? AND project_id IS ?
    UNION
    SELECT o.id,o.name FROM ontologies o JOIN tail_types t ON o.parent_id=t.id WHERE o.project_id IS ?
  ) SELECT n.id,n.name AS label,n.description,n.type FROM nodes n
    WHERE n.project_id IS ? AND n.id <> ?
      AND EXISTS (SELECT 1 FROM tail_types t WHERE n.type=t.id OR lower(n.type)=lower(t.name))
      AND (?='' OR instr(lower(COALESCE(n.name,'')),lower(?))>0 OR instr(lower(COALESCE(n.description,'')),lower(?))>0)
    ORDER BY CASE WHEN n.type=? THEN 0 ELSE 1 END, n.name,n.id LIMIT ?
  `).all(tailId, projectId, projectId, projectId, String(options.excludeId || '').replace(/^entity\//, ''), query, query, query, tailId, limit);
  return { items, source: 'tail_ontology', tailOntology: tail };
}
