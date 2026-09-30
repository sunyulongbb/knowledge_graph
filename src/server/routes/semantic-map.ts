import { db, getProjectByIdentifier } from "../db.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

type SemanticNodeRow = {
  id: string;
  name?: string | null;
  type?: string | null;
  tags?: string | null;
  description?: string | null;
  images?: string | null;
  covers?: string | null;
  videos?: string | null;
  link?: string | null;
  wiki_md?: string | null;
  data?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  x?: number | null;
  y?: number | null;
  semantic_size?: number | null;
  semantic_color?: string | null;
  semantic_hot?: number | null;
};

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  Object.entries(CORS_HEADERS).forEach(([key, value]) =>
    headers.set(key, value),
  );
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function clampLimit(value: number, fallback: number, max: number) {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), max);
}

function normalizeNumberParam(raw: string | null) {
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function parseJsonArray(raw: unknown) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeJsonObject(raw: unknown) {
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function deriveSemanticMetrics(row: SemanticNodeRow) {
  const tags = parseJsonArray(row.tags).filter((item) =>
    String(item || "").trim(),
  );
  const images = parseJsonArray(row.images).filter((item) =>
    String(item || "").trim(),
  );
  const covers = parseJsonArray(row.covers).filter((item) =>
    String(item || "").trim(),
  );
  const videos = parseJsonArray(row.videos).filter((item) =>
    String(item || "").trim(),
  );
  const dataObj = safeJsonObject(row.data);
  const mentionCount =
    dataObj &&
    dataObj.mentions &&
    typeof dataObj.mentions === "object" &&
    !Array.isArray(dataObj.mentions)
      ? Object.keys(dataObj.mentions).length
      : 0;

  const richness =
    tags.length +
    images.length * 2 +
    covers.length * 2 +
    videos.length * 3 +
    (row.description ? 2 : 0) +
    (row.link ? 1 : 0) +
    (row.wiki_md ? 2 : 0) +
    mentionCount;

  const computedSize = Math.max(4, Math.min(18, 4 + richness * 0.45));
  const computedHot = Math.max(0, Math.min(100, 12 + richness * 6));

  return {
    size:
      typeof row.semantic_size === "number" && Number.isFinite(row.semantic_size)
        ? row.semantic_size
        : Number(computedSize.toFixed(2)),
    hot:
      typeof row.semantic_hot === "number" && Number.isFinite(row.semantic_hot)
        ? row.semantic_hot
        : computedHot,
  };
}

function formatSemanticNode(row: SemanticNodeRow) {
  const metrics = deriveSemanticMetrics(row);
  const fallback =
    typeof row.x === "number" && typeof row.y === "number"
      ? null
      : deriveFallbackPosition(row);
  return {
    id: String(row.id || "").trim(),
    label: String(row.name || row.id || "").trim(),
    type: String(row.type || "").trim(),
    tags: row.tags || "[]",
    description: String(row.description || "").trim(),
    x: typeof row.x === "number" ? row.x : fallback?.x ?? null,
    y: typeof row.y === "number" ? row.y : fallback?.y ?? null,
    size: metrics.size,
    color: row.semantic_color || null,
    hot: metrics.hot,
  };
}

function formatSemanticDetail(row: SemanticNodeRow) {
  const base = formatSemanticNode(row);
  return {
    ...base,
    name: String(row.name || row.id || "").trim(),
    images: parseJsonArray(row.images),
    covers: parseJsonArray(row.covers),
    videos: parseJsonArray(row.videos),
    link: row.link || "",
    wiki_md: row.wiki_md || "",
    data: safeJsonObject(row.data),
    created_at: row.created_at || "",
    updated_at: row.updated_at || "",
  };
}

function hashText(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}

function deriveFallbackPosition(row: {
  id?: string | null;
  name?: string | null;
  type?: string | null;
}) {
  const key = `${row.id || ""}|${row.type || ""}|${row.name || ""}`;
  const hashA = hashText(key);
  const hashB = hashText(`semantic:${key}`);
  const angle = ((hashA % 3600) / 3600) * Math.PI * 2;
  const radius = 120 + (hashB % 900);
  const orbit = 40 + ((hashA >>> 3) % 180);
  return {
    x: Number((Math.cos(angle) * radius + Math.sin(angle * 3) * orbit).toFixed(3)),
    y: Number((Math.sin(angle) * radius + Math.cos(angle * 2) * orbit).toFixed(3)),
  };
}

function getScope(url: URL) {
  const dbParam = (url.searchParams.get("db") || "").trim();
  const scopedProject =
    dbParam && dbParam !== "app" ? getProjectByIdentifier(dbParam) : null;
  const scopedProjectId = Number(scopedProject?.id || 0) || null;
  return {
    hasProjectScope: scopedProjectId !== null,
    scopedProjectId,
    scopedClause(alias = "n") {
      return `${alias}.project_id = ?`;
    },
  };
}

function buildBaseQuery(hasProjectScope: boolean) {
  return `
    SELECT
      n.id,
      n.name,
      n.type,
      n.tags,
      n.description,
      n.images,
      n.covers,
      n.videos,
      n.link,
      n.wiki_md,
      n.data,
      n.created_at,
      n.updated_at,
      s.x,
      s.y,
      s.size AS semantic_size,
      s.color AS semantic_color,
      s.hot AS semantic_hot
    FROM nodes n
    LEFT JOIN semantic_nodes s ON s.id = n.id
    WHERE 1 = 1
    ${hasProjectScope ? "AND n.project_id = ?" : ""}
  `;
}

export async function handleSemanticMapRoutes(
  req: Request,
  url: URL,
  method: string,
) {
  const { hasProjectScope, scopedProjectId } = getScope(url);

  if (method === "OPTIONS" && url.pathname.startsWith("/api/semantic-map/")) {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (url.pathname === "/api/semantic-map/init" && method === "GET") {
    const limit = clampLimit(
      Number(url.searchParams.get("limit") || "50000"),
      50000,
      100000,
    );
    try {
      const rows = db
        .query(
          `
            ${buildBaseQuery(hasProjectScope)}
            ORDER BY
              COALESCE(s.hot, 0) DESC,
              COALESCE(s.size, 4) DESC,
              datetime(COALESCE(n.updated_at, n.created_at)) DESC
            LIMIT ?
          `,
        )
        .all(
          ...(hasProjectScope && scopedProjectId !== null
            ? [scopedProjectId, limit]
            : [limit]),
        ) as SemanticNodeRow[];

      const items = rows.map(formatSemanticNode);
      return json({ items, limit });
    } catch (err) {
      console.error("semantic-map init failed", err);
      return json({ error: "semantic-map init failed" }, { status: 500 });
    }
  }

  if (url.pathname === "/api/semantic-map/viewport" && method === "GET") {
    const minX = normalizeNumberParam(url.searchParams.get("minX"));
    const maxX = normalizeNumberParam(url.searchParams.get("maxX"));
    const minY = normalizeNumberParam(url.searchParams.get("minY"));
    const maxY = normalizeNumberParam(url.searchParams.get("maxY"));
    if (
      minX === null ||
      maxX === null ||
      minY === null ||
      maxY === null
    ) {
      return json(
        { error: "minX, maxX, minY, maxY are required numbers" },
        { status: 400 },
      );
    }
    const limit = clampLimit(
      Number(url.searchParams.get("limit") || "10000"),
      10000,
      50000,
    );
    try {
      const rows = db
        .query(
          `
            ${buildBaseQuery(hasProjectScope)}
            ORDER BY
              COALESCE(s.hot, 0) DESC,
              COALESCE(s.size, 4) DESC,
              datetime(COALESCE(n.updated_at, n.created_at)) DESC
          `,
        )
        .all(
          ...(hasProjectScope && scopedProjectId !== null
            ? [scopedProjectId]
            : []),
        ) as SemanticNodeRow[];

      const items = rows
        .map(formatSemanticNode)
        .filter(
          (item) =>
            typeof item.x === "number" &&
            typeof item.y === "number" &&
            item.x >= minX &&
            item.x <= maxX &&
            item.y >= minY &&
            item.y <= maxY,
        )
        .slice(0, limit);
      return json({ items, limit, minX, maxX, minY, maxY });
    } catch (err) {
      console.error("semantic-map viewport failed", err);
      return json({ error: "semantic-map viewport failed" }, { status: 500 });
    }
  }

  if (url.pathname === "/api/semantic-map/search" && method === "GET") {
    const q = String(url.searchParams.get("q") || "").trim();
    const limit = clampLimit(
      Number(url.searchParams.get("limit") || "100"),
      100,
      100,
    );
    if (!q) return json({ items: [] });
    const like = `%${q}%`;
    try {
      const rows = db
        .query(
          `
            SELECT
              n.id,
              n.name,
              n.type,
              n.tags,
              n.description,
              n.images,
              n.covers,
              n.videos,
              n.link,
              n.wiki_md,
              n.data,
              n.created_at,
              n.updated_at,
              s.x,
              s.y,
              s.size AS semantic_size,
              s.color AS semantic_color,
              s.hot AS semantic_hot
            FROM nodes n
            LEFT JOIN semantic_nodes s ON s.id = n.id
            WHERE (
              n.name LIKE ?
              OR n.tags LIKE ?
              OR n.description LIKE ?
            )
            ${hasProjectScope ? "AND n.project_id = ?" : ""}
            ORDER BY datetime(COALESCE(n.updated_at, n.created_at)) DESC
            LIMIT ?
          `,
        )
        .all(
          ...(hasProjectScope && scopedProjectId !== null
            ? [like, like, like, scopedProjectId, limit]
            : [like, like, like, limit]),
        ) as SemanticNodeRow[];

      const items = rows.map(formatSemanticNode);
      return json({ items, limit, q });
    } catch (err) {
      console.error("semantic-map search failed", err);
      return json({ error: "semantic-map search failed" }, { status: 500 });
    }
  }

  if (
    url.pathname.startsWith("/api/semantic-map/detail/") &&
    method === "GET"
  ) {
    const prefix = "/api/semantic-map/detail/";
    const rawId = decodeURIComponent(url.pathname.slice(prefix.length)).trim();
    if (!rawId) {
      return json({ error: "Missing id" }, { status: 400 });
    }
    try {
      const row = db
        .query(
          `
            SELECT
              n.id,
              n.name,
              n.type,
              n.tags,
              n.description,
              n.images,
              n.covers,
              n.videos,
              n.link,
              n.wiki_md,
              n.data,
              n.created_at,
              n.updated_at,
              s.x,
              s.y,
              s.size AS semantic_size,
              s.color AS semantic_color,
              s.hot AS semantic_hot
            FROM nodes n
            LEFT JOIN semantic_nodes s ON s.id = n.id
            WHERE n.id = ?
            ${hasProjectScope ? "AND n.project_id = ?" : ""}
            LIMIT 1
          `,
        )
        .get(
          ...(hasProjectScope && scopedProjectId !== null
            ? [rawId, scopedProjectId]
            : [rawId]),
        ) as SemanticNodeRow | null;

      if (!row) {
        return json({ error: "Not found" }, { status: 404 });
      }
      return json({ item: formatSemanticDetail(row) });
    } catch (err) {
      console.error("semantic-map detail failed", err);
      return json({ error: "semantic-map detail failed" }, { status: 500 });
    }
  }

  return null;
}
