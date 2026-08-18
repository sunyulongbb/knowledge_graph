import {
  addQueryHistory,
  addTaskLog,
  createTask,
  deleteEndpoint,
  deleteQueryHistory,
  deleteTask,
  deleteTemplate,
  getEndpoint,
  getEndpointSecrets,
  getTask,
  listEndpoints,
  listQueryHistory,
  listTaskLogs,
  listTasks,
  listTemplates,
  resolveProjectId,
  saveEndpoint,
  saveTemplate,
  toggleTemplateFavorite,
  updateTask,
} from "../sparql/store.ts";
import { executeSparqlRequest } from "../sparql/client.ts";
import { applyTemplateVariables, detectQueryType, ensureReadOnlyQuery } from "../sparql/query.ts";
import { buildImportPreview, importPreviewToGraph } from "../sparql/importer.ts";
import { fail, ok } from "../sparql/response.ts";
import { sanitizeHeaders, validateEndpointUrl } from "../sparql/security.ts";

function datasetFromEndpoint(endpoint: string) {
  try {
    const parts = new URL(endpoint).pathname.split("/").filter(Boolean);
    const sparqlIndex = parts.lastIndexOf("sparql");
    return sparqlIndex > 0 ? parts[sparqlIndex - 1] : "";
  } catch { return ""; }
}

function fusekiBasePath(endpoint: string) {
  try {
    const parts = new URL(endpoint).pathname.split("/").filter(Boolean);
    const sparqlIndex = parts.lastIndexOf("sparql");
    if (sparqlIndex <= 0) return "";
    return `/${parts.slice(0, sparqlIndex - 1).join("/")}`.replace(/\/$/, "");
  } catch { return ""; }
}

function endpointForDataset(endpoint: any, dataset: unknown) {
  const name = String(dataset || "").trim();
  if (!name) return endpoint;
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) throw new Error("Dataset 名称不合法");
  const url = new URL(String(endpoint.endpoint || ""));
  url.pathname = `${fusekiBasePath(endpoint.endpoint)}/${name}/sparql`;
  url.search = "";
  return { ...endpoint, endpoint: url.toString() };
}

export async function handleSparqlRoutes(req: Request, url: URL, method: string) {
  const projectId = resolveProjectId(url);

  if (url.pathname === "/api/sparql/fuseki/datasets" && method === "POST") {
    try {
      const body = await req.json();
      const endpoint = await getEndpointSecrets(projectId, String(body?.endpointId || ""));
      if (!endpoint) return fail("数据源不存在", "SPARQL_ENDPOINT_NOT_FOUND", null, 404);
      const endpointUrl = new URL(String(endpoint.endpoint || ""));
      // `/$/server` is the public Fuseki server-status API. Unlike the
      // management-only `/$/datasets` endpoint, it lists every active dataset
      // without requiring an administrator session.
      const datasetUrl = new URL(`${fusekiBasePath(endpoint.endpoint)}/$/server`, endpointUrl.origin);
      const headers: Record<string, string> = { Accept: "application/json", ...sanitizeHeaders(endpoint.headers) };
      const adminUsername = String(body?.adminUsername || process.env.FUSEKI_ADMIN_USERNAME || endpoint.username || "").trim();
      const adminPassword = String(body?.adminPassword || process.env.FUSEKI_ADMIN_PASSWORD || endpoint.password || "");
      if (adminUsername && adminPassword) {
        headers.Authorization = `Basic ${Buffer.from(`${adminUsername}:${adminPassword}`).toString("base64")}`;
      }
      if (endpoint.auth_type === "bearer" && endpoint.token) headers.Authorization = `Bearer ${endpoint.token}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      let response: Response;
      try {
        response = await fetch(datasetUrl, { headers, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) throw new Error(`Fuseki 返回 HTTP ${response.status}`);
      const payload = await response.json() as any;
      const rawItems = Array.isArray(payload) ? payload : Array.isArray(payload?.datasets) ? payload.datasets : Array.isArray(payload?.data?.datasets) ? payload.data.datasets : [];
      const items = rawItems.map((item: any) => String(item?.["ds.name"] || item?.name || item || "").replace(/^\//, "").trim())
        .filter((name: string) => /^[A-Za-z0-9_.-]+$/.test(name))
        .map((name: string) => ({ id: name, label: name }));
      const current = datasetFromEndpoint(endpoint.endpoint);
      if (current && !items.some((item: any) => item.id === current)) items.unshift({ id: current, label: current });
      return ok("Dataset 加载成功", { items, current });
    } catch (error) {
      return fail("读取 Fuseki Dataset 失败", "FUSEKI_DATASETS_FAILED", String((error as Error)?.message || error), 400);
    }
  }

  if (url.pathname === "/api/sparql/fuseki/datasets/stats" && method === "POST") {
    try {
      const body = await req.json();
      const endpoint = await getEndpointSecrets(projectId, String(body?.endpointId || ""));
      if (!endpoint) return fail("数据源不存在", "SPARQL_ENDPOINT_NOT_FOUND", null, 404);
      const dataset = String(body?.dataset || "").trim();
      if (!dataset) return fail("缺少 Dataset", "FUSEKI_DATASET_REQUIRED", null, 400);
      const result = await executeSparqlRequest(
        endpointForDataset(endpoint, dataset),
        "SELECT (COUNT(DISTINCT ?person) AS ?personCount) WHERE { { ?person <http://www.w3.org/2000/01/rdf-schema#label> ?name . FILTER(LANGMATCHES(LANG(?name), 'zh')) } UNION { GRAPH ?graph { ?person <http://www.w3.org/2000/01/rdf-schema#label> ?name . FILTER(LANGMATCHES(LANG(?name), 'zh')) } } }",
        { method: "GET", timeout: Math.min(Number(endpoint.timeout || 30000), 30000) },
      );
      const value = result?.rows?.[0]?.personCount?.value || "0";
      return ok("数据量加载成功", { personCount: Number(value) || 0 });
    } catch (error) {
      return fail("读取 Dataset 数据量失败", "FUSEKI_DATASET_STATS_FAILED", String((error as Error)?.message || error), 400);
    }
  }

  if (url.pathname === "/api/sparql/endpoints" && method === "GET") {
    return ok("加载成功", { items: await listEndpoints(projectId) });
  }

  if (url.pathname === "/api/sparql/endpoints" && method === "POST") {
    try {
      const body = await req.json();
      await validateEndpointUrl(String(body?.endpoint || ""));
      const item = await saveEndpoint(projectId, body);
      return ok("保存成功", item);
    } catch (error) {
      return fail("保存数据源失败", "SPARQL_ENDPOINT_SAVE_FAILED", String((error as Error)?.message || error), 400);
    }
  }

  if (url.pathname.startsWith("/api/sparql/endpoints/")) {
    const endpointId = decodeURIComponent(url.pathname.split("/").pop() || "");
    if (!endpointId) return fail("缺少数据源 ID", "SPARQL_ENDPOINT_ID_REQUIRED", null, 400);

    if (method === "GET") {
      const item = await getEndpoint(projectId, endpointId);
      return item ? ok("加载成功", item) : fail("数据源不存在", "SPARQL_ENDPOINT_NOT_FOUND", null, 404);
    }

    if (method === "PUT") {
      try {
        const body = await req.json();
        const item = await saveEndpoint(projectId, { ...body, id: endpointId });
        return ok("更新成功", item);
      } catch (error) {
        return fail("更新数据源失败", "SPARQL_ENDPOINT_UPDATE_FAILED", String((error as Error)?.message || error), 400);
      }
    }

    if (method === "DELETE") {
      deleteEndpoint(projectId, endpointId);
      return ok("删除成功", {});
    }
  }

  if (url.pathname === "/api/sparql/endpoints/test" && method === "POST") {
    try {
      const body = await req.json();
      const config = body?.endpointId ? await getEndpointSecrets(projectId, String(body.endpointId)) : body;
      if (!config) return fail("数据源不存在", "SPARQL_ENDPOINT_NOT_FOUND", null, 404);
      const result = await executeSparqlRequest(config, "ASK { ?s ?p ?o }", {
        method: config.method,
        timeout: config.timeout,
      });
      return ok("连接成功", {
        success: true,
        httpStatus: result.httpStatus,
        responseFormat: result.responseFormat,
        duration: result.duration,
        endpoint: config.endpoint,
        errorReason: "",
      });
    } catch (error) {
      return ok("连接失败", {
        success: false,
        httpStatus: 0,
        responseFormat: "",
        duration: 0,
        endpoint: "",
        errorReason: String((error as Error)?.message || error),
      });
    }
  }

  if (url.pathname === "/api/sparql/query/validate" && method === "POST") {
    try {
      const body = await req.json();
      const queryType = ensureReadOnlyQuery(String(body?.query || ""));
      return ok("校验成功", { queryType });
    } catch (error) {
      return fail("查询校验失败", "SPARQL_QUERY_INVALID", String((error as Error)?.message || error), 400);
    }
  }

  if (url.pathname === "/api/sparql/query" && method === "POST") {
    try {
      const body = await req.json();
      const endpoint = await getEndpointSecrets(projectId, String(body?.endpointId || ""));
      if (!endpoint) return fail("数据源不存在", "SPARQL_ENDPOINT_NOT_FOUND", null, 404);

      const queryText = applyTemplateVariables(String(body?.query || ""), {
        lastImportTime: body?.lastImportTime || "",
        currentTime: new Date().toISOString(),
        page: Number(body?.page || 1),
        pageSize: Number(body?.pageSize || 100),
        offset: (Number(body?.page || 1) - 1) * Number(body?.pageSize || 100),
        limit: Number(body?.pageSize || 100),
      });

      const result = await executeSparqlRequest(endpointForDataset(endpoint, body?.dataset), queryText, body);
      addQueryHistory(projectId, {
        endpoint_id: endpoint.id,
        query: queryText,
        query_type: detectQueryType(queryText),
        result_count: result.total,
        duration: result.duration,
        success: true,
      });
      return ok("查询成功", result);
    } catch (error) {
      addQueryHistory(projectId, {
        endpoint_id: null,
        query: "",
        query_type: "",
        result_count: 0,
        duration: 0,
        success: false,
        error_message: String((error as Error)?.message || error),
      });
      return fail("查询失败", "SPARQL_QUERY_FAILED", String((error as Error)?.message || error), 400);
    }
  }

  if (url.pathname === "/api/sparql/history" && method === "GET") {
    return ok("加载成功", { items: listQueryHistory(projectId) });
  }

  if (url.pathname.startsWith("/api/sparql/history/") && method === "DELETE") {
    deleteQueryHistory(projectId, decodeURIComponent(url.pathname.split("/").pop() || ""));
    return ok("删除成功", {});
  }

  if (url.pathname === "/api/sparql/templates" && method === "GET") {
    return ok("加载成功", { items: listTemplates(projectId) });
  }

  if (url.pathname === "/api/sparql/templates" && method === "POST") {
    const body = await req.json();
    saveTemplate(projectId, body);
    return ok("保存成功", {});
  }

  if (url.pathname.startsWith("/api/sparql/templates/")) {
    const templateId = decodeURIComponent(url.pathname.split("/").filter(Boolean).slice(-1)[0] || "");

    if (method === "PUT") {
      const body = await req.json();
      saveTemplate(projectId, { ...body, id: templateId });
      return ok("更新成功", {});
    }

    if (method === "DELETE") {
      deleteTemplate(projectId, templateId);
      return ok("删除成功", {});
    }

    if (url.pathname.endsWith("/favorite") && method === "POST") {
      toggleTemplateFavorite(projectId, decodeURIComponent(url.pathname.split("/").slice(-2)[0] || ""));
      return ok("更新成功", {});
    }
  }

  if (url.pathname === "/api/sparql/import/preview" && method === "POST") {
    try {
      const body = await req.json();
      const endpoint = await getEndpointSecrets(projectId, String(body?.endpointId || ""));
      if (!endpoint) return fail("数据源不存在", "SPARQL_ENDPOINT_NOT_FOUND", null, 404);
      const result = await executeSparqlRequest(endpointForDataset(endpoint, body?.dataset), String(body?.query || ""), body);
      if (result.queryType !== "SELECT") {
        return fail("导入预览目前只支持 SELECT 查询结果", "SPARQL_IMPORT_QUERY_TYPE_UNSUPPORTED", result.queryType, 400);
      }
      const preview = buildImportPreview(result, body?.mapping || {}, endpoint, projectId);
      return ok("预览生成成功", preview);
    } catch (error) {
      return fail("生成导入预览失败", "SPARQL_IMPORT_PREVIEW_FAILED", String((error as Error)?.message || error), 400);
    }
  }

  if (url.pathname === "/api/sparql/import" && method === "POST") {
    try {
      const body = await req.json();
      const endpoint = await getEndpointSecrets(projectId, String(body?.endpointId || ""));
      if (!endpoint) return fail("数据源不存在", "SPARQL_ENDPOINT_NOT_FOUND", null, 404);

      const result = await executeSparqlRequest(endpointForDataset(endpoint, body?.dataset), String(body?.query || ""), body);
      const preview = buildImportPreview(result, body?.mapping || {}, endpoint, projectId);
      const taskId = createTask(projectId, {
        name: body?.name || `SPARQL 导入 ${new Date().toLocaleString("zh-CN")}`,
        endpoint_id: endpoint.id,
        endpoint: endpoint.endpoint,
        query: body?.query || "",
        query_type: result.queryType,
        schema_id: body?.schemaId || null,
        mapping_config: body?.mapping || {},
        import_config: body?.importConfig || {},
        status: "importing_entities",
        result_count: preview.summary.rawRows,
        entity_count: preview.summary.entityCount,
        relation_count: preview.summary.relationCount,
        started_at: new Date().toISOString(),
      });

      addTaskLog(taskId, "info", "previewing", "开始执行 SPARQL 导入", {
        endpoint: endpoint.endpoint,
      });

      const importSummary = await importPreviewToGraph(preview, {
        ...(body?.importConfig || {}),
        projectId,
      });

      addTaskLog(taskId, "info", "completed", "导入完成", importSummary);
      updateTask(projectId, taskId, {
        status: "completed",
        success_count: importSummary.imported,
        failed_count: importSummary.failed,
        skipped_count: importSummary.skipped,
        finished_at: new Date().toISOString(),
        error_message: null,
      });

      return ok("导入成功", {
        taskId,
        summary: importSummary,
      });
    } catch (error) {
      return fail("执行导入失败", "SPARQL_IMPORT_FAILED", String((error as Error)?.message || error), 400);
    }
  }

  if (url.pathname === "/api/sparql/import/tasks" && method === "GET") {
    return ok("加载成功", { items: listTasks(projectId) });
  }

  if (url.pathname.startsWith("/api/sparql/import/tasks/")) {
    const segments = url.pathname.split("/").filter(Boolean);
    const taskId = decodeURIComponent(segments[segments.indexOf("tasks") + 1] || "");
    if (!taskId) return fail("缺少任务 ID", "SPARQL_TASK_ID_REQUIRED", null, 400);

    if (segments.at(-1) === "logs" && method === "GET") {
      return ok("加载成功", { items: listTaskLogs(taskId) });
    }

    if (segments.at(-1) === "cancel" && method === "POST") {
      updateTask(projectId, taskId, {
        status: "cancelled",
        finished_at: new Date().toISOString(),
      });
      addTaskLog(taskId, "warn", "cancelled", "任务已取消");
      return ok("任务已取消", {});
    }

    if (segments.at(-1) === "retry" && method === "POST") {
      const task = getTask(projectId, taskId);
      if (!task) return fail("任务不存在", "SPARQL_TASK_NOT_FOUND", null, 404);
      updateTask(projectId, taskId, {
        status: "pending",
        error_message: null,
        finished_at: null,
      });
      addTaskLog(taskId, "info", "pending", "任务已重置，可重新导入");
      return ok("任务已重置", task);
    }

    if (method === "GET") {
      const task = getTask(projectId, taskId);
      return task ? ok("加载成功", task) : fail("任务不存在", "SPARQL_TASK_NOT_FOUND", null, 404);
    }

    if (method === "DELETE") {
      deleteTask(projectId, taskId);
      return ok("删除成功", {});
    }
  }

  return null;
}
