import { randomUUID } from 'node:crypto';
import { normalizeReportKeywords } from './knowledge-reports.ts';
import { arangoNodeResponse, canUseArangoKnowledge, knowledgeReadAccess, KnowledgeStoreError } from './enterprise-knowledge.ts';
import type { EnterpriseKnowledgeStore, ImportSchema } from './enterprise-knowledge.ts';
import type { KnowledgeUser } from './knowledge-access.ts';
import { hiddenKnowledgeTypes } from './ontology-filter.ts';

type Doc = Record<string, any>;
const identity = (node: Doc) => String(node.sqlite_id || node.id || '').replace(/^entity\//, '');
const compact = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 500);
const attributeText = (value: any): string => {
  if (Array.isArray(value)) return value.map(attributeText).join('、');
  if (value && typeof value === 'object') return String(value.label_zh || value.label || value.name || value.time || value.amount || value.id || JSON.stringify(value));
  return String(value ?? '');
};
const distribution = (values: string[]) => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'zh-CN'));
};

export async function buildEnterpriseReport(store: EnterpriseKnowledgeStore, database: string, title: string, input: unknown,
  user: KnowledgeUser | null, legacySchema?: () => Partial<ImportSchema> | undefined) {
  const keywords = normalizeReportKeywords(input);
  const terms = [...new Set(keywords.map(term => term.trim().toLowerCase()).filter(Boolean))];
  const schema = await store.importSchema(database) || legacySchema?.();
  const access = knowledgeReadAccess(user);
  const matches = await store.query(database, `FOR term IN @terms
    LET matches = (FOR doc IN entity FILTER ${access.filter} AND doc.type NOT IN @excluded
      LET names = (FOR item IN VALUES(NOT_NULL(doc.labels, {})) RETURN LOWER(TO_STRING(item.value)))
      LET aliases = (FOR item IN FLATTEN(VALUES(NOT_NULL(doc.aliases, {}))) RETURN LOWER(TO_STRING(item.value)))
      LET descriptions = (FOR item IN VALUES(NOT_NULL(doc.descriptions, {})) RETURN LOWER(TO_STRING(item.value)))
      LET score = (term IN names ? 100 : LENGTH(FOR name IN names FILTER CONTAINS(name, term) RETURN 1) > 0 ? 50 : 0)
        + (term IN aliases ? 80 : LENGTH(FOR name IN aliases FILTER CONTAINS(name, term) RETURN 1) > 0 ? 30 : 0)
        + (LENGTH(FOR text IN descriptions FILTER CONTAINS(text, term) RETURN 1) > 0 ? 5 : 0)
      FILTER score > 0 SORT score DESC, doc._key ASC LIMIT 3 RETURN { node: doc, score })
    RETURN { term, matches }`, { ...access.bindVars, terms, excluded: hiddenKnowledgeTypes(schema?.ontologies) });
  const mains = new Map<string, Doc>();
  const unmatched: string[] = [];
  let mainLimitReached = false;
  for (const result of matches) {
    const best = result.matches?.find((item: Doc) => canUseArangoKnowledge(item.node, user));
    if (!best) { if (keywords.some(term => term.toLowerCase() === result.term)) unmatched.push(result.term); continue; }
    const id = identity(best.node);
    if (mains.has(id)) mains.get(id)!.matchedKeywords.push(result.term);
    else if (mains.size < 8) mains.set(id, { node: best.node, matchedKeywords: [result.term], score: best.score });
    else mainLimitReached = true;
  }
  const format = (node: Doc): Doc => {
    const value = arangoNodeResponse(node, user);
    const type = schema?.ontologies?.find(row => row.id === node.type);
    return { ...value, typeLabel: type?.name || value.typeLabel || '未分类', color: type?.color || '#64748b' };
  };
  const vertices = new Map<string, Doc>([...mains].map(([id, item]) => [id, item.node]));
  const edges = new Map<string, Doc>();
  const contexts = new Map<string, { paths: Doc[]; attributes: Doc[] }>();
  let truncated = mainLimitReached;
  for (const [id] of mains) {
    const [graph, attributes] = await Promise.all([store.relationPaths(database, id, user, 160), store.attributes(database, id)]);
    truncated ||= graph.truncated;
    const accepted: Doc[] = [];
    for (const path of graph.paths) {
      if (!path.vertices?.every((node: Doc) => canUseArangoKnowledge(node, user))) continue;
      const additions = path.vertices.filter((node: Doc) => !vertices.has(identity(node)));
      const edgeAdditions = path.edges.filter((edge: Doc) => !edges.has(edge._key));
      if (vertices.size + additions.length > 120 || edges.size + edgeAdditions.length > 240) { truncated = true; continue; }
      for (const node of path.vertices) vertices.set(identity(node), node);
      for (const edge of path.edges) edges.set(edge._key, edge);
      accepted.push(path);
    }
    contexts.set(id, { paths: accepted, attributes });
  }
  const item = (node: Doc, related = false, relation = '') => {
    const value = format(node);
    return { id: value.id, name: value.name, typeLabel: value.typeLabel, description: compact(value.description || node.wiki_md) || '暂无内容摘要。',
      image: value.images?.[0] || '', link: value.link || '', tags: value.tags || [], related, relation };
  };
  // Only include reference-valued attributes whose targets are already part of
  // the authorized report graph. Snapshot access checks cover these sources too.
  for (const context of contexts.values()) context.attributes = context.attributes.flatMap(attribute => {
    let value: any = attribute.value;
    try { value = JSON.parse(value); } catch {}
    let datatype = attribute.datatype;
    try { datatype = JSON.parse(attribute.statement_json || '{}').datatype || datatype; } catch {}
    if (['wikibase-item', 'wikibase-entityid'].includes(datatype)) {
      const values = (Array.isArray(value) ? value : [value]).filter(item => item?.id && vertices.has(String(item.id).replace(/^entity\//, '')));
      if (!values.length) return [];
      value = values;
    }
    return [{ ...attribute, value: compact(attributeText(value)) }];
  });
  const sections = [...mains].map(([id, main]) => {
    const context = contexts.get(id)!;
    const related = new Map<string, Doc>();
    for (const path of context.paths) {
      const target = path.vertices[path.vertices.length - 1], targetId = identity(target);
      if (targetId === id || related.has(targetId)) continue;
      let evidence = String(format(path.vertices[0]).name);
      path.edges.forEach((edge: Doc, index: number) => {
        const name = edge.property_name || edge.property_id || '关联', next = format(path.vertices[index + 1]).name;
        evidence += edge._from === path.vertices[index]._id ? ` — ${name} → ${next}` : ` ← ${name} — ${next}`;
      });
      related.set(targetId, item(target, true, compact(evidence)));
    }
    return { keyword: id, title: format(main.node).name, introduction: `匹配关键词：${main.matchedKeywords.join('、')}。${compact(format(main.node).description)}`,
      items: [item(main.node), ...[...related.values()].slice(0, 12)],
      attributes: context.attributes.slice(0, 30).map(attribute => ({ name: attribute.property_name_snapshot || attribute.key,
        value: compact(attribute.value), datatype: attribute.datatype })), attributeCount: context.attributes.length };
  });
  const formatted = [...vertices.values()].map(format);
  const relationEdges = [...edges.values()];
  const handles = new Map([...vertices.values()].map(node => [node._id, identity(node)]));
  const graph = { nodes: formatted.map(value => ({ data: { id: value.id, label: value.name, name: value.name, type: value.typeLabel,
    color: value.color, isMain: mains.has(value.id) ? 1 : 0 } })),
    edges: relationEdges.map(edge => ({ data: { id: edge._key, source: String(edge.source_id || handles.get(edge._from)).replace(/^entity\//, ''),
      target: String(edge.target_id || handles.get(edge._to)).replace(/^entity\//, ''), label: edge.property_name || edge.property_id || '关联' } })) };
  const degrees = [...mains].map(([id, main]) => ({ label: format(main.node).name,
    value: new Set(graph.edges.filter(edge => edge.data.source === id || edge.data.target === id)
      .map(edge => edge.data.source === id ? edge.data.target : edge.data.source)).size }));
  const attributeCount = [...contexts.values()].reduce((sum, context) => sum + context.attributes.length, 0);
  return { title, keywords, summary: mains.size ? `围绕${keywords.map(value => `“${value}”`).join('、')}匹配 ${mains.size} 个主实体，整理 ${vertices.size} 个实体、${edges.size} 条关系和 ${attributeCount} 项主实体属性。${truncated ? '关联较多，报告展示部分分析结果。' : ''}`
    : '未找到与关键词匹配且可访问的主实体，请尝试更准确的名称或别名。',
    sections, sources: formatted.map(value => ({ id: value.id, name: value.name, link: value.link || '' })), graph,
    mainEntities: [...mains].map(([id, main]) => ({ id, name: format(main.node).name, matchedKeywords: main.matchedKeywords })), unmatchedKeywords: unmatched,
    statistics: { mainEntityCount: mains.size, entityCount: vertices.size, relationCount: edges.size, attributeCount,
      entityTypes: distribution(formatted.map(value => value.typeLabel)), relationTypes: distribution(relationEdges.map(edge => edge.property_name || edge.property_id || '关联')),
      mainConnections: degrees, scope: '报告所展示的实体与关系', truncated },
    analysis: { source: 'arangodb', maxDepth: 2, truncated, maxMainEntities: 8, generatedAt: new Date().toISOString() } };
}

export async function handleEnterpriseReports(req: Request, url: URL, method: string, deps: {
  store: EnterpriseKnowledgeStore; project: Doc; user: KnowledgeUser | null; canCreate: boolean; legacySchema?: () => Partial<ImportSchema> | undefined;
}) {
  const { store, project, user } = deps, database = String(project.name);
  const parts = url.pathname.slice('/api/kb/reports'.length).split('/').filter(Boolean);
  if (parts.length > 2) throw new KnowledgeStoreError('报告接口不存在', 404);
  const id = parts[0] ? decodeURIComponent(parts[0]) : '', action = parts[1] || '';
  const write = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (write && !user) throw new KnowledgeStoreError('请先登录', 401);
  if (write && !deps.canCreate) throw new KnowledgeStoreError('需要应用成员权限', 403);
  await store.ensure(database);
  try { await store.client.database(database, '/_api/collection/knowledge_reports'); }
  catch (error: any) {
    if (error.status !== 404 || error.body?.errorNum !== 1203) throw error;
    if (!write) return id ? Response.json({ error: '报告不存在' }, { status: 404 }) : Response.json({ reports: [] });
    await store.client.database(database, '/_api/collection', { method: 'POST', body: JSON.stringify({ name: 'knowledge_reports', type: 2 }) })
      .catch((error: any) => { if (error.status !== 409) throw error; });
  }
  const canEdit = (report: Doc) => user?.fullAccess || user?.role === 'admin' || report.ownerUserId === user?.id;
  const readable = async (report: Doc, visibleIds?: Set<string>) => {
    if (!report.sources?.length) return canEdit(report);
    const ids = report.sources.map((source: Doc) => source.id);
    if (visibleIds) return ids.every((id: string) => visibleIds.has(id));
    const access = knowledgeReadAccess(user);
    const allowed = await store.query(database, `FOR doc IN entity FILTER doc.sqlite_id IN @ids AND ${access.filter} RETURN { id: doc.sqlite_id }`, { ...access.bindVars, ids });
    const found = new Set(allowed.map(row => row.id));
    return ids.every((id: string) => found.has(id));
  };
  const responseReport = (report: Doc) => { const { _id, _key, _rev, ...result } = report; return result; };
  if (!id && method === 'GET') {
    const reports = await store.query(database, `FOR report IN knowledge_reports SORT report.updatedAt DESC LIMIT 200
      RETURN KEEP(report, ['id', 'title', 'keywords', 'summary', 'ownerUserId', 'createdAt', 'updatedAt', 'sources'])`);
    const ids = [...new Set(reports.flatMap(report => (report.sources || []).map((source: Doc) => source.id)))];
    const access = knowledgeReadAccess(user);
    const allowed = ids.length ? await store.query(database, `FOR doc IN entity FILTER doc.sqlite_id IN @ids AND ${access.filter} RETURN { id: doc.sqlite_id }`, { ...access.bindVars, ids }) : [];
    const visibleIds = new Set<string>(allowed.map(row => row.id));
    const visible = [];
    for (const report of reports) if (await readable(report, visibleIds)) {
      const { sources, ...metadata } = responseReport(report); visible.push(metadata);
    }
    return Response.json({ reports: visible });
  }
  let previous: Doc | null = null;
  if (id) {
    try { previous = (await store.client.database(database, `/_api/document/knowledge_reports/${encodeURIComponent(id)}`)).body; }
    catch (error: any) { if (error.status !== 404) throw error; }
    if (!previous) throw new KnowledgeStoreError('报告不存在', 404);
    if (write && !canEdit(previous)) throw new KnowledgeStoreError('无权修改该报告', 403);
    if (!write && !await readable(previous)) throw new KnowledgeStoreError('报告不存在或无权访问', 404);
  }
  if (id && method === 'GET' && !action) return Response.json({ report: responseReport(previous!) });
  if (id && method === 'DELETE' && !action) {
    await store.client.database(database, `/_api/document/knowledge_reports/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return Response.json({ ok: true });
  }
  if ((method === 'POST' && (!id || action === 'regenerate')) || (id && ['PUT', 'PATCH'].includes(method) && !action)) {
    let body: Doc;
    try { body = await req.json(); } catch { throw new KnowledgeStoreError('请求内容无效'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new KnowledgeStoreError('请求必须是 JSON 对象');
    const title = String(body.title ?? previous?.title ?? '').trim(), keywords = normalizeReportKeywords(body.keywords ?? previous?.keywords);
    if (!title || !keywords.length) throw new KnowledgeStoreError('请填写标题和至少一个关键词');
    const generated = method === 'POST' ? await buildEnterpriseReport(store, database, title, keywords, user, deps.legacySchema)
      : { ...responseReport(previous!), title, keywords, summary: String(body.summary ?? previous!.summary),
        sections: Array.isArray(body.sections) ? body.sections : previous!.sections };
    const now = new Date().toISOString(), reportId = previous?.id || `report_${randomUUID()}`;
    const report = { ...generated, id: reportId, _key: reportId, project_id: Number(project.id), ownerUserId: previous?.ownerUserId || user!.id,
      createdAt: previous?.createdAt || now, updatedAt: now };
    await store.client.database(database, '/_api/document/knowledge_reports?overwriteMode=replace', { method: 'POST', body: JSON.stringify(report) });
    return Response.json({ report: responseReport(report) }, { status: previous ? 200 : 201 });
  }
  throw new KnowledgeStoreError('不支持的报告操作', 405);
}
