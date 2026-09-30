import { Database } from 'bun:sqlite';
import { test, expect } from 'bun:test';
import { loadPropertyTailSuggestions } from '../src/server/property-tail-suggestions.ts';
import { createKnowledgeDatabase, knowledgeContext } from '../src/server/knowledge-access.ts';

test('tail ontology suggestions include children, respect visibility and application scope, and work without historical values', () => {
  const raw = new Database(':memory:');
  try {
    raw.run('CREATE TABLE properties(id TEXT,tail_ontology_id TEXT,project_id INTEGER)');
    raw.run('CREATE TABLE ontologies(id TEXT,name TEXT,parent_id TEXT,project_id INTEGER)');
    raw.run('CREATE TABLE nodes(id TEXT,name TEXT,description TEXT,type TEXT,project_id INTEGER,visibility TEXT,owner_user_id INTEGER)');
    raw.run('CREATE TABLE knowledge_maintainers(node_id TEXT,user_id INTEGER)');
    raw.run("INSERT INTO properties VALUES('property/employer','ontology/org',1),('property/free','',1)");
    raw.run("INSERT INTO ontologies VALUES('ontology/org','机构',NULL,1),('ontology/school','学校','ontology/org',1)");
    raw.run("INSERT INTO nodes VALUES('a','大学','教学','ontology/school',1,'public',1),('b','公司','','机构',1,'public',1),('c','人物','','人物',1,'public',1),('d','别的应用','','ontology/org',2,'public',1),('e','私有机构','','ontology/org',1,'private',2)");
    const db = createKnowledgeDatabase(raw);
    knowledgeContext.run({ user: { id: 1, username: 'me' } }, () => {
      const result = loadPropertyTailSuggestions(db, ['employer', 'property/employer'], 1)!;
      expect(result.source).toBe('tail_ontology');
      expect(result.items.map((item: any) => item.id).sort()).toEqual(['a', 'b']);
      expect(loadPropertyTailSuggestions(db, ['property/employer'], 1, { query: '大学' })!.items).toHaveLength(1);
      expect(loadPropertyTailSuggestions(db, ['property/employer'], 1, { excludeId: 'entity/a' })!.items.map((item: any) => item.id)).toEqual(['b']);
      expect(loadPropertyTailSuggestions(db, ['property/free'], 1)).toBeNull();
      expect(loadPropertyTailSuggestions(db, ['property/employer'], 2)).toBeNull();
    });
  } finally { raw.close(); }
});
