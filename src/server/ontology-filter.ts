/** Types hidden from knowledge lists; reference pickers can still query them. */
export function hiddenKnowledgeTypes(ontologies: Record<string, any>[] = []): string[] {
  const names = new Set(['entity', '实体', '实体条目', 'wikibase item']);
  const hidden = new Set([...names, 'ontology/wikibase-item']);
  for (const ontology of ontologies) {
    let aliases = ontology.alias;
    if (typeof aliases === 'string') {
      try { aliases = JSON.parse(aliases); } catch { aliases = [aliases]; }
    }
    if ([ontology.name, ...(Array.isArray(aliases) ? aliases : [])].some(value => names.has(String(value || '').trim().toLowerCase()))
      || String(ontology.description || '').toLowerCase().includes('wikibase-item 属性值自动创建')) {
      if (ontology.id) hidden.add(String(ontology.id));
    }
  }
  return [...hidden];
}

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

// Used by the application home: a knowledge entity is visible there only when
// at least one of its category links resolves inside the same application's
// classification tree.
export const definedClassEntityFilterSql = `EXISTS (
  SELECT 1
  FROM entity_classes defined_entity_class
  INNER JOIN classes defined_class ON defined_class.id = defined_entity_class.class_id
  WHERE defined_entity_class.entity_id = n.id
    AND defined_class.project_id IS n.project_id
)`;
