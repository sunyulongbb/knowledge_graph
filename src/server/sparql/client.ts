import { ensureReadOnlyQuery } from "./query.ts";
import { parseSparqlResponse } from "./result-parser.ts";
import { mapNetworkError, sanitizeHeaders, validateEndpointUrl } from "./security.ts";

const MAX_RESPONSE_BYTES = Number(process.env.SPARQL_MAX_RESPONSE_BYTES || 2 * 1024 * 1024);

async function readLimitedBody(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    total += next.value.length;
    if (total > MAX_RESPONSE_BYTES) {
      throw new Error("返回内容过大，已被系统拦截");
    }
    chunks.push(next.value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((item) => Buffer.from(item))));
}

export async function executeSparqlRequest(config: any, query: string, options: any = {}) {
  const queryType = ensureReadOnlyQuery(query);
  const endpointUrl = await validateEndpointUrl(config.endpoint);
  const method = String(options?.method || config.method || "POST").toUpperCase();
  const timeout = Math.max(1000, Math.min(Number(options?.timeout || config.timeout || 30000), 120000));
  const retries = Math.max(0, Math.min(Number(config.retries || 1), 3));
  const headers: Record<string, string> = {
    Accept:
      queryType === "SELECT" || queryType === "ASK"
        ? "application/sparql-results+json, application/json;q=0.9"
        : "application/n-triples, text/turtle;q=0.9, application/ld+json;q=0.8, application/rdf+xml;q=0.7",
    "User-Agent": config.user_agent || "KnowledgeGraphSPARQL/1.0",
    ...sanitizeHeaders(config.headers),
  };
  if (config.auth_type === "basic" && config.username && config.password) {
    headers.Authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
  }
  if (config.auth_type === "bearer" && config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  const start = Date.now();
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      let target = endpointUrl.toString();
      const init: RequestInit = {
        method,
        headers,
        redirect: "follow",
        signal: controller.signal,
      };
      if (method === "GET") {
        const requestUrl = new URL(target);
        requestUrl.searchParams.set("query", query);
        target = requestUrl.toString();
      } else if (method === "SPARQL_POST") {
        init.method = "POST";
        headers["Content-Type"] = "application/sparql-query; charset=utf-8";
        init.body = query;
      } else {
        init.method = "POST";
        headers["Content-Type"] = "application/x-www-form-urlencoded; charset=utf-8";
        init.body = new URLSearchParams({ query }).toString();
      }
      const response = await fetch(target, init);
      const contentType = response.headers.get("content-type") || "";
      const body = await readLimitedBody(response);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
      }
      const duration = Date.now() - start;
      const parsed = parseSparqlResponse(body, contentType, duration, query);
      return {
        ...parsed,
        endpoint: endpointUrl.toString(),
        responseFormat: contentType,
        httpStatus: response.status,
      };
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(mapNetworkError(lastError));
}
