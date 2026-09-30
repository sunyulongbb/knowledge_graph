const READ_QUERY_TYPES = new Set(["SELECT", "ASK", "CONSTRUCT", "DESCRIBE"]);
const BLOCKED_KEYWORDS = [
  "INSERT",
  "DELETE",
  "LOAD",
  "CLEAR",
  "CREATE",
  "DROP",
  "COPY",
  "MOVE",
  "ADD",
];

function stripComments(query: string) {
  return query.replace(/#[^\n\r]*/g, " ");
}

function stripPrefixes(query: string) {
  return query
    .split(/\r?\n/)
    .filter((line) => !/^\s*(PREFIX|BASE)\b/i.test(line))
    .join("\n");
}

export function normalizeQuery(query: string) {
  return stripPrefixes(stripComments(String(query || ""))).trim();
}

export function detectQueryType(query: string) {
  const normalized = normalizeQuery(query);
  const match = normalized.match(/\b(SELECT|ASK|CONSTRUCT|DESCRIBE|INSERT|DELETE|LOAD|CLEAR|CREATE|DROP|COPY|MOVE|ADD)\b/i);
  return match?.[1] ? match[1].toUpperCase() : "";
}

export function ensureReadOnlyQuery(query: string) {
  const source = normalizeQuery(query).toUpperCase();
  for (const keyword of BLOCKED_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`, "i").test(source)) {
      throw new Error(`禁止执行 ${keyword} 语句`);
    }
  }
  const type = detectQueryType(query);
  if (!READ_QUERY_TYPES.has(type)) {
    throw new Error("仅允许执行 SELECT / ASK / CONSTRUCT / DESCRIBE 只读查询");
  }
  return type;
}

export function hasLimitClause(query: string) {
  return /\bLIMIT\s+\d+\b/i.test(query);
}

export function applyTemplateVariables(query: string, context: Record<string, any>) {
  return String(query || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    if (!(key in context)) return "";
    return String(context[key] ?? "");
  });
}
