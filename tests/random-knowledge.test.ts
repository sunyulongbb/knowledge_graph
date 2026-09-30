import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { randomKnowledge } from '../src/server/random-knowledge.ts';
import { createKnowledgeDatabase, knowledgeContext } from '../src/server/knowledge-access.ts';
test('random paging stays in application, excludes current entity, respects private knowledge and handles exhausted history', () => {
  const raw = new Database(':memory:');
  try {
    raw.run('CREATE TABLE nodes(id TEXT,project_id INTEGER,visibility TEXT,owner_user_id INTEGER)');
    raw.run('CREATE TABLE knowledge_maintainers(node_id TEXT,user_id INTEGER)');
    raw.run("INSERT INTO nodes VALUES('a',1,'public',1),('b',1,'public',1),('private',1,'private',2),('other',2,'public',1)");
    const db = createKnowledgeDatabase(raw);
    knowledgeContext.run({ user: { id: 1, username: 'me' } }, () => {
      expect(randomKnowledge(db, 1, 'entity/a', ['b'])).toMatchObject({ id: 'b' });
      expect(randomKnowledge(db, 2, 'other')).toBeNull();
    });
  } finally { raw.close(); }
});
