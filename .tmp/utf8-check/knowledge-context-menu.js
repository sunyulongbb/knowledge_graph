// public/assets/scripts/knowledge-context-menu.js
(function() {
  const trigger = document.getElementById("btnTableMore");
  if (!trigger)
    return;
  const menu = document.createElement("div");
  menu.id = "knowledgeContextMenu";
  menu.className = "knowledge-context-menu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "知识操作");
  menu.hidden = true;
  const summary = document.createElement("div");
  summary.className = "knowledge-context-summary";
  menu.append(summary);
  const setTypeButton = document.createElement("button");
  setTypeButton.type = "button";
  setTypeButton.className = "knowledge-menu-item";
  setTypeButton.setAttribute("role", "menuitem");
  setTypeButton.innerHTML = '<i class="fa-solid fa-sitemap" aria-hidden="true"></i><span>批量设置本体类型</span>';
  menu.append(setTypeButton);
  setTypeButton.dataset.submenu = "true";
  setTypeButton.setAttribute("aria-haspopup", "menu");
  setTypeButton.setAttribute("aria-expanded", "false");
  setTypeButton.insertAdjacentHTML("beforeend", '<span style="margin-left:auto">?</span>');
  const submenu = document.createElement("div");
  submenu.className = "knowledge-context-menu";
  submenu.hidden = true;
  submenu.setAttribute("role", "menu");
  submenu.setAttribute("aria-label", "选择本体类型");
  submenu.style.cssText = "position:fixed;max-height:60vh;overflow:auto;min-width:210px;max-width:320px";
  menu.append(submenu);
  let loadingTypes = false, settingType = false;
  const scopedUrl = (path) => {
    const url = new URL(path, location.origin);
    const db = window.getCurrentDbParam?.() || new URLSearchParams(location.search).get("db");
    if (db)
      url.searchParams.set("db", db);
    return url;
  };
  const request = async (url, options) => {
    const response = await fetch(url, options);
    if (!response.ok)
      throw new Error(await response.text() || `HTTP ${response.status}`);
    return response.json();
  };
  async function showTypes() {
    if (setTypeButton.disabled || loadingTypes || settingType)
      return;
    submenu.hidden = false;
    setTypeButton.setAttribute("aria-expanded", "true");
    const rect = setTypeButton.getBoundingClientRect();
    submenu.style.left = `${Math.max(8, rect.right + 220 > innerWidth ? rect.left - 220 : rect.right)}px`;
    submenu.style.top = `${Math.max(8, Math.min(rect.top, innerHeight - Math.min(innerHeight * 0.6, 400) - 8))}px`;
    submenu.textContent = "正在加载本体…";
    loadingTypes = true;
    try {
      const data = await request(scopedUrl("/api/kb/ontology/tree"));
      submenu.replaceChildren();
      const add = (items, depth = 0) => {
        for (const item of items) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "knowledge-menu-item";
          button.setAttribute("role", "menuitem");
          button.textContent = `${"　".repeat(depth)}${item.name}`;
          button.addEventListener("click", async () => {
            if (settingType)
              return;
            const ids = [...window.kbSelectedRowIds || []];
            if (!ids.length)
              return;
            settingType = true;
            setTypeButton.disabled = true;
            close();
            const notice = document.createElement("div");
            notice.className = "knowledge-context-menu";
            notice.setAttribute("role", "status");
            notice.style.cssText = "position:fixed;bottom:20px;right:20px;top:auto;left:auto;max-width:420px;white-space:pre-wrap";
            document.body.append(notice);
            const failures = [];
            let completed = 0;
            for (const id of ids) {
              notice.textContent = `正在设置本体类型 ${++completed}/${ids.length}…`;
              try {
                await request(scopedUrl("/api/kb/nodes/update"), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id, type: item.id })
                });
              } catch (error) {
                failures.push(`${id}?${error.message}`);
              }
            }
            notice.textContent = `设置完成：成功 ${ids.length - failures.length} 条，失败 ${failures.length} 条。`;
            if (failures.length)
              notice.append(document.createTextNode(`
` + failures.join(`
`)));
            const dismiss = document.createElement("button");
            dismiss.textContent = "关闭";
            dismiss.addEventListener("click", () => notice.remove());
            notice.append(dismiss);
            if (!failures.length)
              setTimeout(() => notice.remove(), 6000);
            settingType = false;
            setTypeButton.disabled = false;
            try {
              await window.loadTablePage?.();
            } catch (error) {
              console.error(error);
            }
          });
          submenu.append(button);
          add(item.children || [], depth + 1);
        }
      };
      add(data.items || []);
      if (!submenu.children.length)
        submenu.textContent = "当前应用暂无可用本体";
    } catch (error) {
      submenu.textContent = `加载失败：${error.message}`;
    } finally {
      loadingTypes = false;
    }
  }
  setTypeButton.addEventListener("click", showTypes);
  setTypeButton.addEventListener("mouseenter", () => {
    if (submenu.hidden)
      showTypes();
  });
  setTypeButton.addEventListener("keydown", async (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      await showTypes();
      submenu.querySelector("button")?.focus();
    }
  });
  for (const [id, label, icon, danger] of [
    ["btnManualClassify", "人工快速分类", "fa-tags"],
    ["btnJevClassify", "JEV 自动分类", "fa-wand-magic-sparkles"],
    ["btnDeleteSelected", "删除选中知识", "fa-trash-can", true],
    ["btnClearAllNodes", "清空知识列表", "fa-eraser", true]
  ]) {
    const button = document.getElementById(id);
    if (!button)
      continue;
    button.className = danger ? "knowledge-menu-item is-danger" : "knowledge-menu-item";
    button.setAttribute("role", "menuitem");
    button.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><span>${label}</span>`;
    menu.append(button);
  }
  document.body.append(menu);
  let returnFocus = trigger;
  function close(restore = false) {
    if (menu.hidden)
      return;
    submenu.hidden = true;
    setTypeButton.setAttribute("aria-expanded", "false");
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restore)
      returnFocus?.focus({ preventScroll: true });
  }
  function open(x, y, origin) {
    returnFocus = origin;
    window.ensureTableSelectedButtonsState?.();
    const count = window.kbSelectedRowIds?.size || 0;
    setTypeButton.disabled = !count || settingType;
    summary.textContent = count ? `已选 ${count} 条知识` : "未选择知识 · 人工分类处理当前页";
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    menu.style.left = `${Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8))}px`;
    menu.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
  }
  trigger.addEventListener("click", () => {
    if (!menu.hidden) {
      close(true);
      return;
    }
    const rect = trigger.getBoundingClientRect();
    open(rect.right - 240, rect.bottom + 6, trigger);
  });
  for (const host of [document.getElementById("entityManageRows")]) {
    if (!host)
      continue;
    host.addEventListener("contextmenu", (event) => {
      if (event.target.closest('input:not([type="checkbox"]), textarea, video, a, [contenteditable="true"]'))
        return;
      const row = event.target.closest("[data-id], .dhx_grid-row[data-dhx-id]");
      const id = row && host.contains(row) ? row.dataset.id || row.dataset.dhxId : "";
      event.preventDefault();
      event.stopPropagation();
      if (id)
        window.selectEntityManageContextRow?.(id);
      const origin = id ? row : host;
      origin.tabIndex = -1;
      const rect = origin.getBoundingClientRect();
      open(event.clientX || rect.left + 20, event.clientY || rect.top + 20, origin);
    }, true);
  }
  menu.addEventListener("click", (event) => {
    if (event.target.closest("button:not(:disabled)") && !event.target.closest("[data-submenu]"))
      close(true);
  }, true);
  menu.addEventListener("keydown", (event) => {
    const items = [...menu.querySelectorAll("button:not(:disabled)")];
    const index = items.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab")
      close(true);
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!menu.contains(event.target) && !trigger.contains(event.target))
      close();
  });
  document.addEventListener("focusin", (event) => {
    if (!menu.contains(event.target) && !trigger.contains(event.target))
      close();
  });
  document.addEventListener("scroll", (event) => {
    if (!menu.contains(event.target))
      close();
  }, true);
  window.addEventListener("resize", () => close());
  window.addEventListener("hashchange", () => close());
})();
