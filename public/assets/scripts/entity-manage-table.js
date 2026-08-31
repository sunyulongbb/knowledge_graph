(function () {
  const byId = (id) => document.getElementById(id);
  const selected = new Set();
  const normalizeId = (node) => String(node?._id || node?.id || "").replace(/^entity\//, "").trim();
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

  function filteredNodes() {
    const keyword = String(byId("entityManageSearch")?.value || "").trim().toLowerCase();
    return nodes().filter((node) => !keyword || [labelOf(node), node.type, node.classLabel, node.tags].filter(Boolean).join(" ").toLowerCase().includes(keyword));
  }

  function updateCount() {
    const count = byId("entityManageCount");
    if (count) count.textContent = `已选 ${selected.size} 项`;
    const all = byId("entityManageCheckAll");
    const list = filteredNodes();
    if (all) { all.checked = list.length > 0 && list.every((node) => selected.has(normalizeId(node))); all.indeterminate = !all.checked && list.some((node) => selected.has(normalizeId(node))); }
    byId("entityManageModal")?.classList.toggle("has-selection", selected.size > 0);
  }

  function render() {
    const host = byId("entityManageRows");
    if (!host) return;
    const list = filteredNodes();
    host.innerHTML = list.length ? list.map((node) => {
      const id = normalizeId(node); const tags = Array.isArray(node.tags) ? node.tags.join("、") : String(node.tags || "");
      return `<tr data-id="${escapeHtml(id)}" class="${selected.has(id) ? "selected" : ""}" tabindex="0"><td><input class="entity-manage-check" data-id="${escapeHtml(id)}" type="checkbox" ${selected.has(id) ? "checked" : ""}></td><td title="${escapeHtml(labelOf(node))}">${escapeHtml(labelOf(node))}</td><td>${escapeHtml(node.typeLabel || node.classLabel || node.type || "—")}</td><td>${escapeHtml(tags || "—")}</td><td>${escapeHtml(node.updated_at || node.created_at || "—")}</td></tr>`;
    }).join("") : '<tr><td colspan="5" class="muted">没有可管理的实体</td></tr>';
    host.querySelectorAll(".entity-manage-check").forEach((input) => input.addEventListener("change", () => {
      input.checked ? selected.add(input.dataset.id) : selected.delete(input.dataset.id);
      input.closest("tr")?.classList.toggle("selected", input.checked);
      syncGlobalSelection(input.checked ? input.dataset.id : "");
      updateCount();
    }));
    host.querySelectorAll("tr[data-id]").forEach((row) => {
      row.addEventListener("click", (event) => {
        if (event.target.closest("input, button, a")) return;
        const id = row.dataset.id;
        if (!id) return;
        if (event.ctrlKey || event.metaKey) {
          selected.has(id) ? selected.delete(id) : selected.add(id);
        } else {
          const keepOnlyCurrent = selected.size === 1 && selected.has(id);
          selected.clear();
          if (!keepOnlyCurrent) selected.add(id);
        }
        syncGlobalSelection(selected.has(id) ? id : "");
        render();
      });
      row.addEventListener("dblclick", (event) => {
        if (event.target.closest("input, button, a")) return;
        const id = row.dataset.id;
        if (!id) return;
        selected.clear();
        selected.add(id);
        window.setTableSelection?.(id, false, {
          skipDetailRefresh: true,
          skipSidebarSync: true,
        });
        window.setViewMode?.("detail", { targetNodeId: id });
      });
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        window.setViewMode?.("detail", { targetNodeId: row.dataset.id });
      });
    });
    updateCount();
  }

  async function updateSelected(makePayload) {
    const ids = [...selected];
    if (!ids.length) throw new Error("请先选择实体");
    const map = new Map(nodes().map((node) => [normalizeId(node), node]));
    for (const id of ids) {
      const response = await fetch(scopedUrl("/api/kb/nodes/update"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...makePayload(map.get(id)) }) });
      if (!response.ok) throw new Error(`更新失败（${id}）`);
    }
  }

  async function deleteSelected() {
    const ids = [...selected];
    if (!ids.length) throw new Error("请先选择实体");
    if (!window.confirm(`确定删除所选 ${ids.length} 个实体及其关系吗？此操作不可恢复。`)) return;
    for (const id of ids) {
      const url = new URL(scopedUrl("/api/kb/nodes")); url.searchParams.set("id", id);
      const response = await fetch(url, { method: "DELETE" });
      if (!response.ok) throw new Error(`删除失败（${id}）`);
    }
    selected.clear();
    syncGlobalSelection();
  }

  function exportSelected() {
    const rows = nodes().filter((node) => selected.size ? selected.has(normalizeId(node)) : true);
    const csv = [["名称", "类型", "标签", "描述"], ...rows.map((node) => [labelOf(node), node.typeLabel || node.classLabel || node.type || "", Array.isArray(node.tags) ? node.tags.join(";") : node.tags || "", node.description || node.desc_zh || ""])].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })); link.download = "知识实体.csv"; link.click(); URL.revokeObjectURL(link.href);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const modal = byId("entityManageModal");
    const tablePanel = byId("tablePanel");
    window.openEntityManageTable = () => {
      if (!modal || !tablePanel) return;
      if (modal.parentElement !== tablePanel) {
        tablePanel.insertBefore(modal, byId("tblPagination"));
      }
      modal.classList.add("entity-manage-inline");
      modal.style.display = "block";
      render();
    };
    window.closeEntityManageTable = () => { if (modal) modal.style.display = "none"; };
    byId("btnEntityManageClose")?.addEventListener("click", () => window.applyTableLayoutMode?.("table"));
    byId("entityManageSearch")?.addEventListener("input", render);
    byId("btnEntityManageSelectAll")?.addEventListener("click", () => { filteredNodes().forEach((node) => selected.add(normalizeId(node))); syncGlobalSelection([...selected][0] || ""); render(); });
    byId("entityManageCheckAll")?.addEventListener("change", (event) => { filteredNodes().forEach((node) => event.target.checked ? selected.add(normalizeId(node)) : selected.delete(normalizeId(node))); syncGlobalSelection(event.target.checked ? [...selected][0] || "" : ""); render(); });
    byId("btnEntityManageExport")?.addEventListener("click", exportSelected);
    byId("btnEntityManageApplyType")?.addEventListener("click", async () => { const type = String(byId("entityManageType").value || "").trim(); if (!type) return alert("请输入类型"); try { await updateSelected(() => ({ type })); await window.loadTablePage?.({ resetPage: false }); render(); } catch (error) { alert(error.message || error); } });
    byId("btnEntityManageApplyTag")?.addEventListener("click", async () => { const tag = String(byId("entityManageTag").value || "").trim(); if (!tag) return alert("请输入标签"); try { await updateSelected((node) => ({ tags: [...new Set([...(Array.isArray(node?.tags) ? node.tags : []), tag]) ] })); await window.loadTablePage?.({ resetPage: false }); render(); } catch (error) { alert(error.message || error); } });
    byId("btnEntityManageDelete")?.addEventListener("click", async () => { try { await deleteSelected(); await window.loadTablePage?.({ resetPage: false }); render(); } catch (error) { alert(error.message || error); } });
    if (window.kbTableLayoutMode === "manage") window.openEntityManageTable();
  });
})();
