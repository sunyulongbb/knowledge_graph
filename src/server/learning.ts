import type { Database } from 'bun:sqlite';
import { buildLearningQuestions } from './learning-quiz.ts';
import type { KnowledgeUser } from './knowledge-access.ts';
import { documentKey } from './arangodb.ts';
import { EnterpriseKnowledgeStore, KnowledgeStoreError, arangoNodeResponse, arangoAttributeResponse, cleanKnowledgeId, knowledgeReadAccess, canUseArangoKnowledge } from './enterprise-knowledge.ts';

type Row = Record<string, any>;
export function ensureLearningSchema(db: Database) {
  db.run(`CREATE TABLE IF NOT EXISTS learning_routes (
    id TEXT PRIMARY KEY, project_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    name TEXT NOT NULL, node_ids_json TEXT NOT NULL, completed_ids_json TEXT NOT NULL DEFAULT '[]',
    current_node_id TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run('CREATE INDEX IF NOT EXISTS learning_routes_owner ON learning_routes(user_id, project_id, updated_at)');
}
export function learningNodeIds(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 100) throw new KnowledgeStoreError('请选择 1–100 个知识关卡');
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') throw new KnowledgeStoreError('知识 ID 必须是字符串');
    const id = cleanKnowledgeId(item);
    if (!id || id.length > 512) throw new KnowledgeStoreError('知识 ID 无效');
    if (ids.includes(id)) throw new KnowledgeStoreError('学习路线不能包含重复知识');
    ids.push(id);
  }
  return ids;
}
export function learningRoute(row: Row) {
  const nodeIds = JSON.parse(row.node_ids_json) as string[];
  const completedIds = (JSON.parse(row.completed_ids_json) as string[]).filter(id => nodeIds.includes(id));
  return { id: row.id, name: row.name, nodeIds, completedIds,
    currentNodeId: nodeIds.includes(row.current_node_id) ? row.current_node_id : nodeIds.find(id => !completedIds.includes(id)) || '',
    levelCount: nodeIds.length, completedCount: completedIds.length, progress: Math.round(completedIds.length / Math.max(1, nodeIds.length) * 100),
    revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at };
}
export async function learningNodes(store: EnterpriseKnowledgeStore, database: string, ids: string[], user: KnowledgeUser) {
  if (!ids.length) return [];
  const access = knowledgeReadAccess(user);
  const rows = await store.query(database, `FOR key IN @keys LET doc = DOCUMENT('entity', key)
    FILTER doc != null AND ${access.filter} RETURN doc`, { ...access.bindVars, keys: ids.map(documentKey) });
  const nodes = new Map(rows.filter(row => canUseArangoKnowledge(row, user)).map(row => {
    const node = arangoNodeResponse(row, user); return [node.id, node];
  }));
  return ids.map(id => nodes.get(id) || { id, name: '知识已删除或无权访问', unavailable: true });
}
export async function discoverLearningRoute(store: EnterpriseKnowledgeStore, database: string, id: string, user: KnowledgeUser) {
  const seed = await store.require(database, id, user);
  const center = arangoNodeResponse(seed, user);
  if (!String(center.name || '').trim()) throw new KnowledgeStoreError('请选择有名称的知识作为主题');
  const access = knowledgeReadAccess(user, 'neighbor');
  const rows = await store.query(database, `WITH entity
    FOR neighbor, edge, path IN 1..2 ANY @vertex GRAPH 'graph'
      PRUNE blocked = neighbor == null OR NOT (${access.filter})
      OPTIONS { order: 'bfs', uniqueVertices: 'global', uniqueEdges: 'path' }
      FILTER NOT blocked AND neighbor._id != @vertex
      FILTER LENGTH(TRIM(TO_STRING(NOT_NULL(neighbor.name, '')))) > 0 OR LENGTH(NOT_NULL(neighbor.labels, {})) > 0
      LIMIT 20
      RETURN { node: neighbor, depth: LENGTH(path.edges), relation: NOT_NULL(edge.property_name, edge.property_id, '关联') }`,
    { ...access.bindVars, vertex: seed._id || `entity/${documentKey(id)}` });
  const seen = new Set([center.id]);
  const candidates = [{ node: center, depth: 0, relation: '学习主题' }];
  for (const row of rows.sort((a, b) => a.depth - b.depth)) {
    if (!canUseArangoKnowledge(row.node, user)) continue;
    const node = arangoNodeResponse(row.node, user);
    if (!node.id || !String(node.name || '').trim() || seen.has(node.id)) continue;
    seen.add(node.id); candidates.push({ node, depth: row.depth, relation: String(row.relation || '关联') });
    if (candidates.length === 21) break;
  }
  return { name: `${center.name}学习路线`, candidates,
    note: '按两跳广度优先遍历组织候选顺序；关联距离不代表知识难度或前置依赖，可自行调整。' };
}

type Dependencies = {
  db: Database; store: EnterpriseKnowledgeStore | null;
  getUser: (req: Request) => KnowledgeUser | null;
  getKnowledgeUser: (req: Request) => KnowledgeUser | null;
  getProject: (slug: string) => Row | null;
};
export function createLearningHandler(deps: Dependencies) {
  ensureLearningSchema(deps.db);
  const { db, store } = deps;
  const attempts = new Map<string, { routeId: string; userId: number; projectId: number; nodeId: string; expires: number; questions: Row[]; answered: Set<string> }>();
  return async (req: Request, url: URL): Promise<Response | null> => {
    if (!url.pathname.startsWith('/api/kb/learning')) return null;
    try {
      const match = /^\/api\/kb\/learning\/(discover|routes)(?:\/([a-zA-Z0-9-]+))?(?:\/(level|progress|quiz|answer))?$/.exec(url.pathname);
      if (!match) throw new KnowledgeStoreError('学习接口不存在', 404);
      const user = deps.getUser(req);
      if (!user || user.id <= 0) throw new KnowledgeStoreError('请先登录后使用个人学习路线', 401);
      const project = deps.getProject(url.searchParams.get('db') || 'default');
      if (!project) throw new KnowledgeStoreError('应用不存在', 404);
      const knowledgeUser = deps.getKnowledgeUser(req) || user;
      const database = String(project.name);
      const action = match[1], id = match[2], sub = match[3], method = req.method;
      const readRow = () => {
        const row = db.query('SELECT * FROM learning_routes WHERE id=? AND user_id=? AND project_id=?').get(id!, user.id, project.id) as Row | null;
        if (!row) throw new KnowledgeStoreError('学习路线不存在', 404);
        return row;
      };
      const requireStore = () => { if (!store) throw new KnowledgeStoreError('知识学习需要启用 ArangoDB 知识存储', 503); return store; };
      const updateProgress = (nodeId: string, complete = false) => db.transaction(() => {
        const current = learningRoute(readRow());
        if (!current.nodeIds.includes(nodeId)) throw new KnowledgeStoreError('路线已调整，请重新打开', 409);
        const completed = new Set(current.completedIds);
        if (complete) completed.add(nodeId);
        const index = current.nodeIds.indexOf(nodeId);
        const next = complete ? [...current.nodeIds.slice(index + 1), ...current.nodeIds.slice(0, index + 1)].find(key => !completed.has(key)) || '' : nodeId;
        db.run('UPDATE learning_routes SET completed_ids_json=?,current_node_id=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND project_id=?',
          [JSON.stringify([...completed]), next, id!, user.id, project.id]);
        return learningRoute(readRow());
      })();
      if (action === 'routes' && !id && method === 'GET') {
        const rows = db.query('SELECT * FROM learning_routes WHERE user_id=? AND project_id=? ORDER BY updated_at DESC,id').all(user.id, project.id) as Row[];
        return Response.json({ routes: rows.map(learningRoute) });
      }
      if (action === 'routes' && id && !sub && method === 'DELETE') {
        readRow(); db.run('DELETE FROM learning_routes WHERE id=? AND user_id=? AND project_id=?', [id, user.id, project.id]);
        return Response.json({ ok: true });
      }
      if (action === 'routes' && id && method === 'GET') {
        const row = readRow(), route = learningRoute(row), knowledge = requireStore();
        if (!sub) return Response.json({ route, nodes: await learningNodes(knowledge, database, route.nodeIds, knowledgeUser) });
        if (sub !== 'level') throw new KnowledgeStoreError('不支持的操作', 405);
        const nodeId = cleanKnowledgeId(url.searchParams.get('nodeId') || route.currentNodeId || route.nodeIds[0]);
        if (!route.nodeIds.includes(nodeId)) throw new KnowledgeStoreError('该知识不属于当前路线', 400);
        const node = await knowledge.require(database, nodeId, knowledgeUser);
        const [attrs, relations] = await Promise.all([knowledge.attributes(database, nodeId), knowledge.relations(database, nodeId, knowledgeUser)]);
        const related = new Map<string, Row>();
        for (const relation of relations) for (const entity of [relation.source, relation.target]) {
          const item = arangoNodeResponse(entity, knowledgeUser);
          if (item.id !== nodeId) related.set(item.id, { node: item, relation: relation.edge.property_name || relation.edge.property_id || '关联' });
        }
        return Response.json({ node: arangoNodeResponse(node, knowledgeUser), attributes: attrs.map(arangoAttributeResponse), related: [...related.values()].slice(0, 30) });
      }
      if (!['POST', 'PUT'].includes(method)) throw new KnowledgeStoreError('不支持的操作', 405);
      let body: Row;
      try { body = await req.json(); } catch { throw new KnowledgeStoreError('无效的 JSON 请求'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new KnowledgeStoreError('无效的请求内容');
      if (action === 'discover' && !id && method === 'POST') {
        const nodeId = cleanKnowledgeId(body.nodeId);
        if (!nodeId || nodeId.length > 512) throw new KnowledgeStoreError('请选择学习主题');
        return Response.json(await discoverLearningRoute(requireStore(), database, nodeId, knowledgeUser));
      }
      if (action !== 'routes') throw new KnowledgeStoreError('不支持的操作', 405);
      if (id && sub === 'quiz' && method === 'POST') {
        const current = learningRoute(readRow()), nodeId = cleanKnowledgeId(body.nodeId);
        if (!current.nodeIds.includes(nodeId)) throw new KnowledgeStoreError('该知识不属于当前路线');
        const knowledge = requireStore(), raw = await knowledge.require(database, nodeId, knowledgeUser);
        const [attrs, relations, routeNodes] = await Promise.all([
          knowledge.attributes(database, nodeId), knowledge.relations(database, nodeId, knowledgeUser), learningNodes(knowledge, database, current.nodeIds, knowledgeUser),
        ]);
        const related = new Map<string, Row>();
        for (const relation of relations) for (const entity of [relation.source, relation.target]) {
          const node = arangoNodeResponse(entity, knowledgeUser);
          if (node.id !== nodeId) related.set(node.id, { node, relation: relation.edge.property_name || relation.edge.property_id || '关联' });
        }
        const node = arangoNodeResponse(raw, knowledgeUser);
        const pool = [...routeNodes.filter(item => !item.unavailable && item.id !== nodeId), ...[...related.values()].map(item => item.node)];
        const questions = buildLearningQuestions(node, attrs.map(arangoAttributeResponse), [...related.values()], pool);
        if (!questions.length) throw new KnowledgeStoreError('该知识资料不足，暂时无法生成练习');
        for (const [key, attempt] of attempts) if (attempt.expires < Date.now()) attempts.delete(key);
        if (attempts.size >= 500) attempts.delete(attempts.keys().next().value!);
        const attemptId = crypto.randomUUID();
        attempts.set(attemptId, { routeId: id, userId: user.id, projectId: Number(project.id), nodeId, expires: Date.now() + 30 * 60_000, questions, answered: new Set() });
        return Response.json({ attemptId, nodeId, name: node.name, questions: questions.map(({ correctOptionId, explanation, ...question }) => question),
          note: questions.length === 1 && questions[0]!.kind === 'name' ? '当前知识信息较少，本关提供基础识别练习。' : '基于知识描述、属性和关联关系出题。答错可重试，全部答对后完成本关。' });
      }
      if (id && sub === 'answer' && method === 'POST') {
        const current = learningRoute(readRow());
        const attempt = typeof body.attemptId === 'string' ? attempts.get(body.attemptId) : null;
        if (!attempt || attempt.expires < Date.now()) throw new KnowledgeStoreError('练习已过期，请重新开始本关', 410);
        if (attempt.routeId !== id || attempt.userId !== user.id || attempt.projectId !== Number(project.id)) throw new KnowledgeStoreError('练习不存在', 404);
        if (!current.nodeIds.includes(attempt.nodeId)) throw new KnowledgeStoreError('路线已调整，请返回地图', 409);
        await requireStore().require(database, attempt.nodeId, knowledgeUser);
        const question = attempt.questions.find(item => item.id === body.questionId);
        if (!question || !question.options.some((option: Row) => option.id === body.optionId)) throw new KnowledgeStoreError('题目或选项无效');
        const correct = question.correctOptionId === body.optionId;
        if (correct) attempt.answered.add(question.id);
        const finished = attempt.answered.size === attempt.questions.length;
        const updated = finished ? updateProgress(attempt.nodeId, true) : current;
        return Response.json({ correct, explanation: correct ? question.explanation : '再想一想，也可以返回节点信息查看知识依据。',
          answeredCount: attempt.answered.size, total: attempt.questions.length, finished, route: updated });
      }
      if (id && sub === 'progress' && method === 'POST') {
        const before = learningRoute(readRow()), nodeId = cleanKnowledgeId(body.nodeId);
        if (!before.nodeIds.includes(nodeId)) throw new KnowledgeStoreError('该知识不属于当前路线');
        if (body.complete !== undefined && typeof body.complete !== 'boolean') throw new KnowledgeStoreError('学习状态无效');
        if (body.complete === true) throw new KnowledgeStoreError('请完成本关练习后更新学习进度');
        await requireStore().require(database, nodeId, knowledgeUser);
        const updated = updateProgress(nodeId);
        return Response.json({ route: updated });
      }
      if (sub || (id ? method !== 'PUT' : method !== 'POST')) throw new KnowledgeStoreError('不支持的操作', 405);
      const existing = id ? readRow() : null;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 100) throw new KnowledgeStoreError('路线名称须为 1–100 个字符');
      const ids = learningNodeIds(body.nodeIds);
      const nodes = await learningNodes(requireStore(), database, ids, knowledgeUser);
      if (nodes.some(node => node.unavailable || !String(node.name || '').trim())) throw new KnowledgeStoreError('部分知识已删除、无权访问或缺少名称，请移除后保存');
      if (existing) {
        if (!Number.isSafeInteger(body.revision) || body.revision !== existing.revision) throw new KnowledgeStoreError('路线已更新，请重新打开后编辑', 409);
        const previous = learningRoute(existing), completed = previous.completedIds.filter(key => ids.includes(key));
        const current = ids.includes(previous.currentNodeId) ? previous.currentNodeId : ids.find(key => !completed.includes(key)) || '';
        const result = db.run('UPDATE learning_routes SET name=?,node_ids_json=?,completed_ids_json=?,current_node_id=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND project_id=? AND revision=?',
          [name, JSON.stringify(ids), JSON.stringify(completed), current, id, user.id, project.id, body.revision]);
        if (!result.changes) throw new KnowledgeStoreError('路线已更新，请重新打开后编辑', 409);
        return Response.json({ route: learningRoute(readRow()) });
      }
      const newId = crypto.randomUUID();
      db.run('INSERT INTO learning_routes(id,project_id,user_id,name,node_ids_json,current_node_id) VALUES(?,?,?,?,?,?)', [newId, project.id, user.id, name, JSON.stringify(ids), ids[0]!]);
      const row = db.query('SELECT * FROM learning_routes WHERE id=?').get(newId) as Row;
      return Response.json({ route: learningRoute(row) }, { status: 201 });
    } catch (error) {
      if (error instanceof KnowledgeStoreError) return Response.json({ error: error.message }, { status: error.status });
      console.error('Learning request failed', error);
      return Response.json({ error: '学习服务暂时不可用，请重试' }, { status: 503 });
    }
  };
}
