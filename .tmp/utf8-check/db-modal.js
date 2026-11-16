// public/assets/scripts/db-modal.js
(function() {
  function getUrlParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }
  function normalizeHashForDbSwitch(hash) {
    if (!hash)
      return hash;
    const rawHash = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!rawHash)
      return "";
    const questionIndex = rawHash.indexOf("?");
    let prefix = "";
    let hashBody = rawHash;
    if (questionIndex >= 0) {
      prefix = rawHash.slice(0, questionIndex);
      hashBody = rawHash.slice(questionIndex + 1);
    }
    const params = new URLSearchParams(hashBody);
    if (!params.has("node"))
      return hash;
    params.delete("node");
    const result = params.toString();
    if (prefix) {
      return result ? `#${prefix}?${result}` : `#${prefix}`;
    }
    return result ? `#${result}` : "";
  }
  function clearRouteSelectionState() {
    try {
      if (typeof window.resetFormToAdd === "function")
        window.resetFormToAdd();
    } catch (e) {}
    try {
      if (typeof window.resetAttrForm === "function")
        window.resetAttrForm();
    } catch (e) {}
    try {
      window.kbSelectedRowId = "";
    } catch (e) {}
    try {
      window.kbSelectedNodeId = "";
    } catch (e) {}
    try {
      window.kbSelectedRowIds = new Set;
    } catch (e) {}
    try {
      window.kbActiveDetailRouteId = "";
    } catch (e) {}
  }
  function setUrlParam(name, value) {
    const previousValue = getUrlParam(name) || "";
    const url = new URL(window.location.href);
    url.searchParams.set(name, value);
    if (name === "db" && previousValue !== String(value || "")) {
      url.searchParams.delete("node");
      url.searchParams.delete("type");
      url.searchParams.delete("class_id");
      url.searchParams.delete("page");
      url.searchParams.delete("order");
      url.hash = normalizeHashForDbSwitch(url.hash);
      clearRouteSelectionState();
    }
    try {
      window.dispatchEvent(new CustomEvent("kb:url-param-changed", {
        detail: { key: name, value: value || "", previousValue }
      }));
    } catch {}
    window.location.href = url.toString();
  }
  function getProjectDbId(project) {
    return String(project && (project.slug || project.name || project.file) || "").replace(/\.sqlite$/, "");
  }
  function ensureDbSelectActionButtons() {
    const modalContent = document.getElementById("dbSelectModalContent");
    if (!modalContent)
      return;
    let actionWrap = document.getElementById("dbSelectActions");
    if (!actionWrap) {
      actionWrap = document.createElement("div");
      actionWrap.id = "dbSelectActions";
      actionWrap.style.display = "flex";
      actionWrap.style.gap = "8px";
      actionWrap.style.justifyContent = "flex-end";
      actionWrap.style.alignItems = "center";
      actionWrap.style.marginTop = "4px";
      const switchBtn = document.createElement("button");
      switchBtn.id = "btnDbSelectSwitch";
      switchBtn.className = "btn btn-primary";
      switchBtn.type = "button";
      switchBtn.textContent = "切换选中";
      const delBtn = document.createElement("button");
      delBtn.id = "btnDbSelectDelete";
      delBtn.className = "btn";
      delBtn.type = "button";
      delBtn.textContent = "删除选中应用";
      delBtn.style.background = "#ef4444";
      delBtn.style.color = "#fff";
      delBtn.style.borderColor = "#ef4444";
      actionWrap.appendChild(switchBtn);
      actionWrap.appendChild(delBtn);
      modalContent.appendChild(actionWrap);
    }
  }
  function getSelectedModalProjectCard() {
    const wrap = document.getElementById("dbProjectListWrap");
    if (!wrap)
      return null;
    const selectedDb = (wrap.dataset.selected || "").trim();
    if (!selectedDb)
      return null;
    return wrap.querySelector(`.db-project-card[data-db="${selectedDb}"]`);
  }
  function removeProjectCardFromModal(dbId) {
    const wrap = document.getElementById("dbProjectListWrap");
    if (!wrap)
      return;
    const card = wrap.querySelector(`.db-project-card[data-db="${dbId}"]`);
    if (card) {
      try {
        card.remove();
      } catch {}
    }
    if ((wrap.dataset.selected || "") === dbId) {
      wrap.dataset.selected = "";
    }
  }
  function removeProjectEntryFromSidebar(dbId) {
    try {
      document.querySelectorAll(`.project-entry[data-db="${dbId}"]`).forEach((entry) => {
        try {
          entry.remove();
        } catch {}
      });
    } catch {}
  }
  async function switchSelectedProjectFromModal() {
    const wrap = document.getElementById("dbProjectListWrap");
    const err = document.getElementById("dbSelectError");
    if (!wrap)
      return;
    const dbId = (wrap.dataset.selected || "").trim();
    if (!dbId) {
      if (err) {
        err.textContent = "请先选中一个应用";
        err.style.display = "";
      }
      return;
    }
    try {
      addModalProjectsToSidebar(Array.from(wrap.querySelectorAll(".db-project-card")).map((card) => ({
        slug: card.dataset.db || "",
        title: card.dataset.title || "",
        description: card.dataset.desc || ""
      })));
    } catch {}
    try {
      hideDbSelectModal();
    } catch {}
    setUrlParam("db", dbId);
  }
  async function deleteSelectedProjectFromModal() {
    const wrap = document.getElementById("dbProjectListWrap");
    const err = document.getElementById("dbSelectError");
    const deleteBtn = document.getElementById("btnDbSelectDelete");
    const switchBtn = document.getElementById("btnDbSelectSwitch");
    if (!wrap)
      return;
    const card = getSelectedModalProjectCard();
    if (!card) {
      if (err) {
        err.textContent = "请先选中一个应用";
        err.style.display = "";
      }
      return;
    }
    const dbId = (card.dataset.db || "").trim();
    if (card.dataset.owner !== "true") {
      if (err) {
        err.textContent = "仅创建者可以删除应用";
        err.style.display = "";
      }
      return;
    }
    const title = (card.dataset.title || dbId || "").trim();
    if (!dbId)
      return;
    const warning = `确认删除应用“${title}”？
删除后将同时清空该应用下的实体、关系、本体、属性等数据，且不可恢复。`;
    if (!window.confirm(warning))
      return;
    const typed = window.prompt(`请输入应用名称以确认删除：${title}`, "");
    if (typed === null)
      return;
    const confirmName = typed.trim();
    if (!confirmName) {
      if (err) {
        err.textContent = "删除失败：请输入应用名称";
        err.style.display = "";
      }
      return;
    }
    try {
      if (err)
        err.style.display = "none";
      if (deleteBtn)
        deleteBtn.disabled = true;
      if (switchBtn)
        switchBtn.disabled = true;
      const resp = await fetch("/api/kb/delete_project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: dbId, confirmName })
      });
      const text = await resp.text();
      let payload = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }
      if (!resp.ok || !payload?.success) {
        throw new Error(payload && payload.message || text || `HTTP ${resp.status}`);
      }
      removeProjectCardFromModal(dbId);
      removeProjectEntryFromSidebar(dbId);
      try {
        if (typeof window.showToast === "function") {
          window.showToast("应用已删除", "success");
        }
      } catch {}
      const remain = wrap.querySelectorAll(".db-project-card").length;
      if (!remain && err) {
        err.textContent = "No available projects yet.";
        err.style.display = "";
      }
    } catch (e) {
      if (err) {
        err.textContent = "删除失败: " + (e.message || e);
        err.style.display = "";
      }
    } finally {
      if (deleteBtn)
        deleteBtn.disabled = false;
      if (switchBtn)
        switchBtn.disabled = false;
    }
  }
  function bindDbSelectActionButtons() {
    ensureDbSelectActionButtons();
    const switchBtn = document.getElementById("btnDbSelectSwitch");
    const deleteBtn = document.getElementById("btnDbSelectDelete");
    if (switchBtn && !switchBtn._boundDbSwitch) {
      switchBtn._boundDbSwitch = true;
      switchBtn.addEventListener("click", () => {
        switchSelectedProjectFromModal();
      });
    }
    if (deleteBtn && !deleteBtn._boundDbDelete) {
      deleteBtn._boundDbDelete = true;
      deleteBtn.addEventListener("click", () => {
        deleteSelectedProjectFromModal();
      });
    }
  }
  async function loadProjectListToModal(selectedDb) {
    const wrap = document.getElementById("dbProjectListWrap");
    const err = document.getElementById("dbSelectError");
    if (!wrap || !err)
      return;
    wrap.innerHTML = "";
    err.style.display = "none";
    let items = [];
    try {
      const resp = await fetch("/api/kb/list_projects");
      if (!resp.ok)
        throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      items = Array.isArray(data.projects) ? data.projects : [];
      const currentDb = getUrlParam("db");
      items = items.filter((it) => getProjectDbId(it) !== currentDb);
      if (!items.length) {
        err.textContent = "No available projects yet.";
        err.style.display = "";
        return;
      }
      let selected = selectedDb || "";
      const searchEl = document.getElementById("dbProjectSearch");
      if (searchEl) {
        searchEl.value = "";
        searchEl.oninput = () => {
          const q = searchEl.value.trim().toLowerCase();
          let visible = 0;
          Array.from(wrap.children).forEach((c) => {
            const title = (c.dataset.title || "").toLowerCase();
            const desc = (c.dataset.desc || "").toLowerCase();
            if (q && !(title.includes(q) || desc.includes(q))) {
              c.style.display = "none";
            } else {
              c.style.display = "";
              visible++;
            }
          });
          if (visible === 0) {
            err.textContent = "No matching project.";
            err.style.display = "";
          } else {
            err.style.display = "none";
          }
        };
      }
      const esc = (s) => String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[c]);
      items.forEach((it) => {
        const dbId = getProjectDbId(it);
        const titleText = it.title ? it.title : dbId;
        const descText = it.desc || it.description || "";
        const isSelected = selected === dbId;
        const card = document.createElement("div");
        card.className = "db-project-card" + (isSelected ? " selected" : "");
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.dataset.db = dbId;
        card.dataset.owner = String(!!it.owner);
        card.dataset.title = titleText;
        card.dataset.desc = descText;
        card.dataset.link = it.link || "";
        let avatarHtml = "";
        if (it.image && typeof it.image === "string" && it.image.trim()) {
          avatarHtml = `<div class='db-avatar' style='background:#fff url(${it.image}) center/cover no-repeat;background-size:cover;'></div>`;
        } else {
          const src = (it.title || dbId || "").replace(/\s+/g, "");
          let initials = src ? src[0].toUpperCase() : "?";
          if (src.length > 1)
            initials += src[1];
          avatarHtml = `<div class='db-avatar' style='background:#e0e7ef;color:#4f46e5;'>${initials}</div>`;
        }
        let linkHtml = "";
        if (it.link && typeof it.link === "string" && it.link.trim()) {
          linkHtml = `<a class="project-link-btn" href="${esc(it.link)}" target="_blank" title="外部链接" style="margin-left:6px;vertical-align:middle;display:inline-block;" onclick="event.stopPropagation();event.preventDefault();window.open('${esc(it.link)}','_blank');return false;"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 12.5L15 5M15 5H9M15 5V11" stroke="#4f46e5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></a>`;
        }
        card.innerHTML = `
          ${avatarHtml}
          <div class='db-project-title' title='${esc(titleText)}'>${esc(titleText)}${linkHtml}</div>
          ${descText ? `<div class='db-project-desc' title='${esc(descText)}'>${esc(descText)}</div>` : ""}
          <div class='db-project-id'>${esc(dbId)}</div>
        `;
        card.onclick = () => {
          selected = dbId;
          Array.from(wrap.children).forEach((c) => c.classList.remove("selected"));
          card.classList.add("selected");
          wrap.dataset.selected = dbId;
          card.setAttribute("aria-selected", "true");
        };
        card.ondblclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            addModalProjectsToSidebar(items);
          } catch {}
          try {
            (window.setSidebarCollapsed || setSidebarCollapsed)(true, false);
          } catch {}
          try {
            hideDbSelectModal();
          } catch {}
          setUrlParam("db", dbId);
        };
        card.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") {
            card.click();
          }
        };
        if (isSelected) {
          setTimeout(() => {
            card.focus();
          }, 0);
          wrap.dataset.selected = dbId;
        }
        wrap.appendChild(card);
      });
    } catch (e) {
      err.textContent = "Load failed: " + (e.message || e);
      err.style.display = "";
    }
    try {
      addModalProjectsToSidebar(items);
    } catch {}
  }
  function addModalProjectsToSidebar(items) {
    try {
      if (!Array.isArray(items) || !items.length)
        return;
      const wrap = document.querySelector(".project-list");
      if (!wrap)
        return;
      try {
        const first = wrap.firstElementChild;
        if (first && first.classList && first.classList.contains("muted")) {
          first.remove();
        }
      } catch {}
      const currentDb = getUrlParam("db") || "";
      for (let i = items.length - 1;i >= 0; i--) {
        const it = items[i];
        const dbId = getProjectDbId(it);
        if (!dbId || dbId === currentDb)
          continue;
        if (wrap.querySelector(`.project-entry[data-db="${dbId}"]`))
          continue;
        const entry = document.createElement("a");
        entry.className = "project-entry";
        entry.href = "#";
        entry.setAttribute("data-db", dbId);
        entry.setAttribute("data-image", it.image || "");
        entry.setAttribute("data-title", it.title || "");
        entry.setAttribute("data-desc", it.desc || it.description || "");
        entry.setAttribute("data-link", it.link || "");
        const title = it.title ? it.title : dbId;
        entry.title = title + " (double click to edit)";
        entry.setAttribute("aria-label", title);
        entry.tabIndex = 0;
        if (it.image && typeof it.image === "string" && it.image.trim()) {
          const img = document.createElement("span");
          img.className = "project-avatar-img";
          img.style.backgroundImage = `url(${it.image})`;
          entry.appendChild(img);
        } else {
          const initials = (it.title || dbId || "?").replace(/\s+/g, "").slice(0, 2).toUpperCase() || "?";
          const span = document.createElement("span");
          span.className = "project-initials";
          span.textContent = initials;
          entry.appendChild(span);
        }
        if (it.link && typeof it.link === "string" && it.link.trim()) {
          const linkBtn = document.createElement("a");
          linkBtn.className = "project-link-btn";
          linkBtn.href = it.link;
          linkBtn.target = "_blank";
          linkBtn.title = "外部链接";
          linkBtn.style.marginLeft = "6px";
          linkBtn.style.verticalAlign = "middle";
          linkBtn.style.display = "inline-block";
          linkBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 12.5L15 5M15 5H9M15 5V11" stroke="#4f46e5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
          linkBtn.onclick = function(e) {
            e.stopPropagation();
          };
          entry.appendChild(linkBtn);
        }
        const label = document.createElement("span");
        label.className = "project-entry-label";
        try {
          const base = (title || dbId || "").toString().trim();
          label.dataset.full = base;
          label.dataset.short = Array.from(base).slice(0, 3).join("");
          label.textContent = base;
          label.title = base;
          const sidebarEl = document.getElementById("projectSidebar");
          const isCollapsed = sidebarEl && sidebarEl.classList.contains("collapsed");
          label.setAttribute("aria-hidden", String(!!isCollapsed));
        } catch {
          label.textContent = title;
        }
        entry.appendChild(label);
        entry.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (entry._clickTimer)
            return;
          entry._clickTimer = setTimeout(() => {
            entry._clickTimer = null;
            try {
              selectProjectWithAnimation(dbId, entry, title, entry.getAttribute("data-image") || "");
            } catch {
              try {
                setUrlParam("db", dbId);
              } catch {}
            }
          }, 260);
        });
        entry.addEventListener("dblclick", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (entry._clickTimer) {
            clearTimeout(entry._clickTimer);
            entry._clickTimer = null;
          }
          try {
            updateHeaderProjectInfo(dbId, title, entry.getAttribute("data-image") || "");
          } catch {}
          openEditProjectModal(dbId, entry.getAttribute("data-title") || "", entry.getAttribute("data-image") || "", entry.getAttribute("data-desc") || "");
        });
        entry.addEventListener("keydown", (e) => {
          const key = e.key || e.keyCode;
          if (key === "Enter" || key === 13) {
            e.preventDefault();
            try {
              selectProjectWithAnimation(dbId, entry, title, entry.getAttribute("data-image") || "");
            } catch {
              try {
                setUrlParam("db", dbId);
              } catch {}
            }
          }
        });
        try {
          wrap.insertBefore(entry, wrap.firstChild);
        } catch {
          wrap.appendChild(entry);
        }
      }
    } catch (e) {
      console.warn("addModalProjectsToSidebar failed", e);
    }
  }
  async function showAppLogoSwitcher() {
    let dialog = document.getElementById("appLogoSwitcher");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "appLogoSwitcher";
      dialog.className = "app-logo-switcher";
      dialog.setAttribute("aria-label", "切换应用");
      document.body.appendChild(dialog);
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog)
          dialog.close();
      });
    }
    dialog.replaceChildren();
    const close = document.createElement("button");
    close.className = "app-logo-switcher-close";
    close.textContent = "×";
    close.setAttribute("aria-label", "关闭");
    close.onclick = () => dialog.close();
    const heading = document.createElement("h2");
    heading.textContent = "选择应用";
    const grid = document.createElement("div");
    grid.className = "app-logo-switcher-grid";
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.textContent = "正在加载…";
    dialog.append(close, heading, grid, status);
    if (!dialog.open)
      dialog.showModal();
    try {
      const response = await fetch("/api/kb/list_projects");
      if (!response.ok)
        throw new Error("加载失败，请关闭后重试");
      const data = await response.json();
      const saveProject = async (project, changes) => {
        const response2 = await fetch("/api/kb/update_project", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...project, name: getProjectDbId(project), title: project.title || project.name, ...changes })
        });
        if (!response2.ok)
          throw new Error(await response2.text());
        Object.assign(project, changes);
        window.dispatchEvent(new CustomEvent("kb-application-updated", { detail: project }));
        window.loadProjectsToSidebar?.();
      };
      for (const project of data.projects || []) {
        const db = getProjectDbId(project);
        if (!db)
          continue;
        const name = project.title || project.name || db;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "app-logo-switcher-item";
        button.title = name;
        button.setAttribute("aria-label", name);
        if (db === getUrlParam("db"))
          button.setAttribute("aria-current", "true");
        const tile = document.createElement("span");
        tile.className = "app-logo-switcher-tile";
        tile.textContent = Array.from(name).slice(0, 2).join("");
        const logo = String(project.image || project.logo || project.img || "").trim();
        if (logo) {
          try {
            const url = new URL(logo, location.href);
            if (["http:", "https:"].includes(url.protocol) || /^data:image\/(?:png|jpe?g|gif|webp|avif|svg\+xml);/i.test(logo)) {
              const img = document.createElement("img");
              img.src = url.href;
              img.alt = "";
              img.onerror = () => img.remove();
              tile.appendChild(img);
            }
          } catch {}
        }
        button.appendChild(tile);
        button.onclick = () => {
          dialog.close();
          if (db !== getUrlParam("db"))
            setUrlParam("db", db);
        };
        const card = document.createElement("div");
        card.style.cssText = "position:relative;display:flex;flex-direction:column;align-items:center;gap:14px";
        card.append(button);
        const label2 = document.createElement("button");
        label2.type = "button";
        label2.textContent = name;
        label2.style.cssText = "background:none;border:0;color:inherit;max-width:150px;overflow-wrap:anywhere;cursor:pointer";
        label2.disabled = !project.editSettings;
        label2.title = project.editSettings ? "点击重命名" : name;
        label2.onclick = () => {
          const input = document.createElement("input");
          input.value = project.title || name;
          input.maxLength = 100;
          input.style.cssText = "width:140px;padding:6px";
          label2.replaceWith(input);
          input.focus();
          input.select();
          let done = false;
          const finish = async (cancel = false) => {
            if (done)
              return;
            done = true;
            const title = input.value.trim();
            input.disabled = true;
            try {
              if (!cancel && title && title !== project.title)
                await saveProject(project, { title });
              label2.textContent = project.title || name;
              status.textContent = "";
            } catch (error) {
              status.textContent = `重命名失败：${error.message}`;
            }
            input.replaceWith(label2);
          };
          input.onblur = () => void finish();
          input.onkeydown = (event) => {
            if (event.key === "Enter" || event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              finish(event.key === "Escape");
            }
          };
        };
        card.append(label2);
        if (project.editSettings) {
          const upload = document.createElement("button");
          upload.type = "button";
          upload.textContent = "↑";
          upload.title = "上传 Logo";
          upload.setAttribute("aria-label", `上传 ${name} 的 Logo`);
          upload.style.cssText = "position:absolute;right:-10px;top:-10px;border:1px solid #777;border-radius:50%;width:30px;height:30px;background:#30303d;color:white;cursor:pointer";
          const file = document.createElement("input");
          file.type = "file";
          file.accept = "image/*";
          file.hidden = true;
          upload.onclick = () => file.click();
          file.onchange = async () => {
            const image = file.files?.[0];
            if (!image)
              return;
            if (!image.type.startsWith("image/") || image.size > 20 * 1024 * 1024) {
              status.textContent = "请选择不超过 20MB 的图片";
              return;
            }
            upload.disabled = true;
            status.textContent = "正在上传 Logo…";
            try {
              const form = new FormData;
              form.append("file", image);
              const response2 = await fetch(`/api/kb/upload-image?db=${encodeURIComponent(db)}`, { method: "POST", body: form });
              if (!response2.ok)
                throw new Error(await response2.text());
              const result = await response2.json();
              if (!result.url)
                throw new Error("未返回图片地址");
              await saveProject(project, { image: result.url });
              tile.querySelector("img")?.remove();
              const img = document.createElement("img");
              img.src = result.url;
              img.alt = "";
              tile.append(img);
              status.textContent = "Logo 已更新";
            } catch (error) {
              status.textContent = `上传失败：${error.message}`;
            } finally {
              upload.disabled = false;
              file.value = "";
            }
          };
          card.append(upload, file);
        }
        grid.appendChild(card);
      }
      status.textContent = grid.children.length ? "" : "暂无可切换的应用";
      const create = document.createElement("button");
      create.type = "button";
      create.className = "app-logo-switcher-item";
      create.title = "创建应用";
      create.setAttribute("aria-label", "创建应用");
      const plus = document.createElement("span");
      plus.className = "app-logo-switcher-tile";
      plus.textContent = "＋";
      plus.style.fontSize = "36px";
      const label = document.createElement("span");
      label.textContent = "创建应用";
      create.append(plus, label);
      create.onclick = async () => {
        create.disabled = true;
        status.textContent = "正在创建应用…";
        try {
          const response2 = await fetch("/api/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "新应用" }) });
          const result = await response2.json();
          if (!response2.ok)
            throw new Error(result.error || "创建失败");
          window.dispatchEvent(new CustomEvent("kb-application-updated", { detail: result.project }));
          window.loadProjectsToSidebar?.();
          await showAppLogoSwitcher();
        } catch (error) {
          status.textContent = `创建失败：${error.message}`;
        } finally {
          create.disabled = false;
        }
      };
      grid.append(create);
    } catch (error) {
      status.textContent = error.message;
    }
  }
  window.showAppLogoSwitcher = showAppLogoSwitcher;
  function showDbSelectModal() {
    const modal = document.getElementById("dbSelectModal");
    if (!modal)
      return;
    if (modal.parentElement !== document.body)
      document.body.appendChild(modal);
    bindDbSelectActionButtons();
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    loadProjectListToModal(getUrlParam("db"));
    setTimeout(() => {
      const s = document.getElementById("dbProjectSearch");
      if (s)
        s.focus();
    }, 80);
    try {
      document.body.style.overflow = "hidden";
    } catch {}
    try {
      if (!modal._backdropHandler) {
        modal._backdropHandler = (e) => {
          if (e.target === modal)
            hideDbSelectModal();
        };
        modal.addEventListener("click", modal._backdropHandler);
      }
    } catch {}
    try {
      if (!modal._escHandler) {
        modal._escHandler = (ev) => {
          if (ev.key === "Escape")
            hideDbSelectModal();
        };
        document.addEventListener("keydown", modal._escHandler);
      }
    } catch {}
  }
  function hideDbSelectModal() {
    const modal = document.getElementById("dbSelectModal");
    if (modal) {
      modal.style.display = "none";
      try {
        document.body.style.overflow = "";
      } catch {}
      try {
        if (modal._escHandler) {
          document.removeEventListener("keydown", modal._escHandler);
          modal._escHandler = null;
        }
      } catch {}
      try {
        if (modal._backdropHandler) {
          modal.removeEventListener("click", modal._backdropHandler);
          modal._backdropHandler = null;
        }
      } catch {}
    }
  }
  async function loadDbList() {
    const dbSwitcher = document.getElementById("dbSwitcher");
    if (!dbSwitcher)
      return;
    try {
      const resp = await fetch("/api/kb/list_projects");
      const data = await resp.json();
      if (Array.isArray(data.projects)) {
        data.projects.forEach((p) => {
          const projectName = typeof p === "string" ? p.replace(/\.sqlite$/, "") : (p.slug || p.name || p.file || "").toString().replace(/\.sqlite$/, "");
          const title = typeof p === "object" && p.title ? p.title : projectName;
          const opt = document.createElement("option");
          opt.value = projectName;
          opt.textContent = title + (projectName !== title ? ` (${projectName})` : "");
          dbSwitcher.appendChild(opt);
        });
        const params = new URLSearchParams(window.location.search);
        const dbName = params.get("db");
        if (dbName) {
          dbSwitcher.value = dbName;
          const found = data.projects.find((p) => (typeof p === "string" ? p.replace(/\.sqlite$/, "") : (p.slug || p.name || p.file || "").toString().replace(/\.sqlite$/, "")) === dbName);
          if (found) {
            const currentTitle = typeof found === "object" && found.title ? found.title : dbName;
            try {
              const img = typeof found === "object" && (found.image || found.img) ? found.image || found.img : "";
              updateHeaderProjectInfo(dbName, currentTitle, img);
            } catch {}
          }
        }
      }
    } catch {}
    const mainTitle = document.getElementById("mainTitle");
    if (mainTitle) {
      mainTitle.innerHTML = '<span style="color:#222;">Knowledge Graph</span>';
      try {
        updateSidebarLabelMode();
      } catch {}
    }
  }
  function initDbSwitcher() {
    document.addEventListener("DOMContentLoaded", loadDbList);
    const btnRefreshDbList = document.getElementById("btnRefreshDbList");
    if (btnRefreshDbList)
      btnRefreshDbList.onclick = loadDbList;
    const dbSwitcher = document.getElementById("dbSwitcher");
    if (dbSwitcher) {
      dbSwitcher.onchange = async function() {
        const name = dbSwitcher.value;
        if (!name)
          return;
        try {
          const resp = await fetch(`/api/kb/create_project?name=${encodeURIComponent(name.replace(/\.sqlite$/, ""))}`);
          const text = await resp.text();
          let data = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch {
            data = null;
          }
          if (!resp.ok) {
            alert(data && data.message ? data.message : text || `Switch failed: HTTP ${resp.status}`);
            return;
          }
          if (data && data.success) {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set("db", name.replace(/\.sqlite$/, ""));
            nextUrl.searchParams.delete("node");
            nextUrl.searchParams.delete("view");
            nextUrl.hash = "view=app_home";
            window.location.href = nextUrl.toString();
          } else {
            alert(data && data.message ? data.message : "Switch failed");
          }
        } catch {
          alert("Switch failed");
        }
      };
    }
  }
  function initFirstNodeSelection() {
    document.addEventListener("DOMContentLoaded", function() {
      if (window.kbCy && typeof window.kbCy.nodes === "function") {
        setTimeout(function() {
          const route = typeof window.getRouteStateFromHash === "function" ? window.getRouteStateFromHash() : null;
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#\??/, ""));
          if (route?.node || hashParams.get("node") || getUrlParam("node") || window.kbSelectedRowId)
            return;
          const nodes = window.kbCy.nodes();
          if (nodes && nodes.length > 0) {
            nodes[0].select();
            window.kbCy.center(nodes[0]);
          }
        }, 500);
      }
    });
  }
  function initDbParamBootstrap() {
    document.addEventListener("DOMContentLoaded", async function() {
      const params = new URLSearchParams(window.location.search);
      const dbName = params.get("db");
      if (dbName) {
        try {
          const resp = await fetch(`/api/kb/create_project?name=${encodeURIComponent(dbName)}`);
          const text = await resp.text();
          try {
            JSON.parse(text || "null");
          } catch {}
        } catch {}
      }
    });
  }
  function initProjectCreationModal() {
    const btnCreateProject = document.getElementById("btnCreateProject");
    const createProjectModal = document.getElementById("createProjectModal");
    const inputProjectName = document.getElementById("inputProjectName");
    const btnCancelCreateProject = document.getElementById("btnCancelCreateProject");
    const createProjectError = document.getElementById("createProjectError");
    const inputProjectTitle = document.getElementById("inputProjectTitle");
    const inputProjectDesc = document.getElementById("inputProjectDesc");
    const inputProjectLink = document.getElementById("inputProjectCreateLink");
    const inputProjectImageFile = document.getElementById("inputProjectCreateImageFile");
    const imagePreviewWrap = document.getElementById("createProjectImagePreview");
    const imagePreviewImg = document.getElementById("createProjectImagePreviewImg");
    const imageClearBtn = document.getElementById("createProjectImageClearBtn");
    function generateProjectDbName() {
      const now = new Date;
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const rand = Math.random().toString(36).slice(2, 8);
      return `project_${y}${m}${d}_${rand}`;
    }
    function openCreateProjectModal() {
      if (!createProjectModal)
        return;
      document.body.appendChild(createProjectModal);
      createProjectModal.style.display = "flex";
      try {
        if (inputProjectName)
          inputProjectName.value = generateProjectDbName();
        if (inputProjectTitle)
          inputProjectTitle.value = "";
        if (inputProjectDesc)
          inputProjectDesc.value = "";
        if (inputProjectLink)
          inputProjectLink.value = "";
        if (inputProjectImageFile)
          inputProjectImageFile.value = "";
        if (imagePreviewWrap)
          imagePreviewWrap.style.display = "none";
        if (imagePreviewImg)
          imagePreviewImg.src = "";
      } catch {}
      if (inputProjectImageFile && imagePreviewWrap && imagePreviewImg && imageClearBtn) {
        inputProjectImageFile.onchange = function(e) {
          const file = e.target.files && e.target.files[0];
          if (file) {
            const reader = new FileReader;
            reader.onload = function(ev) {
              imagePreviewImg.src = ev.target.result;
              imagePreviewWrap.style.display = "flex";
            };
            reader.readAsDataURL(file);
          } else {
            imagePreviewImg.src = "";
            imagePreviewWrap.style.display = "none";
          }
        };
        imageClearBtn.onclick = function() {
          inputProjectImageFile.value = "";
          imagePreviewImg.src = "";
          imagePreviewWrap.style.display = "none";
        };
      }
      try {
        if (createProjectError)
          createProjectError.style.display = "none";
      } catch {}
    }
    if (btnCreateProject && createProjectModal) {
      btnCreateProject.onclick = openCreateProjectModal;
    }
    if (btnCancelCreateProject && createProjectModal) {
      btnCancelCreateProject.onclick = () => {
        createProjectModal.style.display = "none";
      };
    }
    window.openCreateProjectModal = openCreateProjectModal;
    const btnSubmitCreateProject = document.getElementById("btnSubmitCreateProject");
    if (btnSubmitCreateProject) {
      btnSubmitCreateProject.onclick = async function() {
        if (!inputProjectName || !inputProjectTitle)
          return;
        const name = inputProjectName.value.trim();
        const title = inputProjectTitle.value.trim();
        const desc = inputProjectDesc ? inputProjectDesc.value.trim() : "";
        const link = inputProjectLink ? inputProjectLink.value.trim() : "";
        let image = "";
        if (inputProjectImageFile && inputProjectImageFile.files && inputProjectImageFile.files[0]) {
          image = await new Promise((resolve) => {
            const reader = new FileReader;
            reader.onload = (ev) => resolve(ev.target.result);
            reader.readAsDataURL(inputProjectImageFile.files[0]);
          });
        }
        if (!name || !title) {
          if (createProjectError) {
            createProjectError.textContent = "项目名称和展示名称不能为空";
            createProjectError.style.display = "block";
          }
          return;
        }
        if (createProjectError)
          createProjectError.style.display = "none";
        try {
          const resp = await fetch("/api/kb/create_project", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              title,
              description: desc,
              link,
              image
            })
          });
          const data = await resp.json();
          if (!resp.ok || !data.success) {
            if (createProjectError) {
              createProjectError.textContent = data.message || "创建失败";
              createProjectError.style.display = "block";
            }
            return;
          }
          window.location.reload();
        } catch (e) {
          if (createProjectError) {
            createProjectError.textContent = "网络错误或服务器异常";
            createProjectError.style.display = "block";
          }
        }
      };
    }
  }
  function initDbModalStartup() {
    document.addEventListener("DOMContentLoaded", () => {
      try {
        bindDbSelectActionButtons();
      } catch {}
      const oldDbSwitcher = document.getElementById("dbSwitcher");
      if (oldDbSwitcher && oldDbSwitcher.parentElement) {
        oldDbSwitcher.parentElement.remove();
      }
      const oldRefresh = document.getElementById("btnRefreshDbList");
      if (oldRefresh)
        oldRefresh.remove();
      try {
        const am = document.getElementById("authModal");
        if (am && am.parentElement !== document.body) {
          document.body.appendChild(am);
          try {
            am.style.zIndex = "99999";
          } catch {}
        }
      } catch {}
    });
  }
  window.getUrlParam = getUrlParam;
  window.setUrlParam = setUrlParam;
  window.loadProjectListToModal = loadProjectListToModal;
  window.addModalProjectsToSidebar = addModalProjectsToSidebar;
  window.showDbSelectModal = showDbSelectModal;
  window.hideDbSelectModal = hideDbSelectModal;
  window.loadDbList = loadDbList;
  window.addEventListener("kb:url-param-changed", (event) => {
    const detail = event && event.detail ? event.detail : {};
    if ((detail.key || "") === "db" && detail.previousValue !== detail.value) {
      try {
        if (typeof window.resetFormToAdd === "function")
          window.resetFormToAdd();
      } catch (e) {}
      try {
        if (typeof window.resetAttrForm === "function")
          window.resetAttrForm();
      } catch (e) {}
    }
  });
  window.addEventListener("popstate", () => {
    try {
      if (typeof window.resetFormToAdd === "function")
        window.resetFormToAdd();
    } catch (e) {}
    try {
      if (typeof window.resetAttrForm === "function")
        window.resetAttrForm();
    } catch (e) {}
  });
  initDbSwitcher();
  initFirstNodeSelection();
  initDbParamBootstrap();
  initProjectCreationModal();
  initDbModalStartup();
})();
