import { adminDb, hashPassword } from "../db.ts";

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
      adminDb.run(
        "INSERT INTO users (username, display_name, password_hash, password_salt, avatar) VALUES (?, ?, ?, ?, ?)",
        [username, displayName || username, ph.hash || "", ph.salt || "", avatar || ""]
      );
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

  if (url.pathname === "/api/auth/login" && method === "POST") {
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
          "SELECT username, display_name, password_hash, password_salt, avatar, panel_state FROM users WHERE username = ?"
        )
        .get(username);
      if (!u) {
        return Response.json(
          { success: false, message: "用户不存在或密码错误" },
          { status: 401 }
        );
      }

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

  if (url.pathname === "/api/auth/whoami" && method === "GET") {
    try {
      const token = getSessionToken(req);
      if (!token) return Response.json({ user: null });

      const s = adminDb.query("SELECT username FROM sessions WHERE token = ? OR id = ?").get(token, token);
      if (!s) return Response.json({ user: null });

      const u = adminDb
        .query("SELECT username, display_name, avatar, panel_state FROM users WHERE username = ?")
        .get(s.username);
      if (!u) return Response.json({ user: null });

      let whoamiPanelState = null;
      try {
        whoamiPanelState = u.panel_state ? JSON.parse(u.panel_state) : null;
      } catch {
        whoamiPanelState = null;
      }
      return Response.json({
        user: {
          username: u.username,
          displayName: u.display_name,
          avatar: u.avatar,
          panelState: whoamiPanelState,
        },
      });
    } catch {
      return Response.json({ user: null });
    }
  }

  if (url.pathname === "/api/auth/logout" && method === "POST") {
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

  if (url.pathname === "/api/auth/users" && method === "GET") {
    try {
      const rows = adminDb
        .query("SELECT username, display_name, avatar FROM users ORDER BY created_at DESC")
        .all();
      const users = Array.isArray(rows)
        ? rows.map((r: any) => ({
            username: r.username,
            displayName: r.display_name,
            avatar: r.avatar,
          }))
        : [];
      return Response.json({ users });
    } catch {
      return Response.json({ users: [] });
    }
  }

  return null;
}
