import { db, getProjectByIdentifier } from '../db.ts';
import { getKnowledgeUser, isAdmin } from '../auth-context.ts';
import { buildKnowledgeReport, mapKnowledgeReport, normalizeReportKeywords } from '../knowledge-reports.ts';
import { canAccessKnowledge } from '../knowledge-access.ts';

const json = (data: any, status = 200) => Response.json(data, { status });

function reportScope(url: URL) {
  const identifier = String(url.searchParams.get('db') || '').trim();
  const project = identifier && identifier !== 'app' ? getProjectByIdentifier(identifier) : null;
  return { projectId: project ? Number(project.id) : null, identifier };
}

function scopeSql(projectId: number | null, alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return projectId === null ? `${prefix}project_id IS NULL` : `${prefix}project_id = ?`;
}

function scopeParams(projectId: number | null) {
  return projectId === null ? [] : [projectId];
}

function canWrite(user: any, row?: any) {
  if (!user) return false;
  if (user.fullAccess || isAdmin(user)) return true;
  return !row || Number(row.owner_user_id) === Number(user.id);
}

function reportRow(id: string, projectId: number | null) {
  return db.query(`SELECT * FROM knowledge_reports WHERE id = ? AND ${scopeSql(projectId)} LIMIT 1`).get(id, ...scopeParams(projectId)) as any;
}

function persistGenerated(id: string, projectId: number | null, ownerUserId: number | null, generated: any) {
  db.run(`INSERT INTO knowledge_reports
    (id, project_id, owner_user_id, title, keywords_json, summary, sections_json, sources_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [
      id, projectId, ownerUserId, generated.title, JSON.stringify(generated.keywords), generated.summary,
      JSON.stringify(generated.sections), JSON.stringify(generated.sources),
    ]);
}

function accessibleKnowledgeIds(projectId: number | null, user: any) {
  const rows = (projectId === null
    ? db.query('SELECT id FROM nodes WHERE project_id IS NULL').all()
    : db.query('SELECT id FROM nodes WHERE project_id = ?').all(projectId)) as any[];
  return new Set(rows.filter((row) => canAccessKnowledge(db, user, row.id)).map((row) => String(row.id)));
}

export async function handleReportRoutes(req: Request, url: URL, method: string) {
  if (!url.pathname.startsWith('/api/kb/reports')) return null;
  const { projectId } = reportScope(url);
  const user = getKnowledgeUser(req);
  const suffix = url.pathname.slice('/api/kb/reports'.length).replace(/^\/+/, '');
  const parts = suffix ? suffix.split('/') : [];
  const id = decodeURIComponent(parts[0] || '');
  const action = parts[1] || '';

  if (!id && method === 'GET') {
    const rows = db.query(`SELECT * FROM knowledge_reports WHERE ${scopeSql(projectId)} ORDER BY updated_at DESC LIMIT 200`).all(...scopeParams(projectId)) as any[];
    return json({ reports: rows.map(mapKnowledgeReport) });
  }

  if (!id && method === 'POST') {
    if (!canWrite(user)) return json({ error: '请登录后创建报告' }, 401);
    const body = await req.json().catch(() => null) as any;
    const title = String(body?.title || '').trim();
    const keywords = normalizeReportKeywords(body?.keywords);
    if (!title) return json({ error: '请填写报告标题' }, 400);
    if (!keywords.length) return json({ error: '请至少添加一个关键词' }, 400);
    const generated = buildKnowledgeReport(db, projectId, title, keywords, accessibleKnowledgeIds(projectId, user));
    const reportId = `report_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    persistGenerated(reportId, projectId, Number(user?.id) || null, generated);
    return json({ report: mapKnowledgeReport(reportRow(reportId, projectId)) }, 201);
  }

  const row = id ? reportRow(id, projectId) : null;
  if (!row) return json({ error: '报告不存在' }, 404);

  if (method === 'GET' && !action) return json({ report: mapKnowledgeReport(row) });

  if (method === 'POST' && action === 'regenerate') {
    if (!canWrite(user, row)) return json({ error: '无权重新生成该报告' }, 403);
    const body = await req.json().catch(() => ({})) as any;
    const title = String(body?.title || row.title || '').trim();
    const keywords = normalizeReportKeywords(body?.keywords ?? JSON.parse(row.keywords_json || '[]'));
    const generated = buildKnowledgeReport(db, projectId, title, keywords, accessibleKnowledgeIds(projectId, user));
    db.run(`UPDATE knowledge_reports SET title = ?, keywords_json = ?, summary = ?, sections_json = ?, sources_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND ${scopeSql(projectId)}`,
      [generated.title, JSON.stringify(generated.keywords), generated.summary, JSON.stringify(generated.sections), JSON.stringify(generated.sources), id, ...scopeParams(projectId)]);
    return json({ report: mapKnowledgeReport(reportRow(id, projectId)) });
  }

  if ((method === 'PUT' || method === 'PATCH') && !action) {
    if (!canWrite(user, row)) return json({ error: '无权编辑该报告' }, 403);
    const body = await req.json().catch(() => null) as any;
    if (!body) return json({ error: '请求内容无效' }, 400);
    const title = String(body.title ?? row.title).trim();
    const keywords = normalizeReportKeywords(body.keywords ?? JSON.parse(row.keywords_json || '[]'));
    const summary = String(body.summary ?? row.summary).trim();
    const sections = Array.isArray(body.sections) ? body.sections : JSON.parse(row.sections_json || '[]');
    if (!title) return json({ error: '报告标题不能为空' }, 400);
    db.run(`UPDATE knowledge_reports SET title = ?, keywords_json = ?, summary = ?, sections_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND ${scopeSql(projectId)}`,
      [title, JSON.stringify(keywords), summary, JSON.stringify(sections), id, ...scopeParams(projectId)]);
    return json({ report: mapKnowledgeReport(reportRow(id, projectId)) });
  }

  if (method === 'DELETE' && !action) {
    if (!canWrite(user, row)) return json({ error: '无权删除该报告' }, 403);
    db.run(`DELETE FROM knowledge_reports WHERE id = ? AND ${scopeSql(projectId)}`, [id, ...scopeParams(projectId)]);
    return json({ ok: true });
  }

  return json({ error: '不支持的报告操作' }, 405);
}
