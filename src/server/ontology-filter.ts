// UNION deduplicates visited IDs, including malformed cyclic hierarchies.
// Seed the selected ID even if its ontology record no longer exists.
export const ontologyTypeFilterSql = `lower(trim(n.type)) IN (
  WITH RECURSIVE ontology_subtree(id) AS (
    SELECT lower(trim(?))
    UNION
    SELECT lower(trim(child.id))
    FROM ontologies child
    JOIN ontology_subtree parent ON lower(trim(child.parent_id)) = parent.id
  )
  SELECT id FROM ontology_subtree
)`;
