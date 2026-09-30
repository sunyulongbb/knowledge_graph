import { adminDb } from "../db.ts";
import { audit, getCurrentUser, hasPermission, isAdmin } from "../auth-context.ts";

const json = (body: any, status = 200) => Response.json(body, { status });
const page = (url: URL) => Math.max(1, Number(url.searchParams.get("page") || 1));
const size = (url: URL) => Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 20)));
function requirePermission(req: Request, code: string) { const user = getCurrentUser(req); return hasPermission(user, code) ? user : null; }
function paged(sql: string, countSql: string, params: any[], url: URL) { const take = size(url), skip = (page(url) - 1) * take; const total = Number((adminDb.query(countSql).get(...params) as any)?.count || 0); return { items: adminDb.query(`${sql} LIMIT ? OFFSET ?`).all(...params, take, skip), total, page: page(url), pageSize: take }; }

export async function handleSystemAdminRoutes(req: Request, url: URL, method: string) {
  const user = getCurrentUser(req);
  if (!url.pathname.startsWith("/api/system/")) return null;
  if (!user) return json({ error: "请先登录" }, 401);

  if (url.pathname === "/api/system/access" && method === "GET") return json({ user, roles: user.roles || [], permissions: user.permissions || [], menus: isAdmin(user) ? ["entry","table","vis","attr","clean","chat","report","users","roles","permissions","login_logs","operation_logs"] : ["table","vis"] });
  if (url.pathname === "/api/system/users" && method === "GET") {
    if (!requirePermission(req, "user:view")) return json({ error: "无权访问" }, 403);
    const q = String(url.searchParams.get("q") || "").trim(); const status = String(url.searchParams.get("status") || "").trim();
    const where: string[] = [], params: any[] = [];
    if (q) { where.push("(u.username LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    if (status) { where.push("u.status = ?"); params.push(status); }
    const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    return json(paged(`SELECT u.id,u.username,u.display_name AS nickname,u.avatar,u.email,u.phone,u.role,u.status,u.last_login_at,u.created_at, GROUP_CONCAT(r.name, ', ') AS roles FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id${clause} GROUP BY u.id ORDER BY u.id DESC`, `SELECT COUNT(*) AS count FROM users u${clause}`, params, url));
  }
  if (url.pathname === "/api/system/roles" && method === "GET") {
    if (!requirePermission(req, "role:view")) return json({ error: "无权访问" }, 403);
    return json(paged("SELECT r.*, COUNT(DISTINCT ur.user_id) AS user_count, (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id=r.id) AS permission_count, (SELECT GROUP_CONCAT(p.code, ',') FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=r.id) AS permission_codes FROM roles r LEFT JOIN user_roles ur ON ur.role_id=r.id GROUP BY r.id ORDER BY r.id DESC", "SELECT COUNT(*) AS count FROM roles", [], url));
  }
  if (url.pathname === "/api/system/permissions" && method === "GET") {
    if (!requirePermission(req, "permission:view")) return json({ error: "无权访问" }, 403);
    return json({ items: adminDb.query("SELECT * FROM permissions ORDER BY module, code").all() });
  }
  if (url.pathname === "/api/system/menus" && method === "GET") {
    if (!isAdmin(user)) return json({ error: "无权访问" }, 403);
    return json({ items: adminDb.query("SELECT * FROM menus WHERE status = 'active' ORDER BY sort_order, id").all() });
  }
  if (url.pathname === "/api/system/login-logs" && method === "GET") {
    if (!requirePermission(req, "system:log")) return json({ error: "无权访问" }, 403);
    return json(paged("SELECT * FROM login_logs ORDER BY id DESC", "SELECT COUNT(*) AS count FROM login_logs", [], url));
  }
  if (url.pathname === "/api/system/operation-logs" && method === "GET") {
    if (!requirePermission(req, "system:log")) return json({ error: "无权访问" }, 403);
    return json(paged("SELECT * FROM operation_logs ORDER BY id DESC", "SELECT COUNT(*) AS count FROM operation_logs", [], url));
  }
  if (url.pathname === "/api/system/roles" && method === "POST") {
    if (!requirePermission(req, "role:create")) return json({ error: "无权访问" }, 403);
    const body: any = await req.json(); const code = String(body.code || "").trim(); const name = String(body.name || "").trim();
    if (!code || !name) return json({ error: "角色编码和名称不能为空" }, 400);
    adminDb.run("INSERT INTO roles (code,name,status,data_scope) VALUES (?,?,?,?)", [code, name, body.status === "disabled" ? "disabled" : "active", body.dataScope === "own" ? "own" : "all"]);
    const created = adminDb.query("SELECT id FROM roles WHERE code=?").get(code) as any;
    audit(req, user, "role", "create", code); return json({ success: true, id: created?.id }, 201);
  }
  const roleMatch = url.pathname.match(/^\/api\/system\/roles\/(\d+)$/);
  if (roleMatch && method === "PATCH") {
    if (!requirePermission(req, "role:update")) return json({ error: "无权访问" }, 403);
    const body: any = await req.json(); const id = Number(roleMatch[1]);
    adminDb.run("UPDATE roles SET name=?, status=?, data_scope=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND code <> 'super_admin'", [String(body.name || "").trim(), body.status === "disabled" ? "disabled" : "active", body.dataScope === "own" ? "own" : "all", id]);
    audit(req, user, "role", "update", String(id)); return json({ success: true });
  }
  const rolePermissions = url.pathname.match(/^\/api\/system\/roles\/(\d+)\/permissions$/);
  if (rolePermissions && method === "PUT") {
    if (!requirePermission(req, "role:update")) return json({ error: "无权访问" }, 403);
    const body: any = await req.json(); const roleId = Number(rolePermissions[1]); const codes = Array.isArray(body.permissions) ? body.permissions : [];
    adminDb.run("DELETE FROM role_permissions WHERE role_id=?", [roleId]);
    codes.forEach((code: string) => adminDb.run("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT ?,id FROM permissions WHERE code=?", [roleId, code]));
    audit(req, user, "role", "grant_permissions", String(roleId)); return json({ success: true });
  }
  return json({ error: "未找到接口" }, 404);
}
