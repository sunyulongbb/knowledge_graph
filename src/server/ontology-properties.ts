import type { Database } from 'bun:sqlite';

/** Resolve inherited properties without copying associations into the child. */
export function loadOntologyProperties(db: Database, ontologyId: string, projectId: number | null, includeInherited = false): any[] {
  return db.query(`
    WITH RECURSIVE ancestors(id, parent_id) AS (
      SELECT id, parent_id FROM ontologies WHERE id = ? AND project_id IS ?
      UNION
      SELECT parent.id, parent.parent_id
      FROM ontologies parent JOIN ancestors child ON parent.id = child.parent_id
      WHERE ? = 1 AND parent.project_id IS ?
    )
    SELECT p.*, MAX(CASE WHEN op.ontology_id = ? THEN 1 ELSE 0 END) AS is_local
    FROM properties p
    JOIN ontology_properties op ON op.property_id = p.id
    JOIN ancestors a ON a.id = op.ontology_id
    WHERE p.project_id IS ? AND COALESCE(p.status, 'active') = 'active'
    GROUP BY p.id
    ORDER BY is_local DESC, p.name, p.id
  `).all(ontologyId, projectId, includeInherited ? 1 : 0, projectId, ontologyId, projectId);
}
