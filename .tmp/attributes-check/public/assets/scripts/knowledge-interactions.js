// @bun
// public/assets/scripts/knowledge-interactions.js
(function() {
  const byId = (id) => document.getElementById(id);
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
    field.innerHTML = '<label for="detailWikidataId">Wikidata ID</label><input id="detailWikidataId" class="kb-input" placeholder="\u4F8B\u5982 Q42" style="width:140px"><button type="button" class="btn">\u4FDD\u5B58 ID</button><span role="status"></span>';
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
        status.textContent = "\u8BF7\u5148\u9009\u62E9\u77E5\u8BC6";
        return;
      }
      if (!/^Q[1-9][0-9]*$/.test(value)) {
        status.textContent = "\u8BF7\u8F93\u5165\u6709\u6548 ID\uFF0C\u4F8B\u5982 Q42";
        return;
      }
      save.disabled = true;
      status.textContent = "\u6B63\u5728\u4FDD\u5B58\u2026";
      try {
        const response = await fetch(apiUrl("/api/kb/nodes/update"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, link: `https://www.wikidata.org/wiki/${value}` }) });
        const data = await response.json();
        if (!response.ok || data.ok === false)
          throw new Error(data.error || "\u4FDD\u5B58\u5931\u8D25");
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
    button.title = "\u540C\u6B65 Wikipedia \u767E\u79D1";
    button.setAttribute("aria-label", button.title);
    button.innerHTML = '<i class="fa-brands fa-wikipedia-w" aria-hidden="true"></i>';
    wikiSyncAnchor.before(button);
    button.onclick = async () => {
      const id = activeId();
      if (!id)
        return;
      const dialog = document.createElement("dialog");
      dialog.style.cssText = "width:min(600px,90vw);padding:24px;border-radius:16px";
      dialog.innerHTML = '<h3>\u540C\u6B65 Wikipedia \u767E\u79D1</h3><progress max="100" value="0" style="width:100%"></progress><pre role="log" aria-live="polite" style="white-space:pre-wrap;max-height:320px;overflow:auto"></pre><button type="button">\u5173\u95ED</button><button type="button" data-refresh hidden>\u5237\u65B0\u67E5\u770B\u767E\u79D1</button>';
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
            throw new Error(data.error || "\u540C\u6B65\u51B2\u7A81");
          if (!window.confirm("\u77E5\u8BC6\u9875\u9762\u5DF2\u6709\u5185\u5BB9\u3002\u662F\u5426\u4F7F\u7528 Wikipedia \u767E\u79D1\u8986\u76D6\u73B0\u6709 Markdown\uFF1F")) {
            log("\u5DF2\u53D6\u6D88\uFF0C\u539F\u5185\u5BB9\u4FDD\u7559");
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
              status.textContent = "\u8BF7\u586B\u5199 Wikidata ID\uFF0C\u4FDD\u5B58\u540E\u81EA\u52A8\u540C\u6B65\u767E\u79D1";
              input.focus();
            }
            return;
          }
          throw new Error(data.error || "\u540C\u6B65\u5931\u8D25");
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
        log("\u9519\u8BEF\uFF1A" + error.message);
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
    button.className = "btn";
    button.textContent = "\u540C\u6B65 Wikidata \u5C5E\u6027";
    button.title = "\u540C\u6B65\u5C5E\u6027\u4FE1\u606F\uFF0C\u8FC7\u6EE4\u5916\u90E8\u6807\u8BC6\u7B26\u5C5E\u6027";
    mediaAnchor.before(button);
    button.onclick = async () => {
      const id = activeId();
      if (!id)
        return;
      if (!confirm("\u5C06\u66F4\u65B0\u540C\u540D Wikidata \u5C5E\u6027\u5E76\u4FDD\u7559\u5176\u4ED6\u5C5E\u6027\uFF0C\u662F\u5426\u7EE7\u7EED\uFF1F"))
        return;
      const dialog = document.createElement("dialog");
      dialog.style.cssText = "width:min(600px,90vw);padding:24px;border-radius:16px";
      dialog.innerHTML = '<h3>\u540C\u6B65 Wikidata \u5C5E\u6027</h3><progress max="100" value="0" style="width:100%"></progress><pre role="log" aria-live="polite" style="white-space:pre-wrap;max-height:320px;overflow:auto"></pre><button type="button">\u5173\u95ED</button><button type="button" data-refresh hidden>\u5237\u65B0\u67E5\u770B\u5C5E\u6027</button>';
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
          throw Error(data.error || "\u540C\u6B65\u5931\u8D25");
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
        log("\u9519\u8BEF\uFF1A" + error.message);
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
    button.title = "\u540C\u6B65\u5A92\u4F53\u6587\u4EF6";
    button.setAttribute("aria-label", "\u540C\u6B65\u5A92\u4F53\u6587\u4EF6");
    button.innerHTML = '<i class="fa-solid fa-cloud-arrow-down" aria-hidden="true"></i>';
    mediaAnchor.before(button);
    button.onclick = async () => {
      const id = activeId();
      if (!id)
        return;
      const dialog = document.createElement("dialog");
      dialog.style.cssText = "width:min(600px,90vw);padding:24px;border-radius:16px";
      dialog.innerHTML = '<h3>\u540C\u6B65\u5A92\u4F53\u6587\u4EF6</h3><progress max="100" value="0" style="width:100%"></progress><pre role="log" aria-live="polite" style="white-space:pre-wrap;max-height:320px;overflow:auto"></pre><button type="button">\u5173\u95ED</button>';
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
          throw new Error(data.error || "\u540C\u6B65\u5931\u8D25");
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
        log("\u5173\u95ED\u5F39\u6846\u540E\u5237\u65B0\u8BE6\u60C5\u9875\uFF0C\u53EF\u67E5\u770B\u5DF2\u4FDD\u5B58\u7684\u5A92\u4F53\u3002");
      } catch (error) {
        log("\u9519\u8BEF\uFF1A" + error.message);
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
      button.querySelector("span").textContent = data.liked ? "\u5DF2\u8D5E" : "\u70B9\u8D5E";
    }
  }
  function renderComments(comments) {
    const list = byId("knowledgeCommentList");
    if (!list)
      return;
    list.innerHTML = comments?.length ? comments.map((comment) => `<article class="knowledge-comment"><div class="knowledge-comment-head"><span><span class="knowledge-comment-user">${escapeHtml(comment.username)}</span> \xB7 ${escapeHtml(new Date(comment.createdAt).toLocaleString("zh-CN", { hour12: false }))}</span>${comment.canDelete ? `<button class="knowledge-comment-delete" data-comment-id="${comment.id}" title="\u5220\u9664\u8BC4\u8BBA"><i class="fa-solid fa-trash"></i></button>` : ""}</div><div class="knowledge-comment-content">${escapeHtml(comment.content)}</div></article>`).join("") : '<div class="muted">\u6682\u65E0\u8BC4\u8BBA\uFF0C\u6765\u8BF4\u4E24\u53E5\u5427\u3002</div>';
  }
  async function request(path, options = {}) {
    const response = await fetch(apiUrl(path), { credentials: "include", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(data.error || "\u8BF7\u6C42\u5931\u8D25");
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
      return setMessage("\u8BF7\u8F93\u5165\u8BC4\u8BBA\u5185\u5BB9", true);
    try {
      await request(`/api/knowledge/${encodeURIComponent(id)}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      input.value = "";
      setMessage("\u8BC4\u8BBA\u5DF2\u53D1\u8868");
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
      setMessage("\u5DF2\u751F\u6210\u5E76\u590D\u5236\u7CFB\u7EDF\u5206\u4EAB\u94FE\u63A5");
    } catch (error) {
      setMessage(error.message, true);
    }
  });
  window.addEventListener("kb-detail-loaded", load);
  window.loadKnowledgeInteractions = load;
})();
