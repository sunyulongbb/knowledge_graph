/** Preserve Wikidata roles separately: membership is never a parent edge. */
export function applyWikidataSchema(schema: any, entity: any, projectId: number, updateCategories = true) {
  const values = (property: string) => entity.attributes.filter((a: any) => a.id === property).flatMap((a: any) => Array.isArray(a.value) ? a.value : [a.value]).filter((v: any) => v?.id);
  const ensure = (rows: any[], prefix: string, value: any) => {
    const id = `${prefix}/${value.id}`;
    let row = rows.find((r: any) => r.wikidata_id === value.id || r.id === id || (value.label_zh && [r.name, ...(Array.isArray(r.alias) ? r.alias : [])].includes(value.label_zh)));
    if (!row) { row = { id, wikidata_id: value.id, name: value.label_zh || value.id, alias: [], parent_id: null, project_id: projectId, status: 'active', sort_order: rows.length + 1 }; rows.push(row); }
    row.wikidata_id = value.id;
    if (value.label_zh && value.label_zh !== value.id) row.name = value.label_zh;
    return row;
  };
  const instances = values('P31');
  const parents = values('P279');
  const memberships = instances.map((value: any) => ensure(schema.ontologies, 'ontology', value));
  const categoryIds = (updateCategories ? instances : []).map((value: any) => ensure(schema.classes, 'wikidata-class', value).id);
  const setParents = (rows: any[], prefix: string, property: string, targets: any[]) => {
    const child = ensure(rows, prefix, { id: entity.id, label_zh: entity.name });
    const ids = targets.map(value => ensure(rows, prefix, value).id).filter(id => id !== child.id);
    child[`${property}_parents`] = ids;
    // Keep all typed parents; project only acyclic P279 into the legacy tree.
    if (property === 'P279') {
      child.parent_ids = ids;
      const reaches = (id: string, seen = new Set<string>()): boolean => {
        if (id === child.id) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        const row = rows.find(r => r.id === id);
        return (row?.parent_ids || (row?.parent_id ? [row.parent_id] : [])).some((parent: string) => reaches(parent, seen));
      };
      child.parent_id = ids.find(id => !reaches(id)) || null;
    }
    return child;
  };
  if (parents.length) {
    setParents(schema.ontologies, 'ontology', 'P279', parents);
    const category = updateCategories ? setParents(schema.classes, 'wikidata-class', 'P279', parents) : null;
    if (category) categoryIds.push(category.id);
  }
  if (updateCategories && values('P171').length) {
    const category = setParents(schema.classes, 'wikidata-class', 'P171', values('P171'));
    if (category) categoryIds.push(category.id);
  }
  // A class may also be an instance of a metaclass. Store that separately.
  const ownClass = schema.ontologies.find((row: any) => row.wikidata_id === entity.id);
  if (ownClass) ownClass.instance_of = memberships.map((row: any) => row.id);
  return { memberships, categoryIds };
}
