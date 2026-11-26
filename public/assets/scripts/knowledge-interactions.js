(function () {
  const byId = (id) => document.getElementById(id);
  const apiUrl = (path) => {
    const url = new URL(path, window.location.origin);
    const db = window.getCurrentDbParam();
    if (db) url.searchParams.set("db", db);
    return url.toString();
  };
  const activeId = () => String(byId("detailPanel")?.dataset.entityId || window.kbActiveDetailNodeId || "").trim();
  const wikiSyncAnchor = byId('btnEditWiki');
  if (wikiSyncAnchor) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'btn icon';
    button.title = '同步 Wikipedia 百科'; button.setAttribute('aria-label', button.title);
    button.innerHTML = '<i class="fa-brands fa-wikipedia-w" aria-hidden="true"></i>';
    wikiSyncAnchor.before(button);
    button.onclick = async () => {
      const id = activeId(); if (!id) return;
      const dialog = document.createElement('dialog');
      dialog.style.cssText = 'width:min(600px,90vw);padding:24px;border-radius:16px';
      dialog.innerHTML = '<h3>同步 Wikipedia 百科</h3><progress max="100" value="0" style="width:100%"></progress><pre role="log" aria-live="polite" style="white-space:pre-wrap;max-height:320px;overflow:auto"></pre><button type="button">关闭</button><button type="button" data-refresh hidden>刷新查看百科</button>';
      document.body.append(dialog); dialog.showModal();
      let finished = false;
      dialog.querySelector('button').onclick = () => { dialog.close(); if (finished) dialog.remove(); };
      dialog.querySelector('[data-refresh]').onclick = () => location.reload();
      const log = text => { const el = dialog.querySelector('pre'); el.textContent += text + '\n'; el.scrollTop = el.scrollHeight; };
      button.disabled = true;
      try {
        const request = overwrite => fetch(apiUrl('/api/kb/entity/sync-wikipedia'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, overwrite }) });
        let response = await request(false);
        if (response.status === 409) {
          const data = await response.json();
          if (data.code !== 'WIKI_OVERWRITE_REQUIRED') throw new Error(data.error || '同步冲突');
          if (!window.confirm('知识页面已有内容。是否使用 Wikipedia 百科覆盖现有 Markdown？')) { log('已取消，原内容保留'); return; }
          response = await request(true);
        }
        if (!response.ok) { const data = await response.json(); throw new Error(data.error || '同步失败'); }
        const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
        while (true) {
          const { value, done } = await reader.read(); buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n'); buffer = lines.pop();
          for (const line of lines) if (line.trim()) {
            const entry = JSON.parse(line); log(entry.message);
            if (!entry.error) dialog.querySelector('progress').value = entry.progress;
            if (entry.done) dialog.querySelector('[data-refresh]').hidden = false;
          }
          if (done) break;
        }
      } catch (error) { log('错误：' + error.message); }
      finally { button.disabled = false; finished = true; if (!dialog.open) dialog.remove(); }
    };
  }
  const mediaAnchor = byId('btnEditWiki');
  if (mediaAnchor) {
    const button = document.createElement('button');
    button.className = 'btn icon'; button.type = 'button';
    button.title = '同步媒体文件'; button.setAttribute('aria-label', '同步媒体文件');
    button.innerHTML = '<i class="fa-solid fa-cloud-arrow-down" aria-hidden="true"></i>';
    mediaAnchor.before(button);
    button.onclick = async () => {
      const id = activeId(); if (!id) return;
      const dialog = document.createElement('dialog');
      dialog.style.cssText = 'width:min(600px,90vw);padding:24px;border-radius:16px';
      dialog.innerHTML = '<h3>同步媒体文件</h3><progress max="100" value="0" style="width:100%"></progress><pre role="log" aria-live="polite" style="white-space:pre-wrap;max-height:320px;overflow:auto"></pre><button type="button">关闭</button>';
      document.body.append(dialog); dialog.showModal();
      let finished = false;
      dialog.querySelector('button').onclick = () => { dialog.close(); if (finished) dialog.remove(); };
      const log = text => { const el = dialog.querySelector('pre'); el.textContent += text + '\n'; el.scrollTop = el.scrollHeight; };
      button.disabled = true;
      try {
        const response = await fetch(apiUrl('/api/kb/entity/sync-media'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        if (!response.ok) { const data = await response.json(); throw new Error(data.error || '同步失败'); }
        const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
        while (true) {
          const { value, done } = await reader.read(); buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n'); buffer = lines.pop();
          for (const line of lines) if (line.trim()) { const entry = JSON.parse(line); log(entry.message); if (!entry.error) dialog.querySelector('progress').value = entry.progress; }
          if (done) break;
        }
        log('关闭弹框后刷新详情页，可查看已保存的媒体。');
      } catch (error) { log('错误：' + error.message); }
      finally { button.disabled = false; finished = true; if (!dialog.open) dialog.remove(); }
    };
  }
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
