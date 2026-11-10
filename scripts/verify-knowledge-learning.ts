// Uses live ArangoDB reads and temporary in-memory SQLite. No production writes.
import { Database } from 'bun:sqlite';
import { EnterpriseKnowledgeStore } from '../src/server/enterprise-knowledge.ts';
import { createLearningHandler } from '../src/server/learning.ts';
import { quizValue } from '../src/server/learning-quiz.ts';

const store = EnterpriseKnowledgeStore.configured();
const configuredDatabase = Bun.argv[2];
const databases: string[] = configuredDatabase ? [configuredDatabase]
  : (await store.client.system('/_api/database')).body.result.filter((name: string) => name !== '_system');
let database = '', seedId = '';
for (const candidate of databases) {
  let rows;
  try {
    rows = await store.query(candidate, `FOR doc IN entity
      FILTER doc.visibility == null OR doc.visibility == 'public'
      FILTER LENGTH(NOT_NULL(doc.labels, {})) > 0 OR LENGTH(TRIM(TO_STRING(NOT_NULL(doc.name,'')))) > 0
      LIMIT 1 RETURN {id:NOT_NULL(doc.sqlite_id,doc.id)}`);
  } catch (error) { if (configuredDatabase) throw error; continue; }
  if (rows.length) { database = candidate; seedId = rows[0]!.id; break; }
}
if (!seedId) throw new Error('没有可用于只读验证的公开知识实体');
const db = new Database(':memory:');
const user = { id: 1, username: 'learning-verification', role: 'admin' };
const handler = createLearningHandler({ db, store, getUser: () => user, getKnowledgeUser: () => user,
  getProject: () => ({ id: 1, name: database }) });
async function request(path: string, method = 'GET', body?: unknown) {
  const url = new URL(`/api/kb/learning${path}`, 'http://localhost');
  const response = await handler(new Request(url, { method, ...(body === undefined ? {} : {
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }) }), url);
  const data = await response!.json();
  if (!response!.ok) throw new Error(`学习验证失败: ${response!.status} ${data.error}`);
  return data;
}
try {
  const discovery = await request('/discover', 'POST', { nodeId: seedId });
  const ids = discovery.candidates.map((item: any) => item.node.id);
  const created = await request('/routes', 'POST', { name: '临时验证路线', nodeIds: ids });
  const id = created.route.id;
  const detail = await request(`/routes/${id}/level`);
  if (!detail.node.id || !Array.isArray(detail.related)) throw new Error('关卡详情不完整');
  let questionCount = 0;
  for (const nodeId of ids) {
    const quiz = await request(`/routes/${id}/quiz`, 'POST', { nodeId });
    const facts = await request(`/routes/${id}/level?nodeId=${encodeURIComponent(nodeId)}`);
    for (const question of quiz.questions) {
      const values = question.kind === 'name' ? [facts.node.name] : question.kind === 'description' ? [facts.node.description]
        : question.kind === 'property' ? facts.attributes.filter((attr: any) => String(attr.property || attr.key) === question.property).map((attr: any) => quizValue(attr.value))
          : facts.related.map((item: any) => item.node.name);
      const option = question.options.find((item: any) => values.includes(item.text));
      if (!option) throw new Error('无法从当前知识依据核对练习答案');
      const result = await request(`/routes/${id}/answer`, 'POST', { attemptId: quiz.attemptId, questionId: question.id, optionId: option.id });
      if (!result.correct) throw new Error('题目答案与当前知识不符');
      questionCount++;
    }
  }
  const completed = await request(`/routes/${id}`);
  if (completed.route.progress !== 100) throw new Error('进度未完成');
  const reordered = await request(`/routes/${id}`, 'PUT', { name: '临时调整路线', nodeIds: [...ids].reverse(), revision: completed.route.revision });
  if (reordered.route.progress !== 100) throw new Error('编辑后进度未保留');
  await request(`/routes/${id}`, 'DELETE');
  if ((await request('/routes')).routes.length) throw new Error('临时路线未删除');
  console.log(JSON.stringify({ result: 'passed', levels: ids.length, questions: questionCount, progress: 100,
    tested: ['discover', 'create', 'level', 'quiz', 'answer', 'complete', 'resume', 'reorder', 'delete'],
    arangoWrites: 0, sqlite: 'memory-only' }));
} finally { db.close(); }
