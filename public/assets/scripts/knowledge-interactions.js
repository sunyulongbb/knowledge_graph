(function () {
  const byId = (id) => document.getElementById(id);
  const apiUrl = (path) => {
    const url = new URL(path, window.location.origin);
    const db = new URLSearchParams(window.location.search).get("db");
    if (db) url.searchParams.set("db", db);
    return url.toString();
  };
  const activeId = () => String(byId("detailPanel")?.dataset.entityId || window.kbActiveDetailNodeId || "").trim();
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const setMessage = (text, error) => { const el = byId("knowledgeCommentMessage"); if (el) { el.textContent = text || ""; el.style.color = error ? "var(--danger, #dc2626)" : ""; } };
  function updateCounts(data) {
    ["Like", "Comment", "Share"].forEach((name) => { const el = byId(`knowledge${name}Count`); if (el) el.textContent = String(data[`${name.toLowerCase()}Count`] || 0); });
    const button = byId("btnKnowledgeLike");
    if (button) { button.classList.toggle("is-active", !!data.liked); button.querySelector("i").className = data.liked ? "fa-solid fa-thumbs-up" : "fa-regular fa-thumbs-up"; button.querySelector("span").textContent = data.liked ? "已赞" : "点赞"; }
  }
  function renderComments(comments) {
    const list = byId("knowledgeCommentList"); if (!list) return;
    list.innerHTML = comments?.length ? comments.map((comment) => `<article class="knowledge-comment"><div class="knowledge-comment-head"><span><span class="knowledge-comment-user">${escapeHtml(comment.username)}</span> · ${escapeHtml(new Date(comment.createdAt).toLocaleString("zh-CN", { hour12: false }))}</span>${comment.canDelete ? `<button class="knowledge-comment-delete" data-comment-id="${comment.id}" title="删除评论"><i class="fa-solid fa-trash"></i></button>` : ""}</div><div class="knowledge-comment-content">${escapeHtml(comment.content)}</div></article>`).join("") : '<div class="muted">暂无评论，来说两句吧。</div>';
  }
  async function request(path, options = {}) { const response = await fetch(apiUrl(path), { credentials: "include", ...options }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "请求失败"); return data; }
  async function load() {
    const id = activeId(); if (!id) return;
    try { const data = await request(`/api/knowledge/${encodeURIComponent(id)}/comments`); updateCounts(data); renderComments(data.comments); } catch (error) { console.warn("load interactions failed", error); }
  }
  byId("btnKnowledgeLike")?.addEventListener("click", async () => { const id = activeId(); if (!id) return; try { const liked = byId("btnKnowledgeLike")?.classList.contains("is-active"); updateCounts(await request(`/api/knowledge/${encodeURIComponent(id)}/like`, { method: liked ? "DELETE" : "POST" })); } catch (error) { setMessage(error.message, true); } });
  byId("btnKnowledgeComment")?.addEventListener("click", () => byId("knowledgeComments")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  byId("btnKnowledgeCommentSubmit")?.addEventListener("click", async () => { const id = activeId(), input = byId("knowledgeCommentInput"), content = input?.value.trim(); if (!id || !content) return setMessage("请输入评论内容", true); try { await request(`/api/knowledge/${encodeURIComponent(id)}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) }); input.value = ""; setMessage("评论已发表"); await load(); } catch (error) { setMessage(error.message, true); } });
  byId("knowledgeCommentList")?.addEventListener("click", async (event) => { const button = event.target.closest("[data-comment-id]"); if (!button) return; try { updateCounts(await request(`/api/comments/${button.dataset.commentId}`, { method: "DELETE" })); await load(); } catch (error) { setMessage(error.message, true); } });
  byId("btnKnowledgeShare")?.addEventListener("click", async () => { const id = activeId(); if (!id) return; try { const data = await request(`/api/knowledge/${encodeURIComponent(id)}/share`, { method: "POST" }); updateCounts(data); if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(data.shareUrl); setMessage("已生成并复制系统分享链接"); } catch (error) { setMessage(error.message, true); } });
  window.addEventListener("kb-detail-loaded", load);
  window.loadKnowledgeInteractions = load;
})();
