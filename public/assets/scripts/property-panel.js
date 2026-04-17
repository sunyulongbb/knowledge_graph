(function () {
  const shared = window.kbApp || {};
  const state = shared.state || {};
  const dom = shared.dom || {};
  const byId = dom.byId || ((id) => document.getElementById(id));
  const urlParams = new URLSearchParams(window.location.search);

  let propertyPage = parseInt(urlParams.get("prop_page") || "1", 10);
  let propertyPageSize = parseInt(urlParams.get("prop_limit") || "20", 10);
  let propertyTotal = 0;
  let selectedOntologyId = (urlParams.get("ontology_id") || "").trim();
  let propertyViewMode = selectedOntologyId ? "linked" : "all";
  let ontologyItems = [];
  let ontologySearchTimer = null;
  let initPromise = null;
  let propertyOntologyModalState = {
    propertyId: "",
    propertyName: "",
    ontologyIds: [],
  };

  const propertyTable = byId("propertyTable");
  const propPageSizeSelect = byId("propertyPageSize");
  const ontologyTree = byId("ontologyTree");

  if (typeof state.bindAlias === "function") {
    state.bindAlias(
      "propertySelectedIds",
      "propertySelectedIds",
      () => new Set(),
    );
  }
  if (!(window.propertySelectedIds instanceof Set)) {
    window.propertySelectedIds = new Set();
  }
  if (propPageSizeSelect) {
    propPageSizeSelect.value = String(propertyPageSize);
  }

  function appendCurrentDbToUrl(url) {
    if (typeof window.appendCurrentDbParam === "function") {
      const scopedUrl = window.appendCurrentDbParam(url);
      if (scopedUrl instanceof URL) return scopedUrl;
    }
    return url;
  }

  async function apiJson(input, init) {
    const response = await fetch(input, init);
    if (!response.ok) throw new Error("HTTP " + response.status);
    return await response.json();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function updateUrlState() {
    if (typeof window.updateUrlParam === "function") {
      window.updateUrlParam("prop_limit", propertyPageSize);
      window.updateUrlParam("prop_page", propertyPage);
      window.updateUrlParam("ontology_id", selectedOntologyId || null);
    }
  }

  function getSelectedOntology() {
    return ontologyItems.find((item) => item.id === selectedOntologyId) || null;
  }

  function flattenOntologyTree(nodes, target = []) {
    for (const node of nodes || []) {
      target.push(node);
      flattenOntologyTree(node.children || [], target);
    }
    return target;
  }

  function buildLocalTree() {
    const map = new Map();
    for (const item of ontologyItems) {
      map.set(item.id, { ...item, children: [] });
    }
    const roots = [];
    for (const item of map.values()) {
      if (item.parent_id && map.has(item.parent_id)) {
        map.get(item.parent_id).children.push(item);
      } else {
        roots.push(item);
      }
    }
    return roots;
  }

  function updateOntologyActionState() {
    const hasSelection = Boolean(selectedOntologyId);
    const btnAddChild = byId("btnOntologyAddChild");
    const btnEdit = byId("btnOntologyEdit");
    const btnDelete = byId("btnOntologyDelete");
    if (btnAddChild) btnAddChild.disabled = !hasSelection;
    if (btnEdit) btnEdit.disabled = !hasSelection;
    if (btnDelete) btnDelete.disabled = !hasSelection;
  }

  function updateOntologySummary() {
    const current = getSelectedOntology();
    const summary = byId("ontologyCurrentInfo");
    const hint = byId("propertyOntologyHint");
    const headerSummary = byId("ontologyHeaderSummary");
    const browseAllButton = byId("btnOntologyBrowseAll");

    if (summary) {
      summary.textContent = current
        ? `当前本体：${current.name}${current.description ? ` · ${current.description}` : ""}`
        : "当前本体：全部属性";
    }
    if (hint) {
      hint.textContent = current
        ? propertyViewMode === "linked"
          ? `正在查看 ${current.name} 已关联的属性。`
          : `正在浏览全部属性库，可把属性关联到 ${current.name}。`
        : "当前显示全部属性，选择左侧本体后可查看它已关联的属性。";
    }
    if (headerSummary) {
      headerSummary.textContent = current
        ? propertyViewMode === "linked"
          ? `已选本体：${current.name} · 已关联属性`
          : `已选本体：${current.name} · 全部属性库`
        : "维护本体树与属性归属";
    }
    if (browseAllButton) {
      if (!current) {
        browseAllButton.style.display = "none";
      } else {
        browseAllButton.style.display = "";
        browseAllButton.textContent =
          propertyViewMode === "linked" ? "浏览全部属性库" : "返回已关联属性";
      }
    }
    updateOntologyActionState();
  }

  function renderOntologyTree(nodes) {
    if (!ontologyTree) return;
    if (!Array.isArray(nodes) || !nodes.length) {
      ontologyTree.innerHTML =
        '<div class="muted" style="padding: 10px 8px;">暂无本体，点击“新增本体”开始。</div>';
      return;
    }

    const renderNodes = (items, depth) =>
      items
        .map((item) => {
          const selected = item.id === selectedOntologyId;
          const childCount = Number(
            item.child_count || (item.children || []).length || 0,
          );
          const propertyCount = Number(item.property_count || 0);
          return `
            <div style="margin-bottom: 5px;">
              <button
                type="button"
                class="ontology-tree-item${selected ? " active" : ""}"
                data-id="${escapeHtml(item.id)}"
                style="
                  width: 100%;
                  text-align: left;
                  border: 1px solid ${selected ? "var(--accent, #2563eb)" : "transparent"};
                  background: ${selected ? "rgba(37, 99, 235, 0.08)" : "transparent"};
                  color: inherit;
                  border-radius: 14px;
                  padding: 9px 10px;
                  margin-left: ${depth * 14}px;
                  cursor: pointer;
                  display: flex;
                  flex-direction: column;
                  gap: 5px;
                "
              >
                <span style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                  <span style="font-weight: 600;">${escapeHtml(item.name || "未命名本体")}</span>
                  <span class="ontology-pill">${propertyCount} 属性</span>
                </span>
                <span class="muted" style="font-size: 12px;">
                  ${childCount ? `${childCount} 个子本体` : "无子本体"}
                  ${item.description ? ` · ${escapeHtml(item.description)}` : ""}
                </span>
              </button>
              ${renderNodes(item.children || [], depth + 1)}
            </div>
          `;
        })
        .join("");

    ontologyTree.innerHTML =
      `
        <button
          type="button"
          class="ontology-tree-item${selectedOntologyId ? "" : " active"}"
          data-id=""
          style="
            width: 100%;
            text-align: left;
            border: 1px solid ${selectedOntologyId ? "transparent" : "var(--accent, #2563eb)"};
            background: ${selectedOntologyId ? "transparent" : "rgba(37, 99, 235, 0.08)"};
            color: inherit;
            border-radius: 14px;
            padding: 9px 10px;
            margin-bottom: 8px;
            cursor: pointer;
          "
        >
          <strong>全部属性</strong>
          <div class="muted" style="font-size: 12px; margin-top: 4px;">不限定本体</div>
        </button>
      ` + renderNodes(nodes, 0);
  }

  function renderOntologyPills(names) {
    if (!Array.isArray(names) || !names.length) {
      return '<span class="muted">未关联</span>';
    }
    const visible = names.slice(0, 3);
    return `<div class="ontology-pill-list">${visible
      .map((name) => `<span class="ontology-pill">${escapeHtml(name)}</span>`)
      .join(
        "",
      )}${names.length > 3 ? `<span class="ontology-pill">+${names.length - 3}</span>` : ""}</div>`;
  }

  function renderPropertyType(prop) {
    return `<div style="display:flex; flex-wrap:wrap; gap:6px;">
      <span class="ontology-type-chip">${escapeHtml(prop.datatype || "string")}</span>
      ${prop.valuetype ? `<span class="ontology-pill">${escapeHtml(prop.valuetype)}</span>` : ""}
    </div>`;
  }

  async function loadOntologyTree() {
    if (ontologyTree) {
      ontologyTree.innerHTML =
        '<div class="muted" style="padding: 10px 8px;">加载本体中...</div>';
    }
    const searchValue = (byId("ontologySearch")?.value || "").trim();
    try {
      const url = appendCurrentDbToUrl(
        new URL("/api/kb/ontology/tree", window.location.origin),
      );
      if (searchValue) url.searchParams.set("q", searchValue);
      const data = await apiJson(url.toString());
      const treeItems = Array.isArray(data?.items) ? data.items : [];
      ontologyItems = flattenOntologyTree(treeItems, []);
      window.kbOntologies = ontologyItems.slice();
      try {
        window.dispatchEvent(
          new CustomEvent("kb:ontologies-updated", {
            detail: { items: window.kbOntologies.slice() },
          }),
        );
      } catch {}
      if (
        selectedOntologyId &&
        !ontologyItems.some((item) => item.id === selectedOntologyId)
      ) {
        selectedOntologyId = "";
      }
      renderOntologyTree(treeItems);
      updateOntologySummary();
    } catch (err) {
      console.error("loadOntologyTree failed", err);
      if (ontologyTree) {
        ontologyTree.innerHTML =
          '<div class="muted" style="padding: 10px 8px;">本体加载失败</div>';
      }
    }
  }

  function updatePropertyPageInfo() {
    const maxPage = Math.max(1, Math.ceil(propertyTotal / propertyPageSize));
    const info = byId("propertyPageInfo");
    if (info) {
      info.textContent = `第 ${propertyPage} / ${maxPage} 页 · 共 ${propertyTotal} 条`;
    }
    const prevButton = byId("btnPropertyPrevPage");
    const nextButton = byId("btnPropertyNextPage");
    if (prevButton) prevButton.disabled = propertyPage <= 1;
    if (nextButton) nextButton.disabled = propertyPage >= maxPage;
  }

  function updatePropertySelectedStyles() {
    if (!propertyTable) return;
    const rows = propertyTable.querySelectorAll("tbody tr[data-id]");
    rows.forEach((tr) => {
      const rowId = tr.getAttribute("data-id") || "";
      tr.classList.toggle("selected", window.propertySelectedIds.has(rowId));
    });
    const deleteSelectedButton = byId("btnPropertyDeleteSelected");
    if (deleteSelectedButton) {
      deleteSelectedButton.disabled = window.propertySelectedIds.size === 0;
    }
  }

  async function loadPropertyList() {
    if (!propertyTable) return;
    const tbody = propertyTable.querySelector("tbody");
    if (!tbody) return;

    updateUrlState();
    tbody.innerHTML =
      '<tr><td colspan="6" class="muted">加载属性中...</td></tr>';

    const q = (byId("propertyMgmtSearch")?.value || "").trim();
    try {
      const url = appendCurrentDbToUrl(
        new URL("/api/kb/property_search", window.location.origin),
      );
      url.searchParams.set("limit", String(propertyPageSize));
      url.searchParams.set(
        "offset",
        String((propertyPage - 1) * propertyPageSize),
      );
      if (q) url.searchParams.set("q", q);
      if (selectedOntologyId) {
        url.searchParams.set("ontology_id", selectedOntologyId);
        url.searchParams.set(
          "association_mode",
          propertyViewMode === "linked" ? "linked" : "all",
        );
      }

      const data = await apiJson(url.toString());
      const list = Array.isArray(data?.items) ? data.items : [];
      propertyTotal = Number(data?.total || list.length || 0);

      if (!list.length) {
        tbody.innerHTML =
          '<tr><td colspan="6" class="muted">暂无属性</td></tr>';
        updatePropertyPageInfo();
        updatePropertySelectedStyles();
        return;
      }

      tbody.innerHTML = "";
      for (const prop of list) {
        const linkedNames = Array.isArray(prop.ontology_names)
          ? prop.ontology_names.filter(Boolean)
          : [];
        const isLinkedToCurrent = Boolean(prop.linked_to_ontology);
        const actionHtml = selectedOntologyId
          ? `<button class="btn sm ${isLinkedToCurrent ? "" : "primary"} btnPropertyToggleOntology ontology-link-btn" data-id="${escapeHtml(prop.id)}" data-linked="${isLinkedToCurrent ? "1" : "0"}">${isLinkedToCurrent ? "已关联" : "关联"}</button>`
          : `<button class="btn sm btnPropertyAssignOntology" data-id="${escapeHtml(prop.id)}">关联本体</button>`;

        const tr = document.createElement("tr");
        tr.setAttribute("data-id", prop.id || "");
        tr.dataset.property = JSON.stringify({
          id: prop.id || "",
          name: prop.name || prop.label || "",
          datatype: prop.datatype || "string",
          valuetype: prop.valuetype || "",
          linked: isLinkedToCurrent,
          ontology_ids: Array.isArray(prop.ontology_ids)
            ? prop.ontology_ids
            : [],
          ontology_names: linkedNames,
        });
        tr.innerHTML = `
          <td>${escapeHtml(prop.id || "")}</td>
          <td><div style="font-weight:600; color:var(--fg);">${escapeHtml(prop.label || prop.name || "")}</div></td>
          <td>${renderPropertyType(prop)}</td>
          <td>${renderOntologyPills(linkedNames)}</td>
          <td>${actionHtml}</td>
          <td>
            <button class="btn sm icon btnPropertyEdit" title="编辑"><i class="fa-solid fa-pen"></i></button>
            <button class="btn sm icon danger btnPropertyDelete" data-id="${escapeHtml(prop.id || "")}" title="删除"><i class="fa-solid fa-trash"></i></button>
          </td>
        `;
        tbody.appendChild(tr);
      }

      updatePropertyPageInfo();
      updatePropertySelectedStyles();
    } catch (err) {
      console.error("loadPropertyList failed", err);
      tbody.innerHTML = `<tr><td colspan="6" class="muted">加载失败: ${escapeHtml(
        err?.message || err,
      )}</td></tr>`;
      updatePropertyPageInfo();
      updatePropertySelectedStyles();
    }
  }

  function openPropertyModal(mode, data = {}) {
    const modal = byId("propertyModal");
    const title = byId("propertyModalTitle");
    const form = byId("propertyForm");
    if (!modal || !title || !form) return;

    const selectedOntology = getSelectedOntology();
    const assignWrap = byId("propAssignOntologyWrap");
    const assignCheckbox = byId("propAssignOntology");
    const assignLabel = byId("propAssignOntologyLabel");
    const originalLinked = Boolean(data.linked);

    title.textContent = mode === "edit" ? "编辑属性" : "新增属性";
    byId("propId").value = data.id || "";
    byId("propName").value = data.name || "";
    byId("propDatatype").value = data.datatype || "string";
    byId("propValuetype").value = data.valuetype || "";
    form.dataset.mode = mode;
    form.dataset.originalLinked = originalLinked ? "1" : "0";

    if (assignWrap && assignCheckbox && assignLabel) {
      if (selectedOntology) {
        assignWrap.style.display = "";
        assignCheckbox.checked = mode === "edit" ? originalLinked : true;
        assignLabel.textContent = `保存后关联到当前本体：${selectedOntology.name}`;
      } else {
        assignWrap.style.display = "none";
        assignCheckbox.checked = false;
        assignLabel.textContent = "保存后关联到当前本体";
      }
    }

    modal.style.display = "flex";
  }

  function closePropertyModal() {
    const modal = byId("propertyModal");
    if (modal) modal.style.display = "none";
  }

  function openOntologyModal(mode, options = {}) {
    const modal = byId("ontologyModal");
    const title = byId("ontologyModalTitle");
    const form = byId("ontologyForm");
    const ontologyIdInput = byId("ontologyId");
    const ontologyParentIdInput = byId("ontologyParentId");
    const ontologyNameInput = byId("ontologyName");
    const ontologyDescriptionInput = byId("ontologyDescription");
    const ontologyParentNameInput = byId("ontologyParentName");
    if (
      !modal ||
      !title ||
      !form ||
      !ontologyIdInput ||
      !ontologyParentIdInput ||
      !ontologyNameInput ||
      !ontologyDescriptionInput ||
      !ontologyParentNameInput
    ) {
      return;
    }

    const parent = options.parent || null;
    const item = options.item || null;
    title.textContent =
      mode === "edit" ? "编辑本体" : parent ? "新增子本体" : "新增本体";
    form.dataset.mode = mode;
    ontologyIdInput.value = item?.id || "";
    ontologyParentIdInput.value =
      mode === "edit" ? item?.parent_id || "" : parent?.id || "";
    ontologyNameInput.value = item?.name || "";
    ontologyDescriptionInput.value = item?.description || "";
    ontologyParentNameInput.value =
      mode === "edit"
        ? ontologyItems.find((node) => node.id === item?.parent_id)?.name ||
          "无"
        : parent?.name || "无";
    modal.style.display = "flex";
    try {
      ontologyNameInput.focus();
      ontologyNameInput.select();
    } catch {}
  }

  function closeOntologyModal() {
    const modal = byId("ontologyModal");
    if (modal) modal.style.display = "none";
  }

  function populatePropertyOntologySelect(selectedId = "") {
    const select = byId("propertyOntologySelect");
    if (!select) return;
    const options = ontologyItems
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
      .map(
        (item) =>
          `<option value="${escapeHtml(item.id)}"${item.id === selectedId ? " selected" : ""}>${escapeHtml(item.name || item.id)}</option>`,
      )
      .join("");
    select.innerHTML = `<option value="">请选择本体</option>${options}`;
  }

  function openPropertyOntologyModal(data = {}) {
    const modal = byId("propertyOntologyModal");
    const title = byId("propertyOntologyModalTitle");
    const summary = byId("propertyOntologyModalSummary");
    const current = byId("propertyOntologyCurrent");
    const propertyIdInput = byId("propertyOntologyPropertyId");
    const select = byId("propertyOntologySelect");
    if (
      !modal ||
      !title ||
      !summary ||
      !current ||
      !propertyIdInput ||
      !select
    ) {
      return;
    }

    propertyOntologyModalState = {
      propertyId: data.id || "",
      propertyName: data.name || data.label || "",
      ontologyIds: Array.isArray(data.ontology_ids) ? data.ontology_ids : [],
    };

    title.textContent = "关联本体";
    summary.textContent = `为属性“${propertyOntologyModalState.propertyName || propertyOntologyModalState.propertyId}”选择要关联的本体。`;
    current.textContent = propertyOntologyModalState.ontologyIds.length
      ? `当前已关联 ${propertyOntologyModalState.ontologyIds.length} 个本体`
      : "当前尚未关联本体";
    propertyIdInput.value = propertyOntologyModalState.propertyId;
    populatePropertyOntologySelect();
    select.value = "";
    modal.style.display = "flex";
  }

  function closePropertyOntologyModal() {
    const modal = byId("propertyOntologyModal");
    if (modal) modal.style.display = "none";
  }

  async function linkPropertyToOntology(propertyId) {
    if (!selectedOntologyId || !propertyId) return;
    const url = appendCurrentDbToUrl(
      new URL("/api/kb/ontology/property", window.location.origin),
    );
    await apiJson(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ontology_id: selectedOntologyId,
        property_id: propertyId,
      }),
    });
  }

  async function unlinkPropertyFromOntology(propertyId) {
    if (!selectedOntologyId || !propertyId) return;
    const url = appendCurrentDbToUrl(
      new URL("/api/kb/ontology/property", window.location.origin),
    );
    url.searchParams.set("ontology_id", selectedOntologyId);
    url.searchParams.set("property_id", propertyId);
    await apiJson(url.toString(), { method: "DELETE" });
  }

  async function deleteProperty(id, skipConfirm = false) {
    if (!id) return;
    if (!skipConfirm && !confirm("确定要删除该属性吗？")) return;
    try {
      const url = appendCurrentDbToUrl(
        new URL("/api/kb/property_delete", window.location.origin),
      );
      await apiJson(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!skipConfirm) {
        await Promise.all([loadPropertyList(), loadOntologyTree()]);
      }
    } catch (err) {
      alert("删除失败: " + (err?.message || err));
    }
  }

  async function batchDeleteProperties(ids) {
    if (!Array.isArray(ids) || !ids.length) return;
    if (!confirm(`确定要删除选中的 ${ids.length} 个属性吗？`)) return;
    for (const id of ids) {
      await deleteProperty(id, true);
    }
    window.propertySelectedIds.clear();
    await Promise.all([loadPropertyList(), loadOntologyTree()]);
  }

  async function deleteOntology(id) {
    if (!id) return;
    const current = getSelectedOntology();
    const hasChildren = ontologyItems.some((item) => item.parent_id === id);
    const hasProps = Number(current?.property_count || 0) > 0;
    const message =
      hasChildren || hasProps
        ? "删除本体会同时移除子本体层级和相关属性关联，确定继续吗？"
        : "确定删除该本体吗？";
    if (!confirm(message)) return;

    try {
      const url = appendCurrentDbToUrl(
        new URL("/api/kb/ontologies", window.location.origin),
      );
      url.searchParams.set("id", id);
      await apiJson(url.toString(), { method: "DELETE" });
      selectedOntologyId = "";
      await Promise.all([loadOntologyTree(), loadPropertyList()]);
    } catch (err) {
      alert("删除本体失败: " + (err?.message || err));
    }
  }

  async function clearAllOntologies() {
    try {
      const url = appendCurrentDbToUrl(
        new URL("/api/kb/ontologies/clear", window.location.origin),
      );
      await apiJson(url.toString(), { method: "DELETE" });
      selectedOntologyId = "";
      await Promise.all([loadOntologyTree(), loadPropertyList()]);
    } catch (err) {
      alert("清空本体失败: " + (err?.message || err));
    }
  }

  function bindEvents() {
    const propertyForm = byId("propertyForm");
    if (propertyForm && !propertyForm.dataset.boundOntologyProperty) {
      propertyForm.dataset.boundOntologyProperty = "1";
      propertyForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const id = (byId("propId")?.value || "").trim();
        const name = (byId("propName")?.value || "").trim();
        const datatype = (byId("propDatatype")?.value || "string").trim();
        const valuetype = (byId("propValuetype")?.value || "").trim();
        const assignToOntology = Boolean(byId("propAssignOntology")?.checked);
        const originalLinked = propertyForm.dataset.originalLinked === "1";
        if (!name) {
          alert("名称不能为空");
          return;
        }

        try {
          const url = appendCurrentDbToUrl(
            new URL(
              id ? "/api/kb/property_update" : "/api/kb/property_create",
              window.location.origin,
            ),
          );
          const result = await apiJson(url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, name, datatype, valuetype }),
          });
          const propertyId = id || result?.id;
          if (selectedOntologyId && propertyId) {
            if (assignToOntology && !originalLinked) {
              await linkPropertyToOntology(propertyId);
            } else if (!assignToOntology && originalLinked) {
              await unlinkPropertyFromOntology(propertyId);
            }
          }
          closePropertyModal();
          await Promise.all([loadPropertyList(), loadOntologyTree()]);
        } catch (err) {
          alert("保存属性失败: " + (err?.message || err));
        }
      });
    }

    const ontologyForm = byId("ontologyForm");
    if (ontologyForm && !ontologyForm.dataset.boundOntologyForm) {
      ontologyForm.dataset.boundOntologyForm = "1";
      ontologyForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const mode = ontologyForm.dataset.mode || "create";
        const id = (byId("ontologyId")?.value || "").trim();
        const parentId = (byId("ontologyParentId")?.value || "").trim();
        const name = (byId("ontologyName")?.value || "").trim();
        const description = (byId("ontologyDescription")?.value || "").trim();
        if (!name) {
          alert("本体名称不能为空");
          return;
        }

        try {
          const url = appendCurrentDbToUrl(
            new URL(
              mode === "edit"
                ? "/api/kb/ontologies/update"
                : "/api/kb/ontologies",
              window.location.origin,
            ),
          );
          const payload =
            mode === "edit"
              ? { id, name, description, parent_id: parentId || null }
              : { name, description, parent_id: parentId || null };
          const result = await apiJson(url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          closeOntologyModal();
          if (result?.id) selectedOntologyId = result.id;
          await Promise.all([loadOntologyTree(), loadPropertyList()]);
        } catch (err) {
          alert("保存本体失败: " + (err?.message || err));
        }
      });
    }

    if (propertyTable && !propertyTable.dataset.boundOntologyTable) {
      propertyTable.dataset.boundOntologyTable = "1";
      propertyTable.addEventListener("click", async (event) => {
        const toggleBtn = event.target.closest(".btnPropertyToggleOntology");
        if (toggleBtn) {
          const propertyId = toggleBtn.getAttribute("data-id") || "";
          const linked = toggleBtn.getAttribute("data-linked") === "1";
          try {
            if (linked) await unlinkPropertyFromOntology(propertyId);
            else await linkPropertyToOntology(propertyId);
            await Promise.all([loadPropertyList(), loadOntologyTree()]);
          } catch (err) {
            alert(
              (linked ? "取消关联" : "关联") + "失败: " + (err?.message || err),
            );
          }
          return;
        }

        const editBtn = event.target.closest(".btnPropertyEdit");
        if (editBtn) {
          const tr = editBtn.closest("tr");
          let data = {};
          try {
            data = JSON.parse(tr?.dataset.property || "{}");
          } catch {}
          openPropertyModal("edit", data);
          return;
        }

        const assignBtn = event.target.closest(".btnPropertyAssignOntology");
        if (assignBtn) {
          const tr = assignBtn.closest("tr");
          let data = {};
          try {
            data = JSON.parse(tr?.dataset.property || "{}");
          } catch {}
          openPropertyOntologyModal(data);
          return;
        }

        const deleteBtn = event.target.closest(".btnPropertyDelete");
        if (deleteBtn) {
          await deleteProperty(deleteBtn.getAttribute("data-id"));
          return;
        }

        const tr = event.target.closest("tr[data-id]");
        if (!tr) return;
        const id = tr.getAttribute("data-id") || "";
        if (!id) return;

        if (event.ctrlKey || event.metaKey) {
          if (window.propertySelectedIds.has(id))
            window.propertySelectedIds.delete(id);
          else window.propertySelectedIds.add(id);
          updatePropertySelectedStyles();
          return;
        }

        if (event.shiftKey) {
          const rows = Array.from(
            propertyTable.querySelectorAll("tbody tr[data-id]"),
          );
          const ids = rows.map((row) => row.getAttribute("data-id") || "");
          const anchor = Array.from(window.propertySelectedIds)[0] || ids[0];
          const start = ids.indexOf(anchor);
          const end = ids.indexOf(id);
          if (start !== -1 && end !== -1) {
            const [from, to] = start < end ? [start, end] : [end, start];
            window.propertySelectedIds = new Set(ids.slice(from, to + 1));
            updatePropertySelectedStyles();
          }
          return;
        }

        window.propertySelectedIds = new Set([id]);
        updatePropertySelectedStyles();
      });
    }

    if (ontologyTree && !ontologyTree.dataset.boundOntologyTree) {
      ontologyTree.dataset.boundOntologyTree = "1";
      ontologyTree.addEventListener("click", async (event) => {
        const target = event.target.closest(".ontology-tree-item");
        if (!target) return;
        selectedOntologyId = (target.getAttribute("data-id") || "").trim();
        propertyViewMode = selectedOntologyId ? "linked" : "all";
        propertyPage = 1;
        updateOntologySummary();
        renderOntologyTree(buildLocalTree());
        await loadPropertyList();
      });
    }

    const ontologySearch = byId("ontologySearch");
    if (ontologySearch && !ontologySearch.dataset.bound) {
      ontologySearch.dataset.bound = "1";
      ontologySearch.addEventListener("input", () => {
        if (ontologySearchTimer) clearTimeout(ontologySearchTimer);
        ontologySearchTimer = setTimeout(() => {
          loadOntologyTree();
        }, 180);
      });
    }

    const btnOntologyRefresh = byId("btnOntologyRefresh");
    if (btnOntologyRefresh && !btnOntologyRefresh.dataset.bound) {
      btnOntologyRefresh.dataset.bound = "1";
      btnOntologyRefresh.addEventListener("click", async () => {
        await Promise.all([loadOntologyTree(), loadPropertyList()]);
      });
    }

    const btnOntologyAddRoot = byId("btnOntologyAddRoot");
    if (btnOntologyAddRoot && !btnOntologyAddRoot.dataset.bound) {
      btnOntologyAddRoot.dataset.bound = "1";
      btnOntologyAddRoot.addEventListener("click", () =>
        openOntologyModal("create"),
      );
    }

    const btnOntologyAddChild = byId("btnOntologyAddChild");
    if (btnOntologyAddChild && !btnOntologyAddChild.dataset.bound) {
      btnOntologyAddChild.dataset.bound = "1";
      btnOntologyAddChild.addEventListener("click", () => {
        const parent = getSelectedOntology();
        if (!parent) {
          alert("请先选择一个本体");
          return;
        }
        openOntologyModal("create", { parent });
      });
    }

    const btnOntologyEdit = byId("btnOntologyEdit");
    if (btnOntologyEdit && !btnOntologyEdit.dataset.bound) {
      btnOntologyEdit.dataset.bound = "1";
      btnOntologyEdit.addEventListener("click", () => {
        const item = getSelectedOntology();
        if (!item) {
          alert("请先选择一个本体");
          return;
        }
        openOntologyModal("edit", { item });
      });
    }

    const btnOntologyDelete = byId("btnOntologyDelete");
    if (btnOntologyDelete && !btnOntologyDelete.dataset.bound) {
      btnOntologyDelete.dataset.bound = "1";
      btnOntologyDelete.addEventListener("click", async () => {
        if (!selectedOntologyId) {
          alert("请先选择一个本体");
          return;
        }
        await deleteOntology(selectedOntologyId);
      });
    }

    const btnOntologyClearAll = byId("btnOntologyClearAll");
    if (btnOntologyClearAll && !btnOntologyClearAll.dataset.bound) {
      btnOntologyClearAll.dataset.bound = "1";
      btnOntologyClearAll.addEventListener("click", async () => {
        if (
          !confirm(
            "确定要清空当前应用下全部本体、属性和关联关系吗？此操作不可恢复。",
          )
        )
          return;
        await clearAllOntologies();
      });
    }

    const btnPropertyAdd = byId("btnPropertyAdd");
    if (btnPropertyAdd && !btnPropertyAdd.dataset.bound) {
      btnPropertyAdd.dataset.bound = "1";
      btnPropertyAdd.addEventListener("click", () => openPropertyModal("add"));
    }

    const btnDeleteSelected = byId("btnPropertyDeleteSelected");
    if (btnDeleteSelected && !btnDeleteSelected.dataset.bound) {
      btnDeleteSelected.dataset.bound = "1";
      btnDeleteSelected.addEventListener("click", async () => {
        await batchDeleteProperties(Array.from(window.propertySelectedIds));
      });
    }

    const btnPropertyMgmtRefresh = byId("btnPropertyMgmtRefresh");
    if (btnPropertyMgmtRefresh && !btnPropertyMgmtRefresh.dataset.bound) {
      btnPropertyMgmtRefresh.dataset.bound = "1";
      btnPropertyMgmtRefresh.addEventListener("click", () =>
        loadPropertyList(),
      );
    }

    const btnPropertyClearSearch = byId("btnPropertyClearSearch");
    if (btnPropertyClearSearch && !btnPropertyClearSearch.dataset.bound) {
      btnPropertyClearSearch.dataset.bound = "1";
      btnPropertyClearSearch.addEventListener("click", () => {
        const input = byId("propertyMgmtSearch");
        if (input) input.value = "";
        propertyPage = 1;
        loadPropertyList();
      });
    }

    const propertyMgmtSearch = byId("propertyMgmtSearch");
    if (propertyMgmtSearch && !propertyMgmtSearch.dataset.bound) {
      propertyMgmtSearch.dataset.bound = "1";
      propertyMgmtSearch.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          propertyPage = 1;
          loadPropertyList();
        }
      });
    }

    const btnOntologyBrowseAll = byId("btnOntologyBrowseAll");
    if (btnOntologyBrowseAll && !btnOntologyBrowseAll.dataset.bound) {
      btnOntologyBrowseAll.dataset.bound = "1";
      btnOntologyBrowseAll.addEventListener("click", () => {
        if (!selectedOntologyId) return;
        propertyViewMode = propertyViewMode === "linked" ? "all" : "linked";
        propertyPage = 1;
        updateOntologySummary();
        loadPropertyList();
      });
    }

    const btnPrevPage = byId("btnPropertyPrevPage");
    if (btnPrevPage && !btnPrevPage.dataset.bound) {
      btnPrevPage.dataset.bound = "1";
      btnPrevPage.addEventListener("click", () => {
        if (propertyPage > 1) {
          propertyPage -= 1;
          loadPropertyList();
        }
      });
    }

    const btnNextPage = byId("btnPropertyNextPage");
    if (btnNextPage && !btnNextPage.dataset.bound) {
      btnNextPage.dataset.bound = "1";
      btnNextPage.addEventListener("click", () => {
        const maxPage = Math.max(
          1,
          Math.ceil(propertyTotal / propertyPageSize),
        );
        if (propertyPage < maxPage) {
          propertyPage += 1;
          loadPropertyList();
        }
      });
    }

    if (propPageSizeSelect && !propPageSizeSelect.dataset.bound) {
      propPageSizeSelect.dataset.bound = "1";
      propPageSizeSelect.addEventListener("change", (event) => {
        propertyPageSize = parseInt(event.target.value, 10) || 20;
        propertyPage = 1;
        loadPropertyList();
      });
    }

    const propertyModal = byId("propertyModal");
    if (propertyModal && !propertyModal.dataset.boundOverlay) {
      propertyModal.dataset.boundOverlay = "1";
      propertyModal.addEventListener("click", (event) => {
        if (event.target === propertyModal) closePropertyModal();
      });
    }

    const ontologyModal = byId("ontologyModal");
    if (ontologyModal && !ontologyModal.dataset.boundOverlay) {
      ontologyModal.dataset.boundOverlay = "1";
      ontologyModal.addEventListener("click", (event) => {
        if (event.target === ontologyModal) closeOntologyModal();
      });
    }

    const propertyOntologyModal = byId("propertyOntologyModal");
    if (propertyOntologyModal && !propertyOntologyModal.dataset.boundOverlay) {
      propertyOntologyModal.dataset.boundOverlay = "1";
      propertyOntologyModal.addEventListener("click", (event) => {
        if (event.target === propertyOntologyModal)
          closePropertyOntologyModal();
      });
    }

    const propertyOntologyForm = byId("propertyOntologyForm");
    if (propertyOntologyForm && !propertyOntologyForm.dataset.bound) {
      propertyOntologyForm.dataset.bound = "1";
      propertyOntologyForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const propertyId = (
          byId("propertyOntologyPropertyId")?.value || ""
        ).trim();
        const ontologyId = (byId("propertyOntologySelect")?.value || "").trim();
        if (!propertyId || !ontologyId) {
          alert("请选择要关联的本体");
          return;
        }
        try {
          const url = appendCurrentDbToUrl(
            new URL("/api/kb/ontology/property", window.location.origin),
          );
          await apiJson(url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ontology_id: ontologyId,
              property_id: propertyId,
            }),
          });
          closePropertyOntologyModal();
          await Promise.all([loadPropertyList(), loadOntologyTree()]);
        } catch (err) {
          alert("关联本体失败: " + (err?.message || err));
        }
      });
    }
  }

  window.loadPropertyList = loadPropertyList;
  window.openPropertyModal = openPropertyModal;
  window.closePropertyModal = closePropertyModal;

  async function initOntologyPanel() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      bindEvents();
      updateOntologySummary();
      if (typeof window.fetchKbStats === "function") {
        try {
          window.fetchKbStats();
        } catch {}
      }
      await loadOntologyTree();
      await loadPropertyList();
    })();
    return initPromise;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOntologyPanel, {
      once: true,
    });
  } else {
    initOntologyPanel();
  }

  if (
    typeof window.kbViewMode === "string" &&
    window.kbViewMode.toLowerCase() === "attr"
  ) {
    initOntologyPanel().catch((err) => {
      if (window.console && console.warn) {
        console.warn("initOntologyPanel failed", err);
      }
    });
  }

  window.addEventListener("kb:model-imported", () => {
    Promise.resolve()
      .then(() => Promise.all([loadOntologyTree(), loadPropertyList()]))
      .catch((err) => {
        if (window.console && console.warn) {
          console.warn("refresh after model import failed", err);
        }
      });
  });
})();
