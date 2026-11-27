// public/assets/scripts/knowledge-interactions.js
(function() {
  const byId = (id) => document.getElementById(id);
  const contentTabs = [byId("detailKnowledgeTab"), byId("detailAttributesTab")];
  function selectContentTab(index) {
    contentTabs.forEach((tab, i) => {
      if (!tab)
        return;
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      const panel = byId(tab.getAttribute("aria-controls"));
      if (panel)
        panel.style.display = i === index ? "" : "none";
    });
    const toc = byId("wikiToc");
    if (toc)
      toc.hidden = index === 1;
    const list = byId("detailAttrList");
    if (index === 1 && list && !list.textContent.trim())
      list.textContent = "暂无属性信息。";
  }
  contentTabs.forEach((tab, index) => {
    tab?.addEventListener("click", () => selectContentTab(index));
    tab?.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
      selectContentTab(next);
      contentTabs[next]?.focus();
    });
  });
  window.addEventListener("kb-detail-loaded", () => selectContentTab(0));
  byId("btnEditWiki")?.addEventListener("click", () => selectContentTab(0));
  const apiUrl = (path) => {
    const url = new URL(path, window.location.origin);
    const db = window.getCurrentDbParam();
    if (db)
      url.searchParams.set("db", db);
    return url.toString();
  };
  const activeId = () => String(byId("detailPanel")?.dataset.entityId || window.kbActiveDetailNodeId || "").trim();
  const wikiSyncAnchor = byId("btnEditWiki");
  if (wikiSyncAnchor) {
    const field = document.createElement("div");
    field.style.cssText = "display:none;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0";
    field.innerHTML = '<label for="detailWikidataId">Wikidata ID</label><input id="detailWikidataId" class="kb-input" placeholder="例如 Q42" style="width:140px"><button type="button" class="btn">保存 ID</button><span role="status"></span>';
    const input = field.querySelector("input");
    const save = field.querySelector("button");
    const status = field.querySelector('[role="status"]');
    let fieldEntityId = "";
    const resetField = () => {
      const id = activeId();
      if (id === fieldEntityId)
        return;
      fieldEntityId = id;
      field.style.display = "none";
      input.value = /^Q[1-9][0-9]*$/.test(id) ? id : "";
      status.textContent = "";
    };
    window.addEventListener("kb-detail-loaded", resetField);
    resetField();
    save.onclick = async () => {
      const id = activeId(), value = input.value.trim().toUpperCase();
      if (!id) {
        status.textContent = "请先选择知识";
        return;
      }
      if (!/^Q[1-9][0-9]*$/.test(value)) {
        status.textContent = "请输入有效 ID，例如 Q42";
        return;
      }
      save.disabled = true;
      status.textContent = "正在保存…";
      try {
        const response = await fetch(apiUrl("/api/kb/nodes/update"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, link: `https://www.wikidata.org/wiki/${value}` }) });
        const data = await response.json();
        if (!response.ok || data.ok === false)
          throw new Error(data.error || "保存失败");
        if (activeId() === id) {
          input.value = value;
          field.style.display = "none";
          const currentDialog = field.closest("dialog");
          if (currentDialog) {
            currentDialog.close();
            field.remove();
            currentDialog.remove();
          }
          button.click();
        }
      } catch (error) {
        if (activeId() === id)
          status.textContent = error.message;
      } finally {
        save.disabled = false;
      }
    };
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn icon";
    button.title = "同步 Wikipedia 百科";
    button.setAttribute("aria-label", button.title);
    button.innerHTML = '<i class="fa-brands fa-wikipedia-w" aria-hidden="true"></i>';
    wikiSyncAnchor.before(button);
    button.onclick = async () => {
      const id = activeId();
      if (!id)
        return;
      const dialog = document.createElement("dialog");
      dialog.style.cssText = "width:min(600px,90vw);padding:24px;border-radius:16px";
      dialog.innerHTML = '<h3>同步 Wikipedia 百科</h3><progress max="100" value="0" style="width:100%"></progress><pre role="log" aria-live="polite" style="white-space:pre-wrap;max-height:320px;overflow:auto"></pre><button type="button">关闭</button><button type="button" data-refresh hidden>刷新查看百科</button>';
      document.body.append(dialog);
      dialog.showModal();
      let finished = false;
      dialog.querySelector("button").onclick = () => {
        dialog.close();
        if (finished)
          dialog.remove();
      };
      dialog.querySelector("[data-refresh]").onclick = () => location.reload();
      const log = (text) => {
        const el = dialog.querySelector("pre");
        el.textContent += text + `
`;
        el.scrollTop = el.scrollHeight;
      };
      button.disabled = true;
      try {
        const request2 = (overwrite) => fetch(apiUrl("/api/kb/entity/sync-wikipedia"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, overwrite }) });
        let response = await request2(false);
        if (response.status === 409) {
          const data = await response.json();
          if (data.code !== "WIKI_OVERWRITE_REQUIRED")
            throw new Error(data.error || "同步冲突");
          if (!window.confirm("知识页面已有内容。是否使用 Wikipedia 百科覆盖现有 Markdown？")) {
            log("已取消，原内容保留");
            return;
          }
          response = await request2(true);
        }
        if (!response.ok) {
          const data = await response.json();
          if (data.code === "WIKIDATA_ID_REQUIRED") {
            if (activeId() === id) {
              dialog.querySelector("progress").hidden = true;
              dialog.querySelector("pre").hidden = true;
              dialog.querySelector("h3").after(field);
              field.style.display = "flex";
              status.textContent = "请填写 Wikidata ID，保存后自动同步百科";
              input.focus();
            }
            return;
          }
          throw new Error(data.error || "同步失败");
        }
        const reader = response.body.getReader(), decoder = new TextDecoder;
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split(`
`);
          buffer = lines.pop();
          for (const line of lines)
            if (line.trim()) {
              const entry = JSON.parse(line);
              log(entry.message);
              if (!entry.error)
                dialog.querySelector("progress").value = entry.progress;
              if (entry.done)
                dialog.querySelector("[data-refresh]").hidden = false;
            }
          if (done)
            break;
        }
      } catch (error) {
        log("错误：" + error.message);
      } finally {
        button.disabled = false;
        finished = true;
        if (!dialog.open)
          dialog.remove();
      }
    };
  }
  const mediaAnchor = byId("btnEditWiki");
  if (mediaAnchor) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn icon";
    button.innerHTML = '<i class="fa-solid fa-list-check" aria-hidden="true"></i>';
    button.title = "同步属性信息，过滤外部标识符属性";
    button.setAttribute("aria-label", "同步 Wikidata 属性");
    mediaAnchor.before(button);
    button.onclick = async () => {
      const id = activeId();
      if (!id)
        return;
      if (!confirm("将更新同名 Wikidata 属性并保留其他属性，是否继续？"))
        return;
      const dialog = document.createElement("dialog");
      dialog.style.cssText = "width:min(600px,90vw);padding:24px;border-radius:16px";
      dialog.innerHTML = '<h3>同步 Wikidata 属性</h3><progress max="100" value="0" style="width:100%"></progress><pre role="log" aria-live="polite" style="white-space:pre-wrap;max-height:320px;overflow:auto"></pre><button type="button">关闭</button><button type="button" data-refresh hidden>刷新查看属性</button>';
      document.body.append(dialog);
      dialog.showModal();
      let finished = false;
      dialog.querySelector("button").onclick = () => {
        dialog.close();
        if (finished)
          dialog.remove();
      };
      dialog.querySelector("[data-refresh]").onclick = () => location.reload();
      const log = (text) => {
        dialog.querySelector("pre").textContent += text + `
`;
      };
      button.disabled = true;
      try {
        const response = await fetch(apiUrl("/api/kb/entity/sync-attributes"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
        if (!response.ok) {
          const data = await response.json();
          throw Error(data.error || "同步失败");
        }
        const reader = response.body.getReader(), decoder = new TextDecoder;
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split(`
`);
          buffer = lines.pop();
          for (const line of lines)
            if (line.trim()) {
              const entry = JSON.parse(line);
              log(entry.message);
              if (!entry.error)
                dialog.querySelector("progress").value = entry.progress;
              if (entry.done)
                dialog.querySelector("[data-refresh]").hidden = false;
            }
          if (done)
            break;
        }
      } catch (error) {
        log("错误：" + error.message);
      } finally {
        button.disabled = false;
        finished = true;
        if (!dialog.open)
          dialog.remove();
      }
    };
  }
  if (mediaAnchor) {
    const button = document.createElement("button");
    button.className = "btn icon";
    button.type = "button";
    button.title = "同步媒体文件";
    button.setAttribute("aria-label", "同步媒体文件");
    button.innerHTML = '<i class="fa-solid fa-cloud-arrow-down" aria-hidden="true"></i>';
    mediaAnchor.before(button);
    button.onclick = async () => {
      const id = activeId();
      if (!id)
        return;
      const dialog = document.createElement("dialog");
      dialog.style.cssText = "width:min(600px,90vw);padding:24px;border-radius:16px";
      dialog.innerHTML = '<h3>同步媒体文件</h3><progress max="100" value="0" style="width:100%"></progress><pre role="log" aria-live="polite" style="white-space:pre-wrap;max-height:320px;overflow:auto"></pre><button type="button">关闭</button>';
      document.body.append(dialog);
      dialog.showModal();
      let finished = false;
      dialog.querySelector("button").onclick = () => {
        dialog.close();
        if (finished)
          dialog.remove();
      };
      const log = (text) => {
        const el = dialog.querySelector("pre");
        el.textContent += text + `
`;
        el.scrollTop = el.scrollHeight;
      };
      button.disabled = true;
      try {
        const response = await fetch(apiUrl("/api/kb/entity/sync-media"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "同步失败");
        }
        const reader = response.body.getReader(), decoder = new TextDecoder;
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split(`
`);
          buffer = lines.pop();
          for (const line of lines)
            if (line.trim()) {
              const entry = JSON.parse(line);
              log(entry.message);
              if (!entry.error)
                dialog.querySelector("progress").value = entry.progress;
            }
          if (done)
            break;
        }
        log("关闭弹框后刷新详情页，可查看已保存的媒体。");
      } catch (error) {
        log("错误：" + error.message);
      } finally {
        button.disabled = false;
        finished = true;
        if (!dialog.open)
          dialog.remove();
      }
    };
  }
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const setMessage = (text, error) => {
    const el = byId("knowledgeCommentMessage");
    if (el) {
      el.textContent = text || "";
      el.style.color = error ? "var(--danger, #dc2626)" : "";
    }
  };
  function updateCounts(data) {
    ["Like", "Comment", "Share"].forEach((name) => {
      const el = byId(`knowledge${name}Count`);
      if (el)
        el.textContent = String(data[`${name.toLowerCase()}Count`] || 0);
    });
    const button = byId("btnKnowledgeLike");
    if (button) {
      button.classList.toggle("is-active", !!data.liked);
      button.querySelector("i").className = data.liked ? "fa-solid fa-thumbs-up" : "fa-regular fa-thumbs-up";
      button.querySelector("span").textContent = data.liked ? "已赞" : "点赞";
    }
  }
  function renderComments(comments) {
    const list = byId("knowledgeCommentList");
    if (!list)
      return;
    list.innerHTML = comments?.length ? comments.map((comment) => `<article class="knowledge-comment"><div class="knowledge-comment-head"><span><span class="knowledge-comment-user">${escapeHtml(comment.username)}</span> · ${escapeHtml(new Date(comment.createdAt).toLocaleString("zh-CN", { hour12: false }))}</span>${comment.canDelete ? `<button class="knowledge-comment-delete" data-comment-id="${comment.id}" title="删除评论"><i class="fa-solid fa-trash"></i></button>` : ""}</div><div class="knowledge-comment-content">${escapeHtml(comment.content)}</div></article>`).join("") : '<div class="muted">暂无评论，来说两句吧。</div>';
  }
  async function request(path, options = {}) {
    const response = await fetch(apiUrl(path), { credentials: "include", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(data.error || "请求失败");
    return data;
  }
  async function load() {
    const id = activeId();
    if (!id)
      return;
    try {
      const data = await request(`/api/knowledge/${encodeURIComponent(id)}/comments`);
      updateCounts(data);
      renderComments(data.comments);
    } catch (error) {
      console.warn("load interactions failed", error);
    }
  }
  byId("btnKnowledgeLike")?.addEventListener("click", async () => {
    const id = activeId();
    if (!id)
      return;
    try {
      const liked = byId("btnKnowledgeLike")?.classList.contains("is-active");
      updateCounts(await request(`/api/knowledge/${encodeURIComponent(id)}/like`, { method: liked ? "DELETE" : "POST" }));
    } catch (error) {
      setMessage(error.message, true);
    }
  });
  byId("btnKnowledgeComment")?.addEventListener("click", () => byId("knowledgeComments")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  byId("btnKnowledgeCommentSubmit")?.addEventListener("click", async () => {
    const id = activeId(), input = byId("knowledgeCommentInput"), content = input?.value.trim();
    if (!id || !content)
      return setMessage("请输入评论内容", true);
    try {
      await request(`/api/knowledge/${encodeURIComponent(id)}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      input.value = "";
      setMessage("评论已发表");
      await load();
    } catch (error) {
      setMessage(error.message, true);
    }
  });
  byId("knowledgeCommentList")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-comment-id]");
    if (!button)
      return;
    try {
      updateCounts(await request(`/api/comments/${button.dataset.commentId}`, { method: "DELETE" }));
      await load();
    } catch (error) {
      setMessage(error.message, true);
    }
  });
  byId("btnKnowledgeShare")?.addEventListener("click", async () => {
    const id = activeId();
    if (!id)
      return;
    try {
      const data = await request(`/api/knowledge/${encodeURIComponent(id)}/share`, { method: "POST" });
      updateCounts(data);
      if (navigator.clipboard?.writeText)
        await navigator.clipboard.writeText(data.shareUrl);
      setMessage("已生成并复制系统分享链接");
    } catch (error) {
      setMessage(error.message, true);
    }
  });
  window.addEventListener("kb-detail-loaded", load);
  window.loadKnowledgeInteractions = load;
})();
