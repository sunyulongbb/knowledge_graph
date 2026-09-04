import { adminDb, hashPassword } from "../db.ts";
import { getCurrentUser, isAdmin } from "../auth-context.ts";

function getSessionToken(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  return cookie.match(/kb_session=([^;\s]+)/)?.[1] || null;
}

export async function handleAuthRoutes(req: Request, url: URL, method: string) {
  if (url.pathname === "/api/auth/register" && method === "POST") {
    try {
      const body: any = await req.json();
      const username = (body.username || "").toString().trim().toLowerCase();
      const password = (body.password || "").toString();
      const displayName = (body.displayName || username).toString().trim();
      const avatar = (body.avatar || "").toString().trim();

      if (!username || !password) {
        return Response.json(
          { success: false, message: "用户名或密码不能为空" },
          { status: 400 }
        );
      }
      if (!/^[\w\-\.@]+$/.test(username)) {
        return Response.json(
          { success: false, message: "用户名含有不支持的字符" },
          { status: 400 }
        );
      }

      try {
        const ex = adminDb.query("SELECT 1 FROM users WHERE username = ?").get(username);
        if (ex) {
          return Response.json(
            { success: false, message: "用户名已存在" },
            { status: 409 }
          );
        }
      } catch {}

      const ph = await hashPassword(password);
      const userCount = Number((adminDb.query("SELECT COUNT(*) AS count FROM users").get() as any)?.count || 0);
      const role = userCount === 0 ? "admin" : "user";
      adminDb.run(
        "INSERT INTO users (username, display_name, password_hash, password_salt, avatar, role, status, is_admin) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)",
        [username, displayName || username, ph.hash || "", ph.salt || "", avatar || "", role, role === "admin" ? 1 : 0]
      );
      const created = adminDb.query("SELECT id FROM users WHERE username = ?").get(username) as any;
      const assignedRole = adminDb.query("SELECT id FROM roles WHERE code = ?").get(role === "admin" ? "super_admin" : "user") as any;
      if (created && assignedRole) adminDb.run("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)", [created.id, assignedRole.id]);
      const user = adminDb
        .query(
          "SELECT username, display_name, avatar, panel_state, created_at FROM users WHERE username = ?"
        )
        .get(username);
      return Response.json({ success: true, user });
    } catch {
      return Response.json(
        { success: false, message: "无效的请求体" },
        { status: 400 }
      );
    }
  }

  if ((url.pathname === "/api/auth/login" || url.pathname === "/api/login") && method === "POST") {
    try {
      const body: any = await req.json();
      const username = (body.username || "").toString().trim().toLowerCase();
      const password = (body.password || "").toString();

      if (!username || !password) {
        return Response.json(
          { success: false, message: "用户名或密码不能为空" },
          { status: 400 }
        );
      }

      const u = adminDb
        .query(
          "SELECT username, display_name, password_hash, password_salt, avatar, panel_state, role, status, is_admin FROM users WHERE username = ?"
        )
        .get(username);
      if (!u) {
        return Response.json(
          { success: false, message: "用户不存在或密码错误" },
          { status: 401 }
        );
      }
      if (u.status === "disabled") return Response.json({ success: false, message: "账号已停用" }, { status: 403 });

      const ph = await hashPassword(password, u.password_salt || "");
      if (!ph.hash || ph.hash !== (u.password_hash || "")) {
        return Response.json(
          { success: false, message: "用户不存在或密码错误" },
          { status: 401 }
        );
      }

      const token = crypto.randomUUID();
      const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const userRow = adminDb
        .query("SELECT id FROM users WHERE username = ?")
        .get(username) as any;
      adminDb.run(
        "INSERT OR REPLACE INTO sessions (id, token, username, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)",
        [token, token, username, userRow?.id || null, expires]
      );
      adminDb.run("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [userRow?.id || 0]);
      try { adminDb.run("INSERT INTO login_logs (user_id, username, ip, user_agent, success) VALUES (?, ?, ?, ?, 1)", [userRow?.id || null, username, req.headers.get("x-forwarded-for") || "", req.headers.get("user-agent") || ""]); } catch {}

      let loginPanelState = null;
      try {
        loginPanelState = u.panel_state ? JSON.parse(u.panel_state) : null;
      } catch {
        loginPanelState = null;
      }
      return new Response(
        JSON.stringify({
          success: true,
          user: {
            username: u.username,
            displayName: u.display_name,
            avatar: u.avatar,
            panelState: loginPanelState,
            role: u.role === "admin" || u.is_admin ? "admin" : "user",
            permissions: u.role === "admin" || u.is_admin ? ["*"] : [],
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": `kb_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`,
          },
        }
      );
    } catch {
      return Response.json({ success: false, message: "登录失败" }, { status: 400 });
    }
  }

  if ((url.pathname === "/api/auth/whoami" || url.pathname === "/api/me") && method === "GET") {
    try {
      const token = getSessionToken(req);
      if (!token) return Response.json({ user: null });

      const s = adminDb.query("SELECT username FROM sessions WHERE token = ? OR id = ?").get(token, token);
      if (!s) return Response.json({ user: null });

      const u = adminDb
        .query("SELECT username, display_name, avatar, panel_state, role, status, is_admin FROM users WHERE username = ?")
        .get(s.username) as any;
      if (!u) return Response.json({ user: null });
      if (u.status === "disabled") return Response.json({ user: null });

      let whoamiPanelState = null;
      try {
        whoamiPanelState = u.panel_state ? JSON.parse(u.panel_state) : null;
      } catch {
        whoamiPanelState = null;
      }
      const access = getCurrentUser(req);
      return Response.json({
        user: {
          username: u.username,
          displayName: u.display_name,
          avatar: u.avatar,
          panelState: whoamiPanelState,
          role: u.role === "admin" || u.is_admin ? "admin" : "user",
          roles: access?.roles || [],
          permissions: access?.permissions || [],
          dataScope: access?.dataScope || "own",
        },
      });
    } catch {
      return Response.json({ user: null });
    }
  }

  if ((url.pathname === "/api/auth/logout" || url.pathname === "/api/logout") && method === "POST") {
    try {
      const token = getSessionToken(req);
      if (token) {
        try {
          adminDb.run("DELETE FROM sessions WHERE token = ? OR id = ?", [token, token]);
        } catch {}
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Set-Cookie": "kb_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
        },
      });
    } catch {
      return Response.json({ success: false, message: "登出失败" }, { status: 400 });
    }
  }

  if (url.pathname === "/api/auth/users" && method === "GET") {
    const current = getCurrentUser(req);
    if (!isAdmin(current)) return Response.json({ error: "无权访问" }, { status: 403 });
    const users = adminDb.query("SELECT id, username, display_name, avatar, role, status, created_at FROM users ORDER BY created_at DESC").all();
    return Response.json({ users });
  }

  const userManageMatch = url.pathname.match(/^\/api\/auth\/users\/(\d+)$/);
  if (userManageMatch && method === "PATCH") {
    const current = getCurrentUser(req);
    if (!isAdmin(current)) return Response.json({ error: "无权访问" }, { status: 403 });
    const body: any = await req.json().catch(() => ({}));
    const role = body.role === "admin" ? "admin" : body.role === "user" ? "user" : null;
    const status = body.status === "disabled" ? "disabled" : body.status === "active" ? "active" : null;
    if (!role && !status) return Response.json({ error: "没有可更新的字段" }, { status: 400 });
    const targetId = Number(userManageMatch[1]);
    const target = adminDb.query("SELECT id, username FROM users WHERE id = ?").get(targetId) as any;
    if (!target) return Response.json({ error: "用户不存在" }, { status: 404 });
    if (target.id === current.id && status === "disabled") return Response.json({ error: "不能停用当前登录账号" }, { status: 400 });
    const updates: string[] = [], params: any[] = [];
    if (role) { updates.push("role = ?", "is_admin = ?"); params.push(role, role === "admin" ? 1 : 0); }
    if (status) { updates.push("status = ?"); params.push(status); }
    updates.push("updated_at = CURRENT_TIMESTAMP");
    adminDb.run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, [...params, targetId]);
    return Response.json({ success: true });
  }

  if (url.pathname === "/api/auth/update_profile" && method === "POST") {
    try {
      const token = getSessionToken(req);
      if (!token) {
        return Response.json({ success: false, message: "未登录" }, { status: 401 });
      }

      const s = adminDb.query("SELECT username FROM sessions WHERE token = ? OR id = ?").get(token, token);
      if (!s) {
        return Response.json({ success: false, message: "未登录" }, { status: 401 });
      }

      const body: any = await req.json();
      const displayName = body.displayName !== undefined ? (body.displayName || "").toString().trim() : undefined;
      const avatar = body.avatar !== undefined ? (body.avatar || "").toString().trim() : undefined;
      const panelState = body.panelState !== undefined ? JSON.stringify(body.panelState) : undefined;

      try {
        const updates = [];
        const params: any[] = [];
        if (displayName !== undefined) {
          updates.push("display_name = ?");
          params.push(displayName || s.username);
        }
        if (avatar !== undefined) {
          updates.push("avatar = ?");
          params.push(avatar || "");
        }
        if (panelState !== undefined) {
          updates.push("panel_state = ?");
          params.push(panelState);
        }
        if (updates.length) {
          updates.push("updated_at = CURRENT_TIMESTAMP");
          adminDb.run(
            `UPDATE users SET ${updates.join(", ")} WHERE username = ?`,
            [...params, s.username]
          );
        }
      } catch {}

      const u = adminDb
        .query("SELECT username, display_name, avatar, panel_state FROM users WHERE username = ?")
        .get(s.username);
      let updatePanelState = null;
      try {
        updatePanelState = u.panel_state ? JSON.parse(u.panel_state) : null;
      } catch {
        updatePanelState = null;
      }
      return Response.json({
        success: true,
        user: {
          username: u.username,
          displayName: u.display_name,
          avatar: u.avatar,
          panelState: updatePanelState,
        },
      });
    } catch {
      return Response.json({ success: false, message: "保存失败" }, { status: 400 });
    }
  }

  return null;
}
