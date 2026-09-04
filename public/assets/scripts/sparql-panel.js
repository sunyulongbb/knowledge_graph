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
    dataset: "",
    schemaItems: [],
    resultGrid: null,
    previewColumnLabels: null,
    previewValueColumns: null,
    isStructuredPreview: false,
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
    const entryPanel = byId("entryPanel");
    const sparqlView = byId("sparqlImportView");
    const managerView = byId("entryManagerView");
    const editorView = byId("entryEditorView");
    const fileForm = byId("entryFileForm");
    const apiForm = byId("entryApiForm");
    const btnSheet = byId("btnEntryModeSheet");
    const btnSparql = byId("btnEntryModeSparql");

    if (mode === "sparql") {
      if (entryPanel) entryPanel.dataset.entryMode = "sparql";
      if (fileForm) fileForm.style.display = "none";
      if (apiForm) apiForm.style.display = "none";
      if (managerView) managerView.style.display = "none";
      if (editorView) editorView.style.display = "none";
      if (sparqlView) sparqlView.style.display = "flex";
    } else {
      if (entryPanel) entryPanel.dataset.entryMode = "sheet";
      if (fileForm) fileForm.style.display = "none";
      if (apiForm) apiForm.style.display = "none";
      if (sparqlView) sparqlView.style.display = "none";
      if (managerView && managerView.style.display === "none") managerView.style.display = "flex";
      if (editorView) editorView.style.display = "flex";
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

  async function loadFusekiDatasets() {
    const select = byId("sparqlDatasetSelect");
    if (!select) return;
    const endpointId = byId("sparqlEndpointSelect")?.value || state.endpointId;
    if (!endpointId) return;
    const endpointUrl = getSelectedEndpoint()?.endpoint || byId("sparqlEndpointUrl")?.value || "";
    const pathParts = String(endpointUrl).split("?")[0].split("/").filter(Boolean);
    const sparqlIndex = pathParts.lastIndexOf("sparql");
    const fallback = sparqlIndex > 0 ? pathParts[sparqlIndex - 1] : "";
    const showFallback = () => {
      if (!fallback) return false;
      renderOptions(select, [{ id: fallback, label: fallback }], "请选择 Dataset", (item) => ({ value: item.id, label: item.label }));
      select.value = state.dataset || fallback;
      state.dataset = select.value;
      select.disabled = false;
      return true;
    };
    showFallback();
    byId("sparqlDatasetHint").textContent = fallback ? `当前使用 Endpoint 中的 Dataset：${fallback}；正在读取完整列表…` : "正在读取 Dataset…";
    try {
      const data = await api("/api/sparql/fuseki/datasets", { method: "POST", body: JSON.stringify({ endpointId }) });
      const items = data.items || [];
      if (items.length) {
        renderOptions(select, items, "请选择 Dataset", (item) => ({ value: item.id, label: item.label }));
        select.value = state.dataset || data.current || fallback || items[0]?.id || "";
        state.dataset = select.value;
        select.disabled = false;
        byId("sparqlDatasetHint").textContent = `已读取 ${items.length} 个 Dataset`;
      } else if (!showFallback()) {
        select.innerHTML = '<option value="">未读取到 Dataset</option>';
        select.disabled = true;
      }
    } catch (error) {
      const reason = String(error?.message || error || "");
      const needsAuth = reason.includes("401") || reason.includes("认证");
      if (showFallback()) {
        byId("sparqlDatasetHint").textContent = needsAuth ? `无法读取 Fuseki Dataset 列表，已使用当前 Dataset：${fallback}` : `无法读取 Fuseki 管理列表，已使用 Endpoint 中的 Dataset：${fallback}`;
      } else {
        select.innerHTML = '<option value="">无法读取 Dataset</option>';
        select.disabled = true;
        byId("sparqlDatasetHint").textContent = needsAuth ? "无法读取 Fuseki Dataset 列表。" : "请检查 Fuseki Endpoint。";
      }
    }
  }

  async function loadDatasetStats() {
    const dataset = state.dataset || byId("sparqlDatasetSelect")?.value || "";
    const endpointId = byId("sparqlEndpointSelect")?.value || state.endpointId;
    const hint = byId("sparqlDatasetStats");
    if (!hint) return;
    if (!dataset || !endpointId) { hint.textContent = ""; return; }
    hint.textContent = "正在统计数据量…";
    try {
      const data = await api("/api/sparql/fuseki/datasets/stats", {
        method: "POST",
        body: JSON.stringify({ endpointId, dataset }),
      });
      hint.textContent = `人物数量：${Number(data.personCount || 0).toLocaleString()}`;
    } catch {
      hint.textContent = "数据量暂时无法读取";
    }
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

  async function renderTable(host, columns, rows, formatter, columnLabels = {}) {
    if (!host) return;
    const module = await window.kbBusinessGridModuleReady;
    const grid = module.getBusinessGrid(host, {
      columns: columns.map((column) => ({ id: column, header: [{ text: columnLabels[column] || column }], minWidth: 140, gravity: 1, htmlEnable: Boolean(formatter) })),
      emptyText: "暂无数据",
      selection: "row",
    });
    grid.update((rows || []).map((row, index) => ({
      id: `sparql-${index}`,
      ...Object.fromEntries(columns.map((column) => [column, formatter ? formatter(row, column) : String(row?.[column] ?? "")])),
    })));
  }

  async function renderUnifiedResultGrid(columns, rows, columnLabels = {}) {
    const host = byId("sparqlResultTable");
    if (!host) return;
    const displayValue = (row, column) => {
      const value = row?.[column]?.value ?? "";
      const displayColumn = state.previewValueColumns?.[column];
      if (displayColumn && row?.[displayColumn]?.value) return row[displayColumn].value;
      return state.previewColumnLabels && column === "entity" ? compactName(value) : value;
    };
    const module = await window.kbBusinessGridModuleReady;
    state.resultGrid = module.getBusinessGrid(host, {
      columns: columns.map((column) => ({ id: column, header: [{ text: columnLabels[column] || column }], width: 180, minWidth: 120 })),
      emptyText: "暂无查询结果",
      selection: "row",
    });
    state.resultGrid.update(rows.map((row, index) => ({ id: `result-${index}`, ...Object.fromEntries(columns.map((column) => [column, displayValue(row, column)])) })));
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

  async function renderMappingTable() {
    const host = byId("sparqlMappingTable");
    const rows = state.mappingSuggestions || [];
    if (!rows.length) {
      const module = await window.kbBusinessGridModuleReady;
      state.mappingGrid = module.getBusinessGrid(host, { columns: [{ id: "source", header: [{ text: "源字段" }], gravity: 1 }], emptyText: "执行 SELECT 查询后生成字段映射。" });
      state.mappingGrid.update([]);
      return;
    }
    const module = await window.kbBusinessGridModuleReady;
    const roles = ["entity_id", "label", "description", "type", "property", "relation_from", "relation_to", "relation_type", "ignore"];
    state.mappingGrid = module.getBusinessGrid(host, {
      columns: [
        { id: "source", header: [{ text: "源字段" }], minWidth: 150, gravity: 1 },
        { id: "role", header: [{ text: "映射角色" }], width: 190, editable: true, editorType: "select", options: roles },
        { id: "targetField", header: [{ text: "目标字段" }], minWidth: 180, gravity: 1, editable: true, editorType: "input" },
      ],
      editable: true,
      emptyText: "暂无字段映射",
      onAfterEdit: (value, row, column) => {
        const index = Number(row.mappingIndex);
        if (!state.mappingSuggestions[index]) return;
        if (column.id === "role") state.mappingSuggestions[index].role = String(value);
        if (column.id === "targetField") state.mappingSuggestions[index].targetField = String(value);
      },
    });
    state.mappingGrid.update(rows.map((row, index) => ({ id: `mapping-${index}`, mappingIndex: index, source: row.source, role: row.role, targetField: row.targetField || row.source })));
  }

  function setImportStatus(message) {
    const status = byId("sparqlImportStatus");
    if (status) status.textContent = message;
  }

  function renderResult() {
    const result = state.queryResult;
    const host = byId("sparqlResultTable");
    const raw = byId("sparqlRawResponse");

    if (!result) {
      if (state.resultGrid) state.resultGrid.update([]);
      else host.innerHTML = "";
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
      const displayColumns = new Set(Object.values(state.previewValueColumns || {}));
      const columns = (result.columns || []).filter((column) => !displayColumns.has(column));
      renderUnifiedResultGrid(columns, rows.slice(0, pageSize), state.previewColumnLabels || {});

      if (!state.isStructuredPreview) {
        state.mappingSuggestions = (result.columns || []).map((column) => ({
          source: column,
          role: recommendRole(column),
          targetField: column,
        }));
        renderMappingTable();
      }
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

  const valueOf = (row, key) => row?.[key]?.value || "";
  const iri = (value) => `<${String(value || "").replace(/>/g, "%3E")}>`;
  const compactName = (value) => {
    const text = String(value || "");
    return text.split(/[\/#]/).filter(Boolean).pop() || text;
  };

  const FILTER_OPERATORS = {
    resource: "等于实体",
    literal: "等于文本",
    contains: "包含文本",
    exists: "属性存在",
    notExists: "属性不存在",
  };
  const SPARQL_DISPLAY_NAMES = {
    "wdt:P31": "类型",
    "wdt:P27": "国籍",
    "wdt:P17": "国家",
    "rdfs:label": "名称",
    "wd:Q5": "人类",
    "wd:Q30": "美国",
  };
  const SPARQL_IDENTIFIERS = Object.fromEntries(Object.entries(SPARQL_DISPLAY_NAMES).map(([id, name]) => [name, id]));
  const displaySparqlTerm = (value) => SPARQL_DISPLAY_NAMES[String(value || "").trim()] || String(value || "");
  const resolveSparqlTerm = (value) => SPARQL_IDENTIFIERS[String(value || "").trim()] || String(value || "").trim();

  function createFilterRow(filter = {}) {
    const host = byId("sparqlFilterList");
    if (!host) return;
    const row = document.createElement("div");
    row.className = "sparql-filter-row";
    row.innerHTML = `
      <label class="field"><span>属性</span><input class="kb-input sparql-filter-predicate" list="sparqlPredicateSuggestions" placeholder="选择属性" value="${escapeHtml(displaySparqlTerm(filter.predicate))}" /></label>
      <label class="field"><span>条件</span><select class="kb-select sparql-filter-operator">${Object.entries(FILTER_OPERATORS).map(([value, label]) => `<option value="${value}" ${filter.operator === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      <label class="field sparql-filter-value-field"><span>值</span><input class="kb-input sparql-filter-value" list="sparqlValueSuggestions" placeholder="输入或选择值" value="${escapeHtml(displaySparqlTerm(filter.value))}" /></label>
      <button class="btn sm icon sparql-remove-filter" type="button" title="删除条件" aria-label="删除条件">×</button>`;
    const operator = row.querySelector(".sparql-filter-operator");
    const syncValueState = () => {
      const needsValue = !["exists", "notExists"].includes(operator.value);
      row.querySelector(".sparql-filter-value-field").classList.toggle("is-hidden", !needsValue);
    };
    operator.addEventListener("change", syncValueState);
    row.querySelector(".sparql-remove-filter").addEventListener("click", () => {
      row.remove();
      if (!host.children.length) createFilterRow();
    });
    syncValueState();
    host.appendChild(row);
  }

  function getStructuredFilters() {
    return Array.from(byId("sparqlFilterList")?.querySelectorAll(".sparql-filter-row") || []).map((row) => ({
      predicate: resolveSparqlTerm(row.querySelector(".sparql-filter-predicate")?.value),
      operator: row.querySelector(".sparql-filter-operator")?.value || "resource",
      value: resolveSparqlTerm(row.querySelector(".sparql-filter-value")?.value),
    })).filter((filter) => filter.predicate);
  }

  function sparqlTerm(value, kind = "resource") {
    const text = String(value || "").trim();
    if (!text) return "";
    if (kind === "literal") return JSON.stringify(text);
    if (/^(wd|wdt|rdfs|rdf|xsd):[A-Za-z0-9_.-]+$/.test(text)) return text;
    if (/^https?:\/\//i.test(text)) return iri(text);
    return iri(text);
  }

  async function loadReturnProperties() {
    if (!state.dataset && !byId("sparqlDatasetSelect")?.value) throw new Error("请先在步骤 1 选择 Fuseki Dataset");
    const host = byId("sparqlReturnPropertyChecklist");
    const search = byId("sparqlReturnPropertySearch");
    if (!host) return;
    host.innerHTML = '<span class="muted">正在读取可返回属性…</span>';
    const filters = getStructuredFilters();
    const entityQuery = filters.length ? buildStructuredQuery().query : "";
    const selectIndex = entityQuery.indexOf("SELECT");
    const propertyQuery = filters.length
      ? `PREFIX wd: <http://www.wikidata.org/entity/>\nPREFIX wdt: <http://www.wikidata.org/prop/direct/>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\nSELECT DISTINCT ?property WHERE { { ${entityQuery.slice(selectIndex)} } ?entity ?property ?value } ORDER BY ?property LIMIT 1000`
      : "SELECT DISTINCT ?property WHERE { { ?entity ?property ?value } UNION { GRAPH ?sourceGraph { ?entity ?property ?value } } } ORDER BY ?property LIMIT 1000";
    const result = await executeFusekiLookup(propertyQuery);
    const properties = (result.rows || []).map((row) => valueOf(row, "property")).filter((value) => value && value !== "http://www.w3.org/2000/01/rdf-schema#label");
    const metadataResource = (property) => property.startsWith("http://www.wikidata.org/prop/direct/")
      ? `http://www.wikidata.org/entity/${property.split("/").pop()}` : property;
    const labels = new Map();
    const resources = [...new Set(properties.map(metadataResource))];
    for (let index = 0; index < resources.length; index += 80) {
      const values = resources.slice(index, index + 80).map(iri).join(" ");
      const labelResult = await executeFusekiLookup(`SELECT ?resource ?label WHERE { VALUES ?resource { ${values} } ?resource <http://www.w3.org/2000/01/rdf-schema#label> ?label . FILTER(LANGMATCHES(LANG(?label), "zh")) }`);
      (labelResult.rows || []).forEach((row) => {
        const resource = valueOf(row, "resource");
        const label = valueOf(row, "label");
        if (resource && label && !labels.has(resource)) labels.set(resource, label);
      });
    }
    host.innerHTML = properties.length ? properties.map((property, index) => {
      const label = labels.get(metadataResource(property)) || `未命名属性 ${index + 1}`;
      return `<label title="${escapeHtml(label)}"><input type="checkbox" value="${escapeHtml(property)}" data-display-name="${escapeHtml(label)}" /><span>${escapeHtml(label)}</span></label>`;
    }).join("") : '<span class="muted">当前 Dataset 没有可返回属性</span>';
    if (search) { search.value = ""; search.disabled = !properties.length; }
  }

  async function executeFusekiLookup(query) {
    const endpointId = byId("sparqlEndpointSelect")?.value || state.endpointId;
    if (!endpointId) throw new Error("数据服务尚未就绪");
    return api("/api/sparql/query", {
      method: "POST",
      body: JSON.stringify({ endpointId, dataset: state.dataset || byId("sparqlDatasetSelect")?.value || "", query, method: "GET", timeout: 30000, pageSize: 500 }),
    });
  }

  async function loadFusekiTypes() {
    const select = byId("sparqlSourceTypeSelect");
    if (!select) return;
    select.innerHTML = '<option value="">正在加载类型…</option>';
    const result = await executeFusekiLookup(`SELECT ?type (SAMPLE(?typeLabelValue) AS ?typeLabel)
WHERE {
  { ?entity a ?type } UNION { ?entity <http://www.wikidata.org/prop/direct/P31> ?type }
  OPTIONAL { ?type <http://www.w3.org/2000/01/rdf-schema#label> ?typeLabelValue . FILTER(LANG(?typeLabelValue) = "zh") }
}
GROUP BY ?type
ORDER BY ?type
LIMIT 500`);
    const types = (result.rows || []).map((row) => ({
      value: valueOf(row, "type"),
      label: valueOf(row, "typeLabel") || "未命名类型",
    })).filter((item) => item.value);
    select.innerHTML = '<option value="">请选择类型</option>';
    types.forEach((type) => {
      const option = document.createElement("option");
      option.value = type.value;
      option.textContent = type.label;
      option.title = type.value;
      select.appendChild(option);
    });
    byId("sparqlQueryMeta").textContent = `已加载 ${types.length} 个类型`;
  }

  async function loadFusekiProperties() {
    return;
    const type = byId("sparqlSourceTypeSelect")?.value || "";
    const host = byId("sparqlPropertyChecklist");
    const search = byId("sparqlPropertySearch");
    const selectAll = byId("sparqlPropertySelectAll");
    if (!host) return;
    if (!type) { host.innerHTML = '<span class="muted">请先选择类型</span>'; if (search) search.disabled = true; return; }
    host.innerHTML = '<span class="muted">正在加载属性…</span>';
    const result = await executeFusekiLookup(`SELECT DISTINCT ?property WHERE {
  { ?entity a ${iri(type)} } UNION { ?entity <http://www.wikidata.org/prop/direct/P31> ${iri(type)} }
  ?entity ?property ?value .
}
ORDER BY ?property
LIMIT 1000`);
    // 名称由预览的固定中文名称列负责，避免与 rdfs:label 属性重复展示。
    const propertyUris = (result.rows || [])
      .map((row) => valueOf(row, "property"))
      .filter((property) => property && property !== "http://www.w3.org/2000/01/rdf-schema#label");
    const metadataResource = (property) => property.startsWith("http://www.wikidata.org/prop/direct/")
      ? `http://www.wikidata.org/entity/${property.split("/").pop()}`
      : property;
    const labels = new Map();
    const resources = [...new Set(propertyUris.map(metadataResource))];
    for (let index = 0; index < resources.length; index += 80) {
      const values = resources.slice(index, index + 80).map(iri).join(" ");
      const labelResult = await executeFusekiLookup(`SELECT ?resource ?name WHERE {
  VALUES ?resource { ${values} }
  ?resource <http://www.w3.org/2000/01/rdf-schema#label> ?name .
  FILTER(LANG(?name) = "zh" || LANG(?name) = "en" || LANG(?name) = "")
}`);
      (labelResult.rows || []).forEach((row) => {
        const resource = valueOf(row, "resource");
        const name = valueOf(row, "name");
        const language = String(row?.name?.["xml:lang"] || row?.name?.language || "").toLowerCase();
        const score = language === "zh" ? 3 : language === "en" ? 2 : 1;
        const current = labels.get(resource);
        if (resource && name && (!current || score > current.score)) labels.set(resource, { name, score });
      });
    }
    const properties = propertyUris.map((property) => ({
      property,
      label: labels.get(metadataResource(property))?.name || "未命名属性",
    }));
    host.innerHTML = properties.length ? properties.map((item, index) => {
      return `<label title="${escapeHtml(item.property)}"><input type="checkbox" value="${escapeHtml(item.property)}" data-display-name="${escapeHtml(item.label)}" ${index < 8 ? "checked" : ""} /><span>${escapeHtml(item.label)}</span></label>`;
    }).join("") : '<span class="muted">该类型没有可导入属性</span>';
    if (search) { search.value = ""; search.disabled = !properties.length; }
    if (selectAll) { selectAll.checked = properties.length > 0 && properties.length <= 8; selectAll.indeterminate = properties.length > 8; }
    byId("sparqlQueryMeta").textContent = "请选择要导入的属性";
  }

  function buildStructuredQuery() {
    const filters = getStructuredFilters();
    const clauses = filters.map((filter, index) => {
      const predicate = sparqlTerm(filter.predicate);
      if (!predicate) throw new Error("筛选属性不能为空");
      if (["exists", "notExists"].includes(filter.operator)) {
        const pattern = `?entity ${predicate} ?filter_${index + 1} .`;
        return filter.operator === "notExists" ? `FILTER NOT EXISTS { ${pattern} }` : pattern;
      }
      if (!filter.value) throw new Error(`请填写第 ${index + 1} 个筛选条件的值`);
      if (filter.operator === "contains") return `?entity ${predicate} ?filter_${index + 1} .\n  FILTER(CONTAINS(LCASE(STR(?filter_${index + 1})), LCASE(${sparqlTerm(filter.value, "literal")})))`;
      return `?entity ${predicate} ${sparqlTerm(filter.value, filter.operator === "literal" ? "literal" : "resource")} .`;
    }).join("\n  ");
    const language = byId("sparqlLabelLanguage")?.value || "";
    const labelClause = language
      ? `OPTIONAL { ?entity rdfs:label ?name . FILTER(LANGMATCHES(LANG(?name), ${JSON.stringify(language)})) }`
      : "OPTIONAL { ?entity rdfs:label ?name . }";
    const fields = Array.from(byId("sparqlReturnPropertyChecklist")?.querySelectorAll("input:checked") || []).map((input, index) => ({
      source: `field_${index + 1}`,
      property: input.value,
      label: input.dataset.displayName || compactName(input.value),
    }));
    const optional = fields.map((field) => `OPTIONAL {
    ?entity ${sparqlTerm(field.property)} ?${field.source}Raw .
    OPTIONAL { ?${field.source}Raw rdfs:label ?${field.source}Label . FILTER(LANGMATCHES(LANG(?${field.source}Label), "zh")) }
    BIND(COALESCE(?${field.source}Label, STR(?${field.source}Raw)) AS ?${field.source}Display)
  }`).join("\n  ");
    const selectFields = fields.map((field) => `(SAMPLE(?${field.source}Raw) AS ?${field.source}) (SAMPLE(?${field.source}Display) AS ?${field.source}_display)`).join(" ");
    const entityPattern = clauses || "?entity ?anyProperty ?anyValue .";
    const whereBody = `${entityPattern}\n  ${labelClause}\n  ${optional}`;
    return {
      fields,
      query: `PREFIX wd: <http://www.wikidata.org/entity/>\nPREFIX wdt: <http://www.wikidata.org/prop/direct/>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n\nSELECT ?entity (SAMPLE(?name) AS ?label) ${selectFields}\nWHERE {\n  {\n    ${whereBody}\n  }\n  UNION\n  {\n    GRAPH ?sourceGraph {\n      ${whereBody}\n    }\n  }\n}\nGROUP BY ?entity\nLIMIT 500`,
    };

    const type = byId("sparqlSourceTypeSelect")?.value || "";
    const properties = Array.from(byId("sparqlPropertyChecklist")?.querySelectorAll("input:checked") || []).map((input) => ({
      property: input.value,
      label: input.dataset.displayName || "未命名属性",
    })).filter((item) => item.property !== "http://www.w3.org/2000/01/rdf-schema#label");
    if (!type) throw new Error("请选择类型");
    if (!properties.length) throw new Error("请至少勾选一个属性");
    const legacyFields = properties.map((item, index) => ({ source: `field_${index + 1}`, ...item }));
    const legacyOptional = legacyFields.map((field) => `OPTIONAL {
    ?entity ${iri(field.property)} ?${field.source}Raw .
    OPTIONAL { ?${field.source}Raw <http://www.w3.org/2000/01/rdf-schema#label> ?${field.source}LabelZh . FILTER(LANG(?${field.source}LabelZh) = "zh") }
    OPTIONAL { ?${field.source}Raw <http://www.w3.org/2000/01/rdf-schema#label> ?${field.source}LabelEn . FILTER(LANG(?${field.source}LabelEn) = "en") }
    BIND(COALESCE(?${field.source}LabelZh, ?${field.source}LabelEn, STR(?${field.source}Raw)) AS ?${field.source}Display)
  }`).join("\n  ");
    const legacySelectFields = legacyFields.map((field) => `(SAMPLE(?${field.source}Raw) AS ?${field.source}) (SAMPLE(?${field.source}Display) AS ?${field.source}_display)`).join(" ");
    return {
      fields: legacyFields,
      // A single entity can have several labels or values for one property. Aggregate
      // optional values so each entity remains one preview row instead of a cross-product.
      query: `SELECT ?entity (SAMPLE(?labelValue) AS ?label) ${legacySelectFields}\nWHERE {\n  { ?entity a ${iri(type)} } UNION { ?entity <http://www.wikidata.org/prop/direct/P31> ${iri(type)} }\n  OPTIONAL { ?entity <http://www.w3.org/2000/01/rdf-schema#label> ?labelValue . FILTER(LANG(?labelValue) = "zh") }\n  ${legacyOptional}\n}\nGROUP BY ?entity\nLIMIT 500`,
    };
  }

  function selectedStructuredTypeName() {
    return byId("sparqlDefaultEntityType")?.value || "SPARQL实体";

    const select = byId("sparqlSourceTypeSelect");
    return select?.selectedOptions?.[0]?.textContent?.trim() || byId("sparqlDefaultEntityType")?.value || "SPARQL实体";
  }

  async function previewStructuredImport() {
    const { fields, query } = buildStructuredQuery();
    state.preview = null;
    state.isStructuredPreview = true;
    state.previewValueColumns = Object.fromEntries(fields.map((field) => [field.source, `${field.source}_display`]));
    state.previewColumnLabels = {
      entity: "ID",
      label: "名称",
      ...Object.fromEntries(fields.map((field) => [field.source, field.label])),
    };
    byId("sparqlQueryEditor").value = query;
    await runQuery();
    state.mappingSuggestions = [
      { source: "entity", role: "entity_id", targetField: "entity" },
      { source: "label", role: "label", targetField: "名称" },
      ...fields.map((field) => ({ source: field.source, displaySource: `${field.source}_display`, role: "property", targetField: field.label })),
    ];
    renderMappingTable();
    byId("btnSparqlBuildPreview").disabled = false;
    byId("btnSparqlImport").disabled = false;
    if (byId("sparqlPreviewCount")) byId("sparqlPreviewCount").textContent = `共 ${state.queryResult?.total || 0} 条`;
    if (byId("btnSparqlPreviewImport")) byId("btnSparqlPreviewImport").disabled = false;
    if (byId("btnSparqlConfirmImport")) byId("btnSparqlConfirmImport").disabled = false;
    setImportStatus("数据已就绪，可确认导入");
    byId("sparqlPreviewSummary").textContent = "数据预览已就绪；确认无误后即可同步导入。";
    byId("sparqlQueryMeta").textContent = "数据预览已生成，可确认导入同步。";
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
        dataset: state.dataset || byId("sparqlDatasetSelect")?.value || "",
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
        dataset: state.dataset || byId("sparqlDatasetSelect")?.value || "",
        query: byId("sparqlQueryEditor").value,
        mapping: {
          defaultEntityType: selectedStructuredTypeName(),
          fields: state.mappingSuggestions.filter((field) => !String(field.source || "").endsWith("_display")),
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
    const confirmButton = byId("btnSparqlConfirmImport");
    if (confirmButton) confirmButton.disabled = true;
    setImportStatus("正在导入...");
    try {
      // The confirmation action is self-contained: it generates the import preview
      // when the user did not explicitly click “预览导入” first.
      if (!state.preview) await buildPreview();
      const data = await api("/api/sparql/import", {
        method: "POST",
        body: JSON.stringify({
          endpointId,
          dataset: state.dataset || byId("sparqlDatasetSelect")?.value || "",
          query: byId("sparqlQueryEditor").value,
          mapping: {
            defaultEntityType: selectedStructuredTypeName(),
          fields: state.mappingSuggestions.filter((field) => !String(field.source || "").endsWith("_display")),
          },
          schemaId: byId("sparqlSchemaSelect").value || null,
          name: taskName,
        }),
      });
      byId("sparqlPreviewSummary").textContent =
        `导入完成：新增节点 ${data.summary.createdNodes} · 更新节点 ${data.summary.updatedNodes} · 新增关系 ${data.summary.createdEdges} · 失败 ${data.summary.failed}`;
      const mediaInfo = Number(data.summary.mediaDownloaded || 0) || Number(data.summary.mediaFailed || 0)
        ? ` · 媒体离线 ${data.summary.mediaDownloaded || 0}，失败 ${data.summary.mediaFailed || 0}`
        : "";
      const mediaError = data.summary.mediaErrors?.[0] ? `（${data.summary.mediaErrors[0]}）` : "";
      setImportStatus(`导入成功：${data.summary.imported || 0} 条${mediaInfo}${mediaError}`);
      await loadTasks();
    } catch (error) {
      setImportStatus(`导入失败：${error?.message || "请重试"}`);
      throw error;
    } finally {
      if (confirmButton) confirmButton.disabled = false;
    }
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
    setImportStatus(`操作失败：${text}`);
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
        loadFusekiDatasets().catch(showError);
      }
    });

    byId("sparqlDatasetSelect")?.addEventListener("change", (event) => {
      state.dataset = event.target.value;
      loadDatasetStats();
      byId("sparqlReturnPropertyChecklist").innerHTML = '<span class="muted">Dataset 已变更，请重新读取可用属性</span>';
      byId("sparqlReturnPropertySearch").disabled = true;
    });

    byId("sparqlEndpointAuthType")?.addEventListener("change", (event) => {
      toggleEndpointAuthFields(event.target.value);
    });

    byId("btnSparqlAddFilter")?.addEventListener("click", () => createFilterRow());
    byId("btnSparqlRefreshDatasets")?.addEventListener("click", () => loadFusekiDatasets().catch(showError));
    byId("btnSparqlLoadReturnProperties")?.addEventListener("click", () => loadReturnProperties().catch(showError));
    byId("sparqlReturnPropertySearch")?.addEventListener("input", (event) => {
      const keyword = String(event.target.value || "").trim().toLowerCase();
      byId("sparqlReturnPropertyChecklist")?.querySelectorAll("label").forEach((label) => {
        label.style.display = !keyword || label.textContent.toLowerCase().includes(keyword) || label.title.toLowerCase().includes(keyword) ? "flex" : "none";
      });
    });
    byId("sparqlSourceTypeSelect")?.addEventListener("change", () => loadFusekiProperties().catch(showError));
    byId("btnSparqlStructuredPreview")?.addEventListener("click", () => previewStructuredImport().catch(showError));
    byId("sparqlPropertySearch")?.addEventListener("input", (event) => {
      const keyword = String(event.target.value || "").trim().toLowerCase();
      byId("sparqlPropertyChecklist")?.querySelectorAll("label").forEach((label) => {
        label.style.display = !keyword || label.textContent.toLowerCase().includes(keyword) || label.title.toLowerCase().includes(keyword) ? "flex" : "none";
      });
    });
    byId("sparqlPropertySelectAll")?.addEventListener("change", (event) => {
      byId("sparqlPropertyChecklist")?.querySelectorAll("input[type=checkbox]").forEach((input) => { input.checked = event.target.checked; });
      event.target.indeterminate = false;
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
    byId("btnSparqlPreviewImport")?.addEventListener("click", async () => {
      try {
        await buildPreview();
        if (byId("btnSparqlConfirmImport")) byId("btnSparqlConfirmImport").disabled = false;
      } catch (error) { showError(error); }
    });
    byId("btnSparqlConfirmImport")?.addEventListener("click", () => executeImport().catch(showError));
    byId("btnSparqlCancelSelection")?.addEventListener("click", () => {
      state.queryResult = null;
      state.preview = null;
      state.isStructuredPreview = false;
      state.previewValueColumns = null;
      renderResult();
      if (byId("sparqlPreviewCount")) byId("sparqlPreviewCount").textContent = "共 0 条";
      if (byId("btnSparqlPreviewImport")) byId("btnSparqlPreviewImport").disabled = true;
      if (byId("btnSparqlConfirmImport")) byId("btnSparqlConfirmImport").disabled = true;
      byId("sparqlQueryMeta").textContent = "已取消当前预览数据。";
    });

    byId("sparqlQueryEditor")?.addEventListener("keydown", (event) => {
      if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        runQuery().catch(showError);
      }
    });

    await loadEndpoints();
    await loadFusekiDatasets();
    await loadDatasetStats();
    toggleEndpointAuthFields(byId("sparqlEndpointAuthType")?.value || "none");
    await loadTemplates();
    await loadSchemas();
    await loadTasks();
    createFilterRow({ predicate: "wdt:P31", operator: "resource", value: "wd:Q5" });
    createFilterRow({ predicate: "wdt:P27", operator: "resource", value: "wd:Q30" });
    renderMappingTable();
    refreshTemplateOptions({ keepSelection: true });
    setMode("sparql");
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
