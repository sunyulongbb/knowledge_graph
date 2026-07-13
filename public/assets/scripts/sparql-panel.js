(function () {
  const state = {
    mode: "sheet",
    endpoints: [],
    templates: [],
    queryResult: null,
    mappingSuggestions: [],
    preview: null,
    tasks: [],
    endpointId: "",
    schemaItems: [],
  };

  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function normalizeApiError(payload, status) {
    const detail = String(payload?.error?.detail || "");
    const message = String(payload?.message || "");
    const source = detail || message;
    const upper = source.toUpperCase();

    if (upper.includes("SOCKET CONNECTION WAS CLOSED UNEXPECTEDLY") || upper.includes("ECONNRESET")) {
      return "远程 SPARQL 服务提前断开连接，请重试；如果是 Wikidata/DBpedia，建议减少 LIMIT 条数。";
    }
    if (upper.includes("TIMEOUT") || upper.includes("ABORT")) {
      return "请求超时，请稍后重试或缩小查询范围。";
    }
    if (upper.includes("ENOTFOUND")) {
      return "Endpoint 无法访问，请检查网络或域名是否正确。";
    }
    if (upper.includes("ECONNREFUSED")) {
      return "目标服务拒绝连接。";
    }
    if (upper.includes("CERT")) {
      return "HTTPS 证书错误。";
    }

    return source || `HTTP ${status}`;
  }

  async function api(path, options = {}) {
    const response = await fetch(path + window.location.search, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success === false) {
      throw new Error(normalizeApiError(payload, response.status));
    }
    return payload?.data ?? payload;
  }

  function safeJson(text) {
    try {
      return JSON.parse(text || "{}");
    } catch {
      return {};
    }
  }

  function renderOptions(select, items, placeholder, mapper) {
    if (!select) return;
    select.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = placeholder;
    select.appendChild(empty);
    items.forEach((item) => {
      const mapped = mapper(item);
      const option = document.createElement("option");
      option.value = mapped.value;
      option.textContent = mapped.label;
      select.appendChild(option);
    });
  }

  function setMode(mode) {
    state.mode = mode;
    const sparqlView = byId("sparqlImportView");
    const managerView = byId("entryManagerView");
    const editorView = byId("entryEditorView");
    const btnSheet = byId("btnEntryModeSheet");
    const btnSparql = byId("btnEntryModeSparql");

    if (mode === "sparql") {
      if (managerView) managerView.style.display = "none";
      if (editorView) editorView.style.display = "none";
      if (sparqlView) sparqlView.style.display = "flex";
    } else {
      if (sparqlView) sparqlView.style.display = "none";
      if (managerView && managerView.style.display === "none") managerView.style.display = "flex";
    }

    if (btnSheet) btnSheet.classList.toggle("accent", mode === "sheet");
    if (btnSparql) btnSparql.classList.toggle("accent", mode === "sparql");
  }

  function toggleEndpointAuthFields(authType) {
    byId("sparqlBasicAuthUserField")?.classList.toggle("is-hidden", authType !== "basic");
    byId("sparqlBasicAuthPasswordField")?.classList.toggle("is-hidden", authType !== "basic");
    byId("sparqlBearerTokenField")?.classList.toggle("is-hidden", authType !== "bearer");
  }

  function getSelectedEndpoint() {
    const endpointId = byId("sparqlEndpointSelect")?.value || state.endpointId;
    return state.endpoints.find((item) => item.id === endpointId) || null;
  }

  function inferEndpointSourceType(endpoint) {
    const id = String(endpoint?.id || "").toLowerCase();
    const url = String(endpoint?.endpoint || "").toLowerCase();
    if (id.includes("wikidata") || url.includes("wikidata.org")) return "wikidata";
    if (id.includes("dbpedia") || url.includes("dbpedia.org")) return "dbpedia";
    return "generic";
  }

  function getCompatibleTemplates(endpoint) {
    if (!endpoint) return [];
    const sourceType = inferEndpointSourceType(endpoint);
    return state.templates.filter((item) => {
      const templateEndpointId = String(item?.endpoint_id || "").trim();
      const templateSourceType = String(item?.source_type || "generic").trim().toLowerCase();
      if (templateEndpointId && templateEndpointId === endpoint.id) return true;
      if (!templateEndpointId && templateSourceType === "generic") return true;
      return templateSourceType === sourceType;
    });
  }

  function flattenOntologyTree(items, depth = 0, result = []) {
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (!item) return;
      result.push({
        id: item.id || item.name || "",
        label: item.label || item.name || item.id || "",
        depth,
      });
      if (Array.isArray(item.children) && item.children.length) {
        flattenOntologyTree(item.children, depth + 1, result);
      }
    });
    return result;
  }

  function refreshTemplateOptions(options = {}) {
    const endpoint = getSelectedEndpoint();
    const select = byId("sparqlTemplateSelect");
    const btnFavorite = byId("btnSparqlTemplateFavorite");
    const btnSave = byId("btnSparqlTemplateSave");
    const compatibleTemplates = getCompatibleTemplates(endpoint);
    const previousTemplateId = options.keepSelection ? select?.value || "" : "";

    if (!endpoint) {
      renderOptions(select, [], "请先选择数据源", (item) => ({ value: item.id, label: item.name }));
      if (select) select.disabled = true;
      if (btnFavorite) btnFavorite.disabled = true;
      if (btnSave) btnSave.disabled = true;
      return;
    }

    renderOptions(select, compatibleTemplates, compatibleTemplates.length ? "选择模板" : "当前数据源暂无可用模板", (item) => ({
      value: item.id,
      label: `${item.category || "模板"} · ${item.name}`,
    }));

    if (select) select.disabled = compatibleTemplates.length === 0;

    const activeTemplate =
      compatibleTemplates.find((item) => item.id === previousTemplateId) ||
      compatibleTemplates[0] ||
      null;

    if (select) select.value = activeTemplate?.id || "";
    if (btnFavorite) btnFavorite.disabled = !activeTemplate;
    if (btnSave) btnSave.disabled = false;

    if (activeTemplate && (!byId("sparqlQueryEditor").value.trim() || options.forceTemplateQuery)) {
      byId("sparqlQueryEditor").value = activeTemplate.query || "";
    }
  }

  function readEndpointForm() {
    return {
      id: state.endpointId || undefined,
      name: byId("sparqlEndpointName")?.value || "",
      endpoint: byId("sparqlEndpointUrl")?.value || "",
      method: byId("sparqlEndpointMethod")?.value || "POST",
      auth_type: byId("sparqlEndpointAuthType")?.value || "none",
      username: byId("sparqlEndpointUsername")?.value || "",
      password: byId("sparqlEndpointPassword")?.value || "",
      token: byId("sparqlEndpointToken")?.value || "",
      timeout: Number(byId("sparqlEndpointTimeout")?.value || 30000),
      retries: Number(byId("sparqlEndpointRetries")?.value || 1),
      user_agent: byId("sparqlEndpointUserAgent")?.value || "",
      description: byId("sparqlEndpointDescription")?.value || "",
      headers: safeJson(byId("sparqlEndpointHeaders")?.value || "{}"),
      default_query: byId("sparqlQueryEditor")?.value || "",
    };
  }

  function fillEndpointForm(item) {
    state.endpointId = item?.id || "";
    byId("sparqlEndpointName").value = item?.name || "";
    byId("sparqlEndpointUrl").value = item?.endpoint || "";
    byId("sparqlEndpointMethod").value = item?.method || "POST";
    byId("sparqlEndpointAuthType").value = item?.auth_type || "none";
    byId("sparqlEndpointUsername").value = item?.username || "";
    byId("sparqlEndpointPassword").value = "";
    byId("sparqlEndpointToken").value = "";
    byId("sparqlEndpointTimeout").value = String(item?.timeout || 30000);
    byId("sparqlEndpointRetries").value = String(item?.retries || 1);
    byId("sparqlEndpointUserAgent").value = item?.user_agent || "KnowledgeGraphSPARQL/1.0";
    byId("sparqlEndpointDescription").value = item?.description || "";
    byId("sparqlEndpointHeaders").value = JSON.stringify(item?.headers || {}, null, 2);
    toggleEndpointAuthFields(item?.auth_type || "none");
    if (item?.default_query && !byId("sparqlQueryEditor").value.trim()) {
      byId("sparqlQueryEditor").value = item.default_query;
    }
  }

  async function loadEndpoints() {
    const data = await api("/api/sparql/endpoints");
    state.endpoints = data.items || [];
    renderOptions(byId("sparqlEndpointSelect"), state.endpoints, "选择数据源", (item) => ({
      value: item.id,
      label: item.name,
    }));
    if (!state.endpointId && state.endpoints.length) {
      fillEndpointForm(state.endpoints[0]);
      byId("sparqlEndpointSelect").value = state.endpoints[0].id;
    }
    refreshTemplateOptions({ keepSelection: true });
  }

  async function loadTemplates() {
    const data = await api("/api/sparql/templates");
    state.templates = data.items || [];
    refreshTemplateOptions({ keepSelection: true });
  }

  async function loadSchemas() {
    const response = await fetch("/api/kb/ontology/tree" + window.location.search)
      .then((res) => res.json())
      .catch(() => ({ items: [] }));
    state.schemaItems = flattenOntologyTree(response.items || []);
    renderOptions(byId("sparqlSchemaSelect"), state.schemaItems, "从本体树选择目标分类", (item) => ({
      value: item.id,
      label: `${"　".repeat(Number(item.depth || 0))}${item.label || item.id}`,
    }));
  }

  function renderTable(host, columns, rows, formatter) {
    if (!host) return;
    if (!rows?.length) {
      host.innerHTML = '<div class="muted" style="padding:12px;">暂无数据</div>';
      return;
    }

    host.innerHTML = `<table class="sparql-table">
      <thead><tr>${columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows
          .map((row) => `<tr>${columns.map((col) => `<td>${formatter ? formatter(row, col) : escapeHtml(row?.[col] ?? "")}</td>`).join("")}</tr>`)
          .join("")}
      </tbody>
    </table>`;
  }

  function recommendRole(column) {
    const lower = String(column || "").toLowerCase();
    if (/(item|entity|person|subject|resource|uri|id)$/.test(lower)) return "entity_id";
    if (/(label|name|title)$/.test(lower)) return "label";
    if (/(description|abstract|summary|comment)$/.test(lower)) return "description";
    if (/(type|class|category)$/.test(lower)) return "type";
    if (/(subject|from|source)$/.test(lower)) return "relation_from";
    if (/(object|to|target)$/.test(lower)) return "relation_to";
    if (/(property|predicate|relation)$/.test(lower)) return "relation_type";
    return "property";
  }

  function renderMappingTable() {
    const host = byId("sparqlMappingTable");
    const rows = state.mappingSuggestions || [];
    if (!rows.length) {
      host.innerHTML = '<div class="muted" style="padding:12px;">执行 SELECT 查询后生成字段映射。</div>';
      return;
    }

    host.innerHTML = `<table class="sparql-table">
      <thead><tr><th>源字段</th><th>映射角色</th><th>目标字段</th></tr></thead>
      <tbody>
      ${rows
        .map(
          (row, index) => `<tr>
            <td>${escapeHtml(row.source)}</td>
            <td>
              <select data-index="${index}" class="kb-select sparql-map-role">
                ${["entity_id", "label", "description", "type", "property", "relation_from", "relation_to", "relation_type", "ignore"]
                  .map((role) => `<option value="${role}" ${role === row.role ? "selected" : ""}>${role}</option>`)
                  .join("")}
              </select>
            </td>
            <td><input data-index="${index}" class="kb-input sparql-map-target" value="${escapeHtml(row.targetField || row.source)}" /></td>
          </tr>`,
        )
        .join("")}
      </tbody>
    </table>`;

    host.querySelectorAll(".sparql-map-role").forEach((select) => {
      select.addEventListener("change", (event) => {
        const index = Number(event.target.dataset.index);
        state.mappingSuggestions[index].role = event.target.value;
      });
    });

    host.querySelectorAll(".sparql-map-target").forEach((input) => {
      input.addEventListener("input", (event) => {
        const index = Number(event.target.dataset.index);
        state.mappingSuggestions[index].targetField = event.target.value;
      });
    });
  }

  function renderResult() {
    const result = state.queryResult;
    const host = byId("sparqlResultTable");
    const raw = byId("sparqlRawResponse");

    if (!result) {
      host.innerHTML = "";
      raw.textContent = "";
      byId("sparqlResultSummary").textContent = "还没有执行查询。";
      return;
    }

    byId("sparqlResultSummary").textContent = `类型：${result.queryType} · 返回 ${result.total} 条 · 耗时 ${result.duration} ms`;
    raw.textContent = typeof result.raw === "string" ? result.raw : JSON.stringify(result.raw, null, 2);

    if (result.queryType === "SELECT") {
      const keyword = (byId("sparqlResultSearch").value || "").trim().toLowerCase();
      const rows = (result.rows || []).filter((row) => !keyword || JSON.stringify(row).toLowerCase().includes(keyword));
      const pageSize = Number(byId("sparqlPageSize").value || 50);
      renderTable(host, result.columns || [], rows.slice(0, pageSize), (row, col) => {
        const value = row?.[col];
        const text = value?.value ?? "";
        return `<div title="${escapeHtml(JSON.stringify(value || {}))}">${escapeHtml(text)}</div>`;
      });

      state.mappingSuggestions = (result.columns || []).map((column) => ({
        source: column,
        role: recommendRole(column),
        targetField: column,
      }));
      renderMappingTable();
      byId("btnSparqlBuildPreview").disabled = false;
      return;
    }

    if (result.queryType === "ASK") {
      host.innerHTML = `<div style="padding:12px;">查询结果：<strong>${result.boolean ? "是" : "否"}</strong></div>`;
      byId("btnSparqlBuildPreview").disabled = true;
      return;
    }

    renderTable(host, ["subject", "predicate", "object"], result.triples || [], (row, col) => escapeHtml(row?.[col]?.value ?? ""));
    byId("btnSparqlBuildPreview").disabled = true;
  }

  async function runQuery() {
    const endpointId = byId("sparqlEndpointSelect").value || state.endpointId;
    if (!endpointId) throw new Error("请先选择数据源。");

    const query = byId("sparqlQueryEditor").value.trim();
    if (!query) throw new Error("请输入 SPARQL 查询。");

    byId("sparqlQueryMeta").textContent = "查询执行中...";
    const result = await api("/api/sparql/query", {
      method: "POST",
      body: JSON.stringify({
        endpointId,
        query,
        method: byId("sparqlEndpointMethod").value,
        timeout: Number(byId("sparqlEndpointTimeout").value || 30000),
        pageSize: Number(byId("sparqlPageSize").value || 50),
      }),
    });
    state.queryResult = result;
    renderResult();
    byId("sparqlQueryMeta").textContent = `查询完成：${result.queryType} · ${result.duration} ms`;
  }

  async function buildPreview() {
    const endpointId = byId("sparqlEndpointSelect").value || state.endpointId;
    const preview = await api("/api/sparql/import/preview", {
      method: "POST",
      body: JSON.stringify({
        endpointId,
        query: byId("sparqlQueryEditor").value,
        mapping: {
          defaultEntityType: byId("sparqlDefaultEntityType").value || "SPARQL实体",
          fields: state.mappingSuggestions,
        },
      }),
    });
    state.preview = preview;
    byId("sparqlPreviewSummary").textContent =
      `原始行数 ${preview.summary.rawRows} · 实体 ${preview.summary.entityCount} · 关系 ${preview.summary.relationCount} · 新增实体 ${preview.summary.createEntityCount} · 更新实体 ${preview.summary.updateEntityCount}`;
    renderTable(byId("sparqlPreviewEntities"), ["sourceId", "label", "type", "action", "warning"], preview.entities || []);
    renderTable(byId("sparqlPreviewRelations"), ["from", "property", "to", "action", "warning"], preview.relations || []);
    byId("btnSparqlImport").disabled = false;
  }

  async function executeImport() {
    const endpointId = byId("sparqlEndpointSelect").value || state.endpointId;
    const taskName = byId("sparqlTaskName").value.trim() || `SPARQL 导入 ${new Date().toLocaleString("zh-CN")}`;
    const data = await api("/api/sparql/import", {
      method: "POST",
      body: JSON.stringify({
        endpointId,
        query: byId("sparqlQueryEditor").value,
        mapping: {
          defaultEntityType: byId("sparqlDefaultEntityType").value || "SPARQL实体",
          fields: state.mappingSuggestions,
        },
        schemaId: byId("sparqlSchemaSelect").value || null,
        name: taskName,
      }),
    });
    byId("sparqlPreviewSummary").textContent =
      `导入完成：新增节点 ${data.summary.createdNodes} · 更新节点 ${data.summary.updatedNodes} · 新增关系 ${data.summary.createdEdges} · 失败 ${data.summary.failed}`;
    await loadTasks();
  }

  async function loadTasks() {
    const data = await api("/api/sparql/import/tasks");
    state.tasks = data.items || [];
    const host = byId("sparqlTaskList");
    if (!state.tasks.length) {
      host.innerHTML = '<div class="muted">暂无导入任务</div>';
      return;
    }

    host.innerHTML = state.tasks
      .map(
        (task) => `<div class="sparql-task-item">
          <div><strong>${escapeHtml(task.name || task.id)}</strong></div>
          <div class="status">状态：${escapeHtml(task.status || "-")}</div>
          <div class="status">实体：${escapeHtml(task.entity_count || 0)} · 关系：${escapeHtml(task.relation_count || 0)}</div>
          <div class="sparql-actions">
            <button class="btn sm" data-action="logs" data-task="${escapeHtml(task.id)}">日志</button>
            <button class="btn sm" data-action="retry" data-task="${escapeHtml(task.id)}">重试</button>
            <button class="btn sm" data-action="delete" data-task="${escapeHtml(task.id)}">删除</button>
          </div>
        </div>`,
      )
      .join("");

    host.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const taskId = button.dataset.task;
        const action = button.dataset.action;
        if (!taskId) return;

        if (action === "logs") {
          const logs = await api(`/api/sparql/import/tasks/${encodeURIComponent(taskId)}/logs`);
          byId("sparqlTaskLogs").textContent = JSON.stringify(logs.items || [], null, 2);
        } else if (action === "retry") {
          await api(`/api/sparql/import/tasks/${encodeURIComponent(taskId)}/retry`, { method: "POST" });
          await loadTasks();
        } else if (action === "delete") {
          await api(`/api/sparql/import/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
          await loadTasks();
        }
      });
    });
  }

  async function saveEndpoint() {
    const result = await api("/api/sparql/endpoints", {
      method: "POST",
      body: JSON.stringify(readEndpointForm()),
    });
    byId("sparqlConnectionStatus").textContent = `数据源已保存：${result.name}`;
    state.endpointId = result.id;
    await loadEndpoints();
    byId("sparqlEndpointSelect").value = result.id;
    refreshTemplateOptions({ forceTemplateQuery: true });
  }

  async function saveTemplateFromEditor() {
    const endpoint = getSelectedEndpoint();
    if (!endpoint) throw new Error("请先选择数据源，再保存查询模板。");

    const name = prompt("模板名称", "我的 SPARQL 模板");
    if (!name) return;
    await api("/api/sparql/templates", {
      method: "POST",
      body: JSON.stringify({
        name,
        category: "我的模板",
        source_type: inferEndpointSourceType(endpoint),
        endpoint_id: endpoint.id,
        query: byId("sparqlQueryEditor").value,
        description: "",
      }),
    });
    await loadTemplates();
  }

  async function toggleFavorite() {
    const templateId = byId("sparqlTemplateSelect").value;
    if (!templateId) return;
    await api(`/api/sparql/templates/${encodeURIComponent(templateId)}/favorite`, { method: "POST" });
    await loadTemplates();
  }

  async function testEndpoint() {
    const result = await api("/api/sparql/endpoints/test", {
      method: "POST",
      body: JSON.stringify(readEndpointForm()),
    });
    byId("sparqlConnectionStatus").textContent = result.success
      ? `连接成功 · HTTP ${result.httpStatus} · ${result.duration} ms`
      : `连接失败：${result.errorReason}`;
  }

  function showError(error) {
    const text = error?.message || String(error || "");
    byId("sparqlConnectionStatus").textContent = text;
    byId("sparqlQueryMeta").textContent = text;
  }

  async function bootstrap() {
    if (!byId("sparqlImportView")) return;

    byId("btnEntryModeSheet")?.addEventListener("click", () => setMode("sheet"));
    byId("btnEntryModeSparql")?.addEventListener("click", () => setMode("sparql"));

    byId("sparqlEndpointSelect")?.addEventListener("change", (event) => {
      const selected = state.endpoints.find((item) => item.id === event.target.value);
      if (selected) {
        fillEndpointForm(selected);
        refreshTemplateOptions({ forceTemplateQuery: true });
        byId("sparqlConnectionStatus").textContent = `已载入数据源：${selected.name}`;
      }
    });

    byId("sparqlEndpointAuthType")?.addEventListener("change", (event) => {
      toggleEndpointAuthFields(event.target.value);
    });

    byId("sparqlTemplateSelect")?.addEventListener("change", (event) => {
      const template = getCompatibleTemplates(getSelectedEndpoint()).find((item) => item.id === event.target.value);
      byId("btnSparqlTemplateFavorite").disabled = !template;
      if (template) {
        byId("sparqlQueryEditor").value = template.query || "";
      }
    });

    byId("sparqlSchemaSelect")?.addEventListener("change", (event) => {
      const selected = state.schemaItems.find((item) => item.id === event.target.value);
      if (selected && byId("sparqlDefaultEntityType")) {
        byId("sparqlDefaultEntityType").value = selected.label || selected.id || "SPARQL实体";
      }
    });

    byId("btnSparqlEndpointNew")?.addEventListener("click", () => {
      state.endpointId = "";
      fillEndpointForm({});
      byId("sparqlEndpointSelect").value = "";
      refreshTemplateOptions();
      byId("sparqlConnectionStatus").textContent = "请填写新的数据源必要信息。";
    });

    byId("btnSparqlEndpointSave")?.addEventListener("click", () => saveEndpoint().catch(showError));

    byId("btnSparqlEndpointDelete")?.addEventListener("click", async () => {
      const endpointId = state.endpointId || byId("sparqlEndpointSelect").value;
      if (!endpointId || !window.confirm("确定删除当前数据源吗？")) return;
      await api(`/api/sparql/endpoints/${encodeURIComponent(endpointId)}`, { method: "DELETE" });
      state.endpointId = "";
      await loadEndpoints();
    });

    byId("btnSparqlEndpointTest")?.addEventListener("click", () => testEndpoint().catch(showError));
    byId("btnSparqlTemplateSave")?.addEventListener("click", () => saveTemplateFromEditor().catch(showError));
    byId("btnSparqlTemplateFavorite")?.addEventListener("click", () => toggleFavorite().catch(showError));
    byId("btnSparqlRun")?.addEventListener("click", () => runQuery().catch(showError));

    byId("btnSparqlClear")?.addEventListener("click", () => {
      byId("sparqlQueryEditor").value = "";
      state.queryResult = null;
      state.preview = null;
      byId("sparqlRawResponse").textContent = "";
      renderResult();
      renderMappingTable();
    });

    byId("btnSparqlShowRaw")?.addEventListener("click", () => {
      const raw = byId("sparqlRawResponse");
      raw.style.display = raw.style.display === "none" ? "block" : "none";
    });

    byId("sparqlResultSearch")?.addEventListener("input", renderResult);
    byId("sparqlPageSize")?.addEventListener("change", renderResult);
    byId("btnSparqlBuildPreview")?.addEventListener("click", () => buildPreview().catch(showError));
    byId("btnSparqlImport")?.addEventListener("click", () => executeImport().catch(showError));

    byId("sparqlQueryEditor")?.addEventListener("keydown", (event) => {
      if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        runQuery().catch(showError);
      }
    });

    await loadEndpoints();
    toggleEndpointAuthFields(byId("sparqlEndpointAuthType")?.value || "none");
    await loadTemplates();
    await loadSchemas();
    await loadTasks();
    renderMappingTable();
    refreshTemplateOptions({ keepSelection: true });
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
