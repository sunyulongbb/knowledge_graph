// public/assets/scripts/entity-manage-table.js
(function() {
  const byId = (id) => document.getElementById(id);
  const selected = new Set;
  let entityGrid = null;
  let renderedRows = [];
  const normalizeId = (node) => String(node?._id || node?.id || "").replace(/^entity\//, "").trim();
  const imageOf = (node) => {
    const valuesOf = (value) => {
      if (Array.isArray(value))
        return value.flatMap(valuesOf);
      if (value && typeof value === "object")
        return valuesOf(value.url || value.src || "");
      if (typeof value !== "string" || !value.trim())
        return [];
      const source = value.trim();
      if (/^data:image\//i.test(source))
        return [source];
      try {
        const parsed = JSON.parse(source);
        if (parsed !== source)
          return valuesOf(parsed);
      } catch {}
      return source.split(/[\n,，;；]+/).map((item) => item.trim()).filter(Boolean);
    };
    return [node?.image, node?.cover, node?.images, node?.covers].flatMap(valuesOf)[0] || "";
  };
  const imageCell = (node) => {
    const url = imageOf(node);
    return url ? `<img class="entity-manage-image" src="${escapeHtml(url)}" alt="" loading="lazy" onerror="this.remove()">` : "";
  };
  const labelOf = (node) => String(node?.label_zh || node?.label || node?.name || "未命名实体").trim();
  const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const scopedUrl = (path) => {
    const url = new URL(path, window.location.origin);
    const next = typeof window.appendCurrentDbParam === "function" ? window.appendCurrentDbParam(url) : url;
    return String(next instanceof URL ? next : url);
  };
  const nodes = () => (Array.isArray(window.kbTableNodes) ? window.kbTableNodes : []).filter((node) => normalizeId(node));
  function globalIdFor(localId) {
    const node = nodes().find((item) => normalizeId(item) === localId);
    return String(node?._id || node?.id || localId || "").trim();
  }
  function hydrateSelectionFromRoute() {
    const routeId = (() => {
      try {
        const route = window.getRouteStateFromHash?.() || {};
        if (route.node)
          return String(route.node);
      } catch {}
      try {
        return new URL(window.location.href).searchParams.get("node") || "";
      } catch {
        return "";
      }
    })();
    const activeId = normalizeId({
      id: routeId || window.kbSelectedRowId || window.kbSelectedNodeId || window.kbCurrentNodeId || ""
    });
    selected.clear();
    if (activeId && nodes().some((node) => normalizeId(node) === activeId)) {
      selected.add(activeId);
    }
  }
  function syncGlobalSelection(primaryLocalId = "") {
    const globalIds = [...selected].map(globalIdFor).filter(Boolean);
    const primaryId = globalIdFor(primaryLocalId) || globalIds[0] || "";
    if (typeof window.setTableSelection === "function") {
      window.setTableSelection(primaryId, true);
    } else {
      window.kbSelectedRowId = primaryId;
      window.kbSelectedNodeId = primaryId;
      window.kbCurrentNodeId = primaryId;
    }
    window.kbSelectedRowIds = new Set(globalIds);
    window.kbSelectedRowId = primaryId;
    window.kbSelectedNodeId = primaryId;
    window.kbCurrentNodeId = primaryId;
    window.kbLastAnchorRowId = primaryId;
    window.updateSelectedRowStyles?.();
    window.syncCheckboxStates?.();
    window.ensureTableSelectedButtonsState?.();
  }
  window.selectEntityManageContextRow = (id) => {
    const localId = normalizeId({ id });
    if (!selected.has(localId)) {
      selected.clear();
      selected.add(localId);
      entityGrid?.setSelectedRows(selected);
      syncGlobalSelection(localId);
      updateCount();
    }
  };
  const selectionHost = byId("entityManageRows");
  if (selectionHost) {
    let gesture = null;
    let suppressClick = false;
    const finish = () => {
      if (!gesture)
        return;
      clearTimeout(gesture.timer);
      if (gesture.active) {
        suppressClick = true;
        setTimeout(() => {
          suppressClick = false;
        }, 0);
        syncGlobalSelection([...selected][0] || "");
        updateCount();
      }
      gesture.box?.remove();
      document.body.style.userSelect = gesture.userSelect;
      gesture = null;
    };
    selectionHost.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.pointerType !== "mouse" || event.target.closest('button,input,select,textarea,a,video,[contenteditable="true"],.dhx_grid-header'))
        return;
      finish();
      const state = {
        x: event.clientX,
        y: event.clientY,
        active: false,
        base: new Set(event.ctrlKey || event.metaKey ? selected : []),
        userSelect: document.body.style.userSelect
      };
      gesture = state;
      state.timer = setTimeout(() => {
        if (gesture !== state)
          return;
        state.active = true;
        document.body.style.userSelect = "none";
        window.getSelection()?.removeAllRanges();
        state.box = document.createElement("div");
        state.box.style.cssText = "position:fixed;pointer-events:none;z-index:10000;border:1px solid #3b82f6;background:rgba(59,130,246,.15)";
        document.body.append(state.box);
      }, 300);
    }, true);
    document.addEventListener("pointermove", (event) => {
      const state = gesture;
      if (!state)
        return;
      if (!state.active) {
        if (Math.hypot(event.clientX - state.x, event.clientY - state.y) > 6)
          finish();
        return;
      }
      event.preventDefault();
      const left = Math.min(state.x, event.clientX), top = Math.min(state.y, event.clientY);
      const right = Math.max(state.x, event.clientX), bottom = Math.max(state.y, event.clientY);
      Object.assign(state.box.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
      const bounds = selectionHost.getBoundingClientRect();
      selected.clear();
      for (const id of state.base)
        selected.add(id);
      for (const row of selectionHost.querySelectorAll(".dhx_grid-row[data-dhx-id], [data-id]")) {
        const rect = row.getBoundingClientRect();
        if (rect.width && rect.height && rect.bottom > Math.max(top, bounds.top) && rect.top < Math.min(bottom, bounds.bottom) && rect.right > Math.max(left, bounds.left) && rect.left < Math.min(right, bounds.right)) {
          selected.add(normalizeId({ id: row.dataset.dhxId || row.dataset.id }));
        }
      }
      entityGrid?.setSelectedRows(selected);
      updateCount();
    }, { capture: true, passive: false });
    document.addEventListener("pointerup", finish, true);
    document.addEventListener("pointercancel", finish, true);
    window.addEventListener("blur", finish);
    selectionHost.addEventListener("click", (event) => {
      if (suppressClick) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    selectionHost.addEventListener("dragstart", (event) => {
      if (gesture)
        event.preventDefault();
    }, true);
  }
  function filteredNodes() {
    const keyword = String(byId("entityManageSearch")?.value || "").trim().toLowerCase();
    return nodes().filter((node) => !keyword || [labelOf(node), node.type, node.classLabel, node.tags].filter(Boolean).join(" ").toLowerCase().includes(keyword));
  }
  function updateCount() {
    const ids = [...selected];
    for (const [buttonId, mode] of [
      ["btnEntityManageDelete", "manage"],
      ["btnEntityManageApplyType", "edit"],
      ["btnEntityManageApplyTag", "edit"]
    ]) {
      const button = byId(buttonId);
      if (button)
        button.disabled = !window.canOperateKnowledgeSelection?.(ids, mode);
    }
    const count = byId("entityManageCount");
    if (count)
      count.textContent = `已选 ${selected.size} 项`;
    const all = byId("entityManageCheckAll");
    const list = filteredNodes();
    if (all) {
      all.checked = list.length > 0 && list.every((node) => selected.has(normalizeId(node)));
      all.indeterminate = !all.checked && list.some((node) => selected.has(normalizeId(node)));
    }
    byId("entityManageModal")?.classList.toggle("has-selection", selected.size > 0);
  }
  async function render() {
    const host = byId("entityManageRows");
    if (!host)
      return;
    const list = filteredNodes();
    renderedRows = list.map((node) => {
      const id = normalizeId(node);
      return {
        id,
        select: "",
        name: labelOf(node),
        type: node.typeLabel || node.type || "—",
        category: (node.categoryLabels || []).join("、") || node.classLabel || "—"
      };
    });
    renderedRows.forEach((row, index) => {
      row.image = imageCell(list[index]);
    });
    const module = await window.kbBusinessGridModuleReady;
    if (!entityGrid) {
      entityGrid = module.getBusinessGrid(host, {
        columns: [
          {
            id: "select",
            header: [{ text: "选择" }],
            width: 64,
            sortable: false,
            htmlEnable: true,
            template: (_value, row) => `<input class="entity-manage-check" data-grid-select-id="${escapeHtml(row.id)}" type="checkbox" ${selected.has(String(row.id)) ? "checked" : ""}>`
          },
          {
            id: "image",
            header: [{ text: "图片" }],
            width: 74,
            sortable: false,
            htmlEnable: true,
            template: (value) => value
          },
          {
            id: "name",
            header: [{ text: "名称" }],
            minWidth: 180,
            gravity: 1.2
          },
          { id: "type", header: [{ text: "本体类型" }], width: 170 },
          {
            id: "category",
            header: [{ text: "分类类别" }],
            width: 180
          }
        ],
        multiselection: true,
        selectAll: true,
        emptyText: "没有可管理的实体",
        onSelectionChange: (ids) => {
          selected.clear();
          ids.forEach((id) => selected.add(id));
          syncGlobalSelection(ids[0] || "");
          updateCount();
        },
        onCellClick: (row, column, event) => {
          const id = String(row.id);
          if (column.id === "select" || event.target.closest(".entity-manage-check")) {
            return;
          }
        },
        onCellDblClick: (row) => {
          const id = String(row.id);
          selected.clear();
          selected.add(id);
          window.setTableSelection?.(id, false, {
            skipDetailRefresh: true,
            skipSidebarSync: true
          });
          window.setViewMode?.("detail", { targetNodeId: id });
        }
      });
    }
    entityGrid.update(renderedRows);
    entityGrid.setSelectedRows(selected);
    updateCount();
  }
  async function updateSelected(makePayload) {
    const ids = [...selected];
    if (!ids.length)
      throw new Error("请先选择实体");
    if (!window.canOperateKnowledgeSelection?.(ids, "edit"))
      throw new Error(window.authUser ? "选中项包含无权编辑的知识" : "请先登录");
    const map = new Map(nodes().map((node) => [normalizeId(node), node]));
    for (const id of ids) {
      const response = await fetch(scopedUrl("/api/kb/nodes/update"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...makePayload(map.get(id)) })
      });
      if (!response.ok)
        throw new Error(`更新失败（${id}）`);
    }
  }
  async function deleteSelected() {
    const ids = [...selected];
    if (!ids.length)
      throw new Error("请先选择实体");
    if (!window.canOperateKnowledgeSelection?.(ids, "manage"))
      throw new Error(window.authUser ? "选中项包含无权删除的知识" : "请先登录");
    if (!window.confirm(`确定删除所选 ${ids.length} 个实体及其关系吗？此操作不可恢复。`))
      return;
    for (const id of ids) {
      const url = new URL(scopedUrl("/api/kb/nodes"));
      url.searchParams.set("id", id);
      const response = await fetch(url, { method: "DELETE" });
      if (!response.ok)
        throw new Error(`删除失败（${id}）`);
    }
    selected.clear();
    syncGlobalSelection();
  }
  function exportSelected() {
    const rows = nodes().filter((node) => selected.size ? selected.has(normalizeId(node)) : true);
    const csv = [
      ["名称", "本体类型", "分类类别", "标签", "描述"],
      ...rows.map((node) => [
        labelOf(node),
        node.typeLabel || node.type || "",
        (node.categoryLabels || []).join(";") || node.classLabel || "",
        Array.isArray(node.tags) ? node.tags.join(";") : node.tags || "",
        node.description || node.desc_zh || ""
      ])
    ].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join(`
`);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    link.download = "知识实体.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }
  document.addEventListener("DOMContentLoaded", () => {
    const modal = byId("entityManageModal");
    const tablePanel = byId("tablePanel");
    window.openEntityManageTable = () => {
      if (!modal || !tablePanel)
        return;
      if (modal.parentElement !== tablePanel) {
        tablePanel.insertBefore(modal, byId("tblPagination"));
      }
      modal.classList.add("entity-manage-inline");
      modal.style.display = "block";
      hydrateSelectionFromRoute();
      render();
    };
    window.closeEntityManageTable = () => {
      if (modal)
        modal.style.display = "none";
    };
    byId("btnEntityManageClose")?.addEventListener("click", () => window.applyTableLayoutMode?.("list"));
    byId("entityManageSearch")?.addEventListener("input", () => void render());
    byId("btnEntityManageSelectAll")?.addEventListener("click", () => {
      filteredNodes().forEach((node) => selected.add(normalizeId(node)));
      syncGlobalSelection([...selected][0] || "");
      render();
    });
    byId("entityManageCheckAll")?.addEventListener("change", (event) => {
      filteredNodes().forEach((node) => event.target.checked ? selected.add(normalizeId(node)) : selected.delete(normalizeId(node)));
      syncGlobalSelection(event.target.checked ? [...selected][0] || "" : "");
      render();
    });
    byId("btnEntityManageExport")?.addEventListener("click", exportSelected);
    byId("btnEntityManageApplyType")?.addEventListener("click", async () => {
      const type = String(byId("entityManageType").value || "").trim();
      if (!type)
        return alert("请输入类型");
      try {
        await updateSelected(() => ({ type }));
        await window.loadTablePage?.({ resetPage: false });
        render();
      } catch (error) {
        alert(error.message || error);
      }
    });
    byId("btnEntityManageApplyTag")?.addEventListener("click", async () => {
      const tag = String(byId("entityManageTag").value || "").trim();
      if (!tag)
        return alert("请输入标签");
      try {
        await updateSelected((node) => ({
          tags: [
            ...new Set([...Array.isArray(node?.tags) ? node.tags : [], tag])
          ]
        }));
        await window.loadTablePage?.({ resetPage: false });
        render();
      } catch (error) {
        alert(error.message || error);
      }
    });
    byId("btnEntityManageDelete")?.addEventListener("click", async () => {
      try {
        await deleteSelected();
        await window.loadTablePage?.({ resetPage: false });
        render();
      } catch (error) {
        alert(error.message || error);
      }
    });
    if (window.kbTableLayoutMode === "manage")
      window.openEntityManageTable();
  });
})();
