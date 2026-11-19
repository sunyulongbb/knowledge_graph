import { ClassImportError, parseClassImport } from './class-import.ts';
import type { EnterpriseKnowledgeStore, ImportSchema } from './enterprise-knowledge.ts';

export async function importEnterpriseClasses(store: EnterpriseKnowledgeStore, database: string, projectId: number, input: unknown, legacySchema?: () => Partial<ImportSchema> | undefined) {
  const roots = parseClassImport(input);
  await store.ensureImportSchema(database);
  return store.transaction(database, async trx => {
    const seed = await store.importSchema(database, trx) || legacySchema?.();
    const schema: ImportSchema = structuredClone({classes:seed?.classes || [],ontologies:seed?.ontologies || [],properties:seed?.properties || [],ontology_properties:seed?.ontology_properties || []});
    let created = 0, updated = 0;
    const visit = (node: typeof roots[number], parent: string | null) => {
      let row = node.id ? schema.classes.find(row => row.id === node.id) : undefined;
      row ||= schema.classes.find(row => (row.parent_id || null) === parent && String(row.name).trim().toLowerCase() === node.name.toLowerCase());
      if (row) {
        row.name = node.name; row.parent_id = parent;
        for (const field of ['description','color','image','tags'] as const) if (node.provided.includes(field)) row[field] = node[field];
        updated++;
      } else {
        row = {id:node.id || `class/${crypto.randomUUID()}`,name:node.name,parent_id:parent,project_id:projectId,description:node.description,color:node.color,image:node.image,tags:node.tags,sort_order:Math.max(0,...schema.classes.filter(row => (row.parent_id || null) === parent).map(row => Number(row.sort_order) || 0))+1};
        schema.classes.push(row); created++;
      }
      for (const child of node.children) visit(child,row.id);
    };
    for (const root of roots) visit(root,null);
    const byId = new Map(schema.classes.map(row => [row.id,row]));
    for (const row of schema.classes) {
      const seen = new Set<string>(); let current = row;
      while (current) {
        if (seen.has(current.id)) throw new ClassImportError('分类层级存在循环：' + row.name);
        seen.add(current.id); current = byId.get(current.parent_id)!;
      }
    }
    const {body} = await store.client.database(database,'/_api/document/knowledge_schema?overwriteMode=replace',{method:'POST',headers:{'x-arango-trx-id':trx},body:JSON.stringify([{_key:'definitions',...schema}])});
    if (!Array.isArray(body) || body.some(row => row.error)) throw new Error('ArangoDB 分类写入失败');
    return {created,updated,total:created+updated};
  },['knowledge_schema']);
}
