import { db } from "../db.ts";
import { getCurrentUser, isAdmin } from "../auth-context.ts";

const json = (body: any, status = 200) => Response.json(body, { status });
const cleanKnowledgeId = (value: string) => decodeURIComponent(value || "").trim();

function counts(knowledgeId: string, userId?: number) {
  const likeCount = Number((db.query("SELECT COUNT(*) AS count FROM knowledge_likes WHERE knowledge_id = ?").get(knowledgeId) as any)?.count || 0);
  const commentCount = Number((db.query("SELECT COUNT(*) AS count FROM knowledge_comments WHERE knowledge_id = ?").get(knowledgeId) as any)?.count || 0);
  const shareCount = Number((db.query("SELECT COUNT(*) AS count FROM knowledge_shares WHERE knowledge_id = ?").get(knowledgeId) as any)?.count || 0);
  const liked = !!userId && !!db.query("SELECT 1 FROM knowledge_likes WHERE knowledge_id = ? AND user_id = ?").get(knowledgeId, userId);
  return { likeCount, commentCount, shareCount, liked };
}

export async function handleInteractionRoutes(req: Request, url: URL, method: string) {
  const match = url.pathname.match(/^\/api\/knowledge\/([^/]+)(?:\/(like|comments|share|interaction))?$/);
  if (match) {
    const knowledgeId = cleanKnowledgeId(match[1] || "");
    const action = match[2] || "interaction";
    if (!knowledgeId) return json({ error: "知识 ID 不能为空" }, 400);
    const user = getCurrentUser(req);
    if (action === "interaction" && method === "GET") return json(counts(knowledgeId, user?.id));
    if (action === "like" && method === "POST") {
      if (!user) return json({ error: "请先登录" }, 401);
      db.run("INSERT OR IGNORE INTO knowledge_likes (user_id, knowledge_id) VALUES (?, ?)", [user.id, knowledgeId]);
      return json(counts(knowledgeId, user.id));
    }
    if (action === "like" && method === "DELETE") {
      if (!user) return json({ error: "请先登录" }, 401);
      db.run("DELETE FROM knowledge_likes WHERE user_id = ? AND knowledge_id = ?", [user.id, knowledgeId]);
      return json(counts(knowledgeId, user.id));
    }
    if (action === "comments" && method === "GET") {
      const rows = db.query(`SELECT c.id, c.user_id, c.content, c.created_at, u.username, u.display_name, u.avatar FROM knowledge_comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.knowledge_id = ? ORDER BY c.created_at DESC, c.id DESC`).all(knowledgeId) as any[];
      return json({ comments: rows.map((row) => ({ id: row.id, userId: row.user_id, username: row.display_name || row.username || "用户", avatar: row.avatar || "", content: row.content, createdAt: row.created_at, canDelete: !!user && (isAdmin(user) || user.id === row.user_id) })), ...counts(knowledgeId, user?.id) });
    }
    if (action === "comments" && method === "POST") {
      if (!user) return json({ error: "请先登录" }, 401);
      const body: any = await req.json().catch(() => ({}));
      const content = String(body.content || "").trim();
      if (!content || content.length > 2000) return json({ error: "评论内容不能为空且不能超过 2000 字" }, 400);
      const result = db.run("INSERT INTO knowledge_comments (user_id, knowledge_id, content) VALUES (?, ?, ?)", [user.id, knowledgeId, content]);
      return json({ success: true, id: Number(result.lastInsertRowid), ...counts(knowledgeId, user.id) }, 201);
    }
    if (action === "share" && method === "POST") {
      if (!user) return json({ error: "请先登录" }, 401);
      db.run("INSERT INTO knowledge_shares (user_id, knowledge_id) VALUES (?, ?)", [user.id, knowledgeId]);
      const shareUrl = new URL("/kb/detail", url.origin);
      shareUrl.searchParams.set("id", knowledgeId);
      const dbName = url.searchParams.get("db");
      if (dbName) shareUrl.searchParams.set("db", dbName);
      return json({ success: true, shareUrl: shareUrl.toString(), ...counts(knowledgeId, user.id) });
    }
  }
  const commentMatch = url.pathname.match(/^\/api\/comments\/(\d+)$/);
  if (commentMatch && method === "DELETE") {
    const user = getCurrentUser(req);
    if (!user) return json({ error: "请先登录" }, 401);
    const comment = db.query("SELECT id, user_id, knowledge_id FROM knowledge_comments WHERE id = ?").get(Number(commentMatch[1])) as any;
    if (!comment) return json({ error: "评论不存在" }, 404);
    if (!isAdmin(user) && user.id !== comment.user_id) return json({ error: "无权删除此评论" }, 403);
    db.run("DELETE FROM knowledge_comments WHERE id = ?", [comment.id]);
    return json({ success: true, ...counts(comment.knowledge_id, user.id) });
  }
  return null;
}
