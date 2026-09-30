import type { Database } from 'bun:sqlite';
import { accessCondition } from './knowledge-access.ts';

const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, { ...init, headers: { 'Cache-Control': 'no-store' } });

export function createUserProfileHandler(db: Database, getUser: (req: Request) => any) {
  const hasTable = (name: string) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
  const tableColumns = (name: string) => new Set(hasTable(name) ? (db.query(`PRAGMA table_info(${name})`).all() as any[]).map((column) => String(column.name || '')) : []);
  const projectColumns = new Set((db.query("PRAGMA table_info(projects)").all() as any[]).map((column) => String(column.name || '')));
  const projectImageSelect = projectColumns.has('image') ? 'p.image' : "'' AS image";
  const projectThemeSelect = projectColumns.has('theme_color') ? 'p.theme_color' : "'' AS theme_color";
  return async (req: Request, url: URL, method: string): Promise<Response | null> => {
    if (url.pathname !== '/api/account/profile') return null;
    if (method !== 'GET') return json({ error: '不支持的操作' }, { status: 405 });
    const user = getUser(req);
    if (!user || user.status === 'disabled') return json({ error: '请先登录' }, { status: 401 });
    const section = url.searchParams.get('section') || 'summary';
    if (!['summary', 'applications', 'knowledge', 'likes', 'favorites', 'comments'].includes(section)) return json({ error: '未知的记录类型' }, { status: 400 });
    const requestedPage = Number(url.searchParams.get('page') || 1);
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) return json({ error: '页码无效' }, { status: 400 });
    const appWhere = "p.name <> 'shared' AND (p.owner_user_id=? OR EXISTS (SELECT 1 FROM application_members m WHERE m.project_id=p.id AND m.user_id=?))";
    const nodeWhere = `(n.owner_user_id=? OR EXISTS (SELECT 1 FROM knowledge_maintainers m WHERE m.node_id=n.id AND m.user_id=?)) AND ${accessCondition(user, 'n')}`;
    const count = (sql: string, params: number[]) => Number((db.query(sql).get(...params) as any)?.total || 0);
    const relatedParams = [user.id, user.id];
    if (section === 'summary') {
      const basic = db.query('SELECT id,username,display_name,avatar,email,phone,status,created_at,last_login_at FROM users WHERE id=?').get(user.id) as any;
      if (!basic) return json({ error: '账号不存在' }, { status: 401 });
      const allPermissions = db.query('SELECT code,name,module FROM permissions ORDER BY module,code').all() as any[];
      const unrestricted = user.role === 'admin' || user.permissions?.includes('*');
      const activityYear = new Date().getFullYear();
      const activityCounts = new Map<string, number>();
      const addActivity = (value: unknown) => {
        const date = String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '';
        if (!date || !date.startsWith(`${activityYear}-`)) return;
        activityCounts.set(date, (activityCounts.get(date) || 0) + 1);
      };
      if (projectColumns.has('created_at')) {
        (db.query('SELECT created_at FROM projects WHERE owner_user_id=?').all(user.id) as any[]).forEach((row) => addActivity(row.created_at));
      }
      const nodeColumns = tableColumns('nodes');
      if (nodeColumns.has('updated_at')) {
        (db.query(`SELECT n.updated_at FROM nodes n WHERE ${nodeWhere}`).all(...relatedParams) as any[]).forEach((row) => addActivity(row.updated_at));
      }
      for (const table of ['knowledge_likes', 'knowledge_favorites', 'knowledge_comments']) {
        const columns = tableColumns(table);
        if (!columns.has('user_id') || !columns.has('created_at')) continue;
        (db.query(`SELECT created_at FROM ${table} WHERE user_id=?`).all(user.id) as any[]).forEach((row) => addActivity(row.created_at));
      }
      const activityDays = [...activityCounts].sort(([left], [right]) => left.localeCompare(right)).map(([date, count]) => ({ date, count }));
      return json({
        user: { id: basic.id, username: basic.username, displayName: basic.display_name || basic.username, avatar: basic.avatar || '', email: basic.email || '', phone: basic.phone || '', status: basic.status || 'active', createdAt: basic.created_at, lastLoginAt: basic.last_login_at, role: user.role, dataScope: user.dataScope || 'own' },
        roles: (user.roles || []).map((role: any) => ({ code: role.code, name: role.name, dataScope: role.data_scope })),
        permissions: allPermissions.filter((permission) => unrestricted || user.permissions?.includes(permission.code)),
        unrestricted,
        counts: {
          applications: count(`SELECT COUNT(*) AS total FROM projects p WHERE ${appWhere}`, relatedParams),
          knowledge: count(`SELECT COUNT(*) AS total FROM nodes n WHERE ${nodeWhere}`, relatedParams),
          likes: count('SELECT COUNT(*) AS total FROM knowledge_likes WHERE user_id=?', [user.id]),
          favorites: count('SELECT COUNT(*) AS total FROM knowledge_favorites WHERE user_id=?', [user.id]),
          comments: count('SELECT COUNT(*) AS total FROM knowledge_comments WHERE user_id=?', [user.id]),
        },
        activity: { year: activityYear, total: activityDays.reduce((sum, item) => sum + item.count, 0), days: activityDays },
      });
    }
    let total: number, query: string, params: number[];
    if (section === 'applications') {
      total = count(`SELECT COUNT(*) AS total FROM projects p WHERE ${appWhere}`, relatedParams);
      query = `SELECT p.id,p.name AS slug,p.title,p.description,${projectImageSelect},${projectThemeSelect},p.created_at,CASE WHEN p.owner_user_id=? THEN 'owner' ELSE 'maintainer' END AS relationship FROM projects p WHERE ${appWhere} ORDER BY p.created_at DESC,p.id DESC`;
      params = [user.id, ...relatedParams];
    } else if (section === 'knowledge') {
      total = count(`SELECT COUNT(*) AS total FROM nodes n WHERE ${nodeWhere}`, relatedParams);
      query = `SELECT n.id,n.name,n.type,n.visibility,n.updated_at,p.name AS project_slug,p.title AS project_title,CASE WHEN n.owner_user_id=? THEN 'owner' ELSE 'maintainer' END AS relationship FROM nodes n LEFT JOIN projects p ON p.id=n.project_id WHERE ${nodeWhere} ORDER BY n.updated_at DESC,n.id DESC`;
      params = [user.id, ...relatedParams];
    } else {
      const table = { likes: 'knowledge_likes', favorites: 'knowledge_favorites', comments: 'knowledge_comments' }[section as 'likes' | 'favorites' | 'comments'];
      total = count(`SELECT COUNT(*) AS total FROM ${table} WHERE user_id=?`, [user.id]);
      const comment = section === 'comments';
      query = `SELECT ${comment ? "h.id AS record_id,CASE WHEN n.id IS NOT NULL THEN h.content ELSE NULL END AS content," : ''} h.created_at,n.id,n.name,n.type,p.name AS project_slug,p.title AS project_title FROM ${table} h LEFT JOIN nodes n ON n.id=CASE WHEN h.knowledge_id LIKE 'entity/%' THEN substr(h.knowledge_id,8) ELSE h.knowledge_id END AND ${accessCondition(user, 'n')} LEFT JOIN projects p ON p.id=n.project_id WHERE h.user_id=? ORDER BY h.created_at DESC,${comment ? 'h.id' : 'h.knowledge_id'} DESC`;
      params = [user.id];
    }
    const pageSize = 20, page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));
    const items = db.query(`${query} LIMIT ? OFFSET ?`).all(...params, pageSize, (page - 1) * pageSize);
    return json({ section, items, total, page, pageSize });
  };
}
