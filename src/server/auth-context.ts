import { adminDb } from "./db.ts";

function sessionToken(req: Request) {
  return (req.headers.get("cookie") || "").match(/kb_session=([^;\s]+)/)?.[1] || "";
}

export function getCurrentUser(req: Request): any | null {
  const token = sessionToken(req);
  if (!token) return null;
  const session = adminDb.query("SELECT user_id, username, expires_at FROM sessions WHERE token = ? OR id = ?").get(token, token) as any;
  if (!session || (session.expires_at && new Date(session.expires_at).getTime() < Date.now())) return null;
  const user = adminDb.query("SELECT id, username, display_name, avatar, role, status, is_admin, created_at FROM users WHERE id = ? OR username = ? LIMIT 1").get(session.user_id || -1, session.username) as any;
  if (!user || user.status === "disabled") return null;
  const roles = adminDb.query("SELECT r.id, r.code, r.name, r.data_scope FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ? AND r.status = 'active'").all(user.id) as any[];
  const isSuper = roles.some((role) => role.code === "super_admin") || user.role === "admin" || user.is_admin;
  const permissions = isSuper ? ["*"] : (adminDb.query("SELECT DISTINCT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id = p.id JOIN user_roles ur ON ur.role_id = rp.role_id WHERE ur.user_id = ?").all(user.id) as any[]).map((row) => row.code);
  return { id: user.id, username: user.username, displayName: user.display_name || user.username, avatar: user.avatar || "", role: isSuper ? "admin" : "user", roles, permissions, dataScope: isSuper ? "all" : (roles.some((role) => role.data_scope === "all") ? "all" : "own"), status: user.status || "active", createdAt: user.created_at };
}

export function isAdmin(user: any) {
  return user?.role === "admin";
}

export function hasPermission(user: any, permission: string) {
  return !!user && (isAdmin(user) || user.permissions?.includes("*") || user.permissions?.includes(permission));
}

export function audit(req: Request, user: any, module: string, action: string, target = "", success = true) {
  try { adminDb.run("INSERT INTO operation_logs (user_id, username, module, action, target, path, success) VALUES (?, ?, ?, ?, ?, ?, ?)", [user?.id || null, user?.username || "", module, action, target, new URL(req.url).pathname, success ? 1 : 0]); } catch {}
}
