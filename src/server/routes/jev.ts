import { adminDb, db } from "../db.ts";
import { containsEntityReference, parseJevScoreAnswer } from "../jev-score.ts";
import { getCurrentUser } from "../auth-context.ts";
import { createHash } from "node:crypto";

type CachedScore = {
  expiresAt: number;
  value: { score: number; rawScore: number; confidence: number | null; model: string; profiles: ProfileResult[] };
};

type AnalysisDefinition = { angle: string; content: string; keywords: string[]; category: string };
type KeywordEvidence = { keyword: string; matched: boolean; evidence: string[] };
type RelatedEntityEvidence = { sourceId: string; sourceName: string; relation: string; evidence: string; matchedKeywords: string[]; sourceUpdatedAt?: string };
type ProfileResult = AnalysisDefinition & { classification: string; confidence: number | null; evidence: string[]; keywordEvidence: KeywordEvidence[]; relatedEvidence: RelatedEntityEvidence[] };

const scoreCache = new Map<string, CachedScore>();
const SCORE_TTL_MS = 10 * 60 * 1000;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function parseArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function textValue(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function parsedValue(value: unknown): any {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}

function collectEntityIds(value: any, output = new Set<string>()) {
  if (!value || output.size >= 50) return output;
  if (Array.isArray(value)) value.forEach((item) => collectEntityIds(item, output));
  else if (typeof value === "object") {
    const candidate = value.id ?? value["entity-id"] ?? value.entity_id ?? value.target;
    if (candidate && /^(?:entity\/)?[A-Za-z]\d+$/i.test(String(candidate))) output.add(String(candidate).replace(/^entity\//, ""));
    Object.values(value).forEach((item) => collectEntityIds(item, output));
  } else if (typeof value === "string") {
    const match = value.match(/^(?:entity\/)?([A-Za-z]\d+)$/i);
    if (match?.[1]) output.add(match[1]);
  }
  return output;
}

function readableValue(value: any, entityNames: Map<string, string>): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((item) => readableValue(item, entityNames)).filter(Boolean).join("；");
  if (typeof value !== "object") {
    const text = String(value);
    const id = text.replace(/^entity\//, "");
    return entityNames.has(id) ? `${entityNames.get(id)}（${id}）` : text;
  }
  const entityId = String(value.id ?? value["entity-id"] ?? value.entity_id ?? value.target ?? "").replace(/^entity\//, "");
  if (entityId && entityNames.has(entityId)) return `${value.label || entityNames.get(entityId)}（${entityId}）`;
  if (typeof value.text === "string") return `${value.text}${value.language ? `（${value.language}）` : ""}`;
  if (value.time) return `${value.time}${value.precision != null ? `，精度 ${value.precision}` : ""}`;
  if (value.amount != null) return `${value.amount}${value.unit && value.unit !== "1" ? ` ${value.unit}` : ""}`;
  if (value.latitude != null && value.longitude != null) return `${value.latitude}, ${value.longitude}`;
  return textValue(value);
}

function evidenceSnippet(text: string, keyword: string, label: string) {
  const lower = text.toLocaleLowerCase();
  const at = lower.indexOf(keyword.toLocaleLowerCase());
  if (at < 0) return "";
  const start = Math.max(0, at - 55);
  const end = Math.min(text.length, at + keyword.length + 75);
  return `${label}：${start ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ")}${end < text.length ? "…" : ""}`;
}

export async function handleJevRoutes(req: Request, url: URL, method: string) {
  if (url.pathname !== "/api/jev/score") return null;
  if (method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  const currentUser = getCurrentUser(req);
  const savedKey = currentUser
    ? (adminDb.query("SELECT jev_api_key FROM users WHERE id = ?").get(currentUser.id) as any)?.jev_api_key
    : "";
  const apiKey = String(savedKey || "").trim();

  let body: { id?: unknown; force?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "请求内容必须是 JSON" }, 400);
  }
  const id = String(body.id || "").trim();
  const force = body.force === true;
  if (!id || id.length > 160) return json({ error: "知识 ID 无效" }, 400);

  const node = db.query(`
    SELECT id, name, type, description, aliases, tags, data, wiki_md, project_id, updated_at,
           jev_analysis_json, jev_analysis_signature, jev_analysis_updated_at
    FROM nodes WHERE id = ? LIMIT 1
  `).get(id) as any;
  if (!node) return json({ error: "知识不存在" }, 404);

  const analysisDefinitions: AnalysisDefinition[] = [];
  const seenAngles = new Set<string>();
  const classRows = db.query(`SELECT c.name, c.analyses FROM classes c INNER JOIN entity_classes ec ON ec.class_id = c.id WHERE ec.entity_id = ? ORDER BY COALESCE(c.sort_order, c.rowid), c.name`).all(id) as any[];
  for (const row of classRows) {
    for (const item of parseArray(row.analyses)) {
      const angle = String(item?.angle || "").trim();
      const content = String(item?.content || "").trim();
      const key = angle.toLocaleLowerCase();
      if (!angle || !content || seenAngles.has(key)) continue;
      seenAngles.add(key);
      analysisDefinitions.push({ angle, content, keywords: parseArray(item?.keywords).map(String).slice(0, 40), category: String(row.name || "") });
      if (analysisDefinitions.length >= 4) break;
    }
    if (analysisDefinitions.length >= 4) break;
  }

  const attributeRows = db.query("SELECT key, datatype, property_name_snapshot, value FROM attributes WHERE node_id = ? ORDER BY created_at, id LIMIT 80").all(id) as any[];
  const parsedAttributes = attributeRows.map((row) => ({ ...row, parsed: parsedValue(row.value) }));
  const referencedIds = new Set<string>();
  parsedAttributes.forEach((row) => collectEntityIds(row.parsed, referencedIds));
  const entityNames = new Map<string, string>();
  for (const referenceId of referencedIds) {
    const referenced = db.query("SELECT name FROM nodes WHERE id = ? LIMIT 1").get(referenceId) as any;
    if (referenced?.name) entityNames.set(referenceId, String(referenced.name));
  }
  const analysisKeywords = [...new Set(analysisDefinitions.flatMap((item) => item.keywords).map((item) => item.toLocaleLowerCase()))];
  const attributeEvidence = parsedAttributes.map((row) => {
    const label = String(row.property_name_snapshot || row.key || "属性");
    const value = readableValue(row.parsed, entityNames).slice(0, 1200);
    const haystack = `${label} ${value}`.toLocaleLowerCase();
    const matchedKeywords = analysisKeywords.filter((keyword) => keyword && haystack.includes(keyword)).slice(0, 12);
    return { property: row.key, label, datatype: row.datatype || "string", value, matched_keywords: matchedKeywords };
  }).sort((a, b) => b.matched_keywords.length - a.matched_keywords.length);
  const incomingRows = db.query(`
    SELECT a.key, a.property_name_snapshot, a.value,
           source.id AS source_id, source.name AS source_name, source.description AS source_description,
           source.aliases AS source_aliases, source.tags AS source_tags, source.updated_at AS source_updated_at
    FROM attributes a
    INNER JOIN nodes source ON source.id = REPLACE(a.node_id, 'entity/', '')
    WHERE a.datatype IN ('wikibase-entityid', 'wikibase-item')
      AND source.id <> ?
      AND source.project_id IS ?
      AND instr(a.value, ?) > 0
    ORDER BY datetime(COALESCE(source.updated_at, source.created_at)) DESC, a.id
    LIMIT 300
  `).all(id.replace(/^entity\//, ""), node.project_id ?? null, id.replace(/^entity\//, "")) as any[];
  const incomingRelationEvidence: RelatedEntityEvidence[] = incomingRows
    .filter((row) => containsEntityReference(parsedValue(row.value), id))
    .map((row) => {
      const sourceId = String(row.source_id || "");
      const sourceName = String(row.source_name || sourceId);
      const relation = String(row.property_name_snapshot || row.key || "关联");
      const sourceDetails = [
        String(row.source_description || "").trim(),
        ...parseArray(row.source_aliases).map(String),
        ...parseArray(row.source_tags).map(String),
      ].filter(Boolean).join("；");
      const evidence = `关联实体：${sourceName}（${sourceId}）—[${relation}]→ ${node.name || node.id}${sourceDetails ? `；来源实体信息：${sourceDetails}` : ""}`.slice(0, 900);
      const haystack = `${sourceName} ${relation} ${sourceDetails}`.toLocaleLowerCase();
      return { sourceId, sourceName, relation, evidence, matchedKeywords: analysisKeywords.filter((keyword) => keyword && haystack.includes(keyword)).slice(0, 12), sourceUpdatedAt: row.source_updated_at || "" };
    });
  const narrativeSources = [
    { label: "知识描述", text: String(node.description || "") },
    { label: "知识正文", text: String(node.wiki_md || "") },
    { label: "结构化数据", text: textValue(node.data) },
  ].filter((item) => item.text.trim());
  const profileEvidence = analysisDefinitions.map((definition) => ({
    angle: definition.angle,
    content: definition.content,
    keywords: definition.keywords.map((keyword) => {
      const lowered = keyword.toLocaleLowerCase();
      const evidence = attributeEvidence
        .filter((item) => `${item.label} ${item.value}`.toLocaleLowerCase().includes(lowered))
        .slice(0, 2)
        .map((item) => `${item.label}：${item.value}`.slice(0, 220));
      for (const relation of incomingRelationEvidence) {
        if (relation.matchedKeywords.includes(lowered) && evidence.length < 3) evidence.push(relation.evidence.slice(0, 360));
      }
      for (const source of narrativeSources) {
        const snippet = evidenceSnippet(source.text, keyword, source.label);
        if (snippet && evidence.length < 3) evidence.push(snippet.slice(0, 220));
      }
      return { keyword, matched: evidence.length > 0, evidence };
    }),
  }));
  const questions: Record<string, unknown> = {
    knowledge_quality: {
      type: "score",
      instructions: "综合评价这条知识的清晰度、信息完整性、可信度线索和实际参考价值。不要补充未提供的事实。",
      criteria: [
        "信息很少、含义不清或几乎没有参考价值",
        "有基础信息，但完整性或可信度线索较弱",
        "内容清楚且具备一般参考价值",
        "信息较完整、可信且有较强参考价值",
        "信息非常完整、清晰、可信并具有突出参考价值",
      ],
    },
  };
  analysisDefinitions.forEach((definition, index) => {
    questions[`profile_${index}`] = {
      type: "choice",
      instructions: `严格依据 state.analysis_evidence 中“${definition.angle}”对应的分析内容、关键词命中和证据作出综合判断。不得仅根据角度名称猜测。没有足够证据时必须选择“信息不足”。`,
      criteria: {
        "积极支持": "明确支持、推动、扩大或高度认同相关政策方向",
        "务实合作": "强调谈判、接触、互利或在限制条件下合作",
        "中性审慎": "态度平衡、谨慎、观望或未表现明显倾向",
        "限制竞争": "主张限制、施压、管制、脱钩或强化竞争",
        "信息不足": "现有知识没有足够证据作出该角度的判断",
      },
    };
  });

  const database = url.searchParams.get("db") || "default";
  const analysisSignature = createHash("sha256").update(JSON.stringify({
    node: [node.id, node.name, node.type, node.description, node.aliases, node.tags, node.data, node.wiki_md, node.updated_at],
    definitions: analysisDefinitions,
    attributes: attributeRows.map((row) => [row.key, row.datatype, row.property_name_snapshot, row.value]),
    incoming: incomingRelationEvidence.map((item) => [item.sourceId, item.relation, item.evidence, item.sourceUpdatedAt]),
  })).digest("hex");
  if (!force && node.jev_analysis_signature === analysisSignature && node.jev_analysis_json) {
    try {
      const persisted = JSON.parse(node.jev_analysis_json);
      if (persisted && Number.isFinite(Number(persisted.score)) && Array.isArray(persisted.profiles)) {
        return json({ ...persisted, cached: true, cacheSource: "entity", analyzedAt: node.jev_analysis_updated_at || null });
      }
    } catch {}
  }
  const cacheKey = `${database}:${node.id}:${analysisSignature}`;
  const cached = scoreCache.get(cacheKey);
  if (!force && cached && cached.expiresAt > Date.now()) return json({ ...cached.value, cached: true, cacheSource: "memory" });

  if (!currentUser) return json({ error: "请先登录并在个人资料中配置 JEV API Key", code: "JEV_LOGIN_REQUIRED" }, 401);
  if (!apiKey) return json({ error: "请在个人资料中配置 JEV API Key", code: "JEV_NOT_CONFIGURED" }, 503);

  const endpoint = String(process.env.JEV_API_URL || "https://api.typesafe.ai/v1/systemone").trim();
  const model = String(process.env.JEV_MODEL || "jev-latest").trim();
  const timeoutMs = Math.max(1000, Math.min(Number(process.env.JEV_TIMEOUT_MS) || 12000, 30000));
  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        state: {
          knowledge_id: node.id,
          title: node.name || node.id,
          type: node.type || "知识实体",
          description: node.description || "",
          aliases: parseArray(node.aliases).slice(0, 20),
          tags: parseArray(node.tags).slice(0, 30),
          structured_data: textValue(node.data).slice(0, 5000),
          article: textValue(node.wiki_md).slice(0, 8000),
          attribute_evidence: attributeEvidence,
          incoming_relation_evidence: incomingRelationEvidence.map(({ sourceId, sourceName, relation, evidence, matchedKeywords }) => ({ source_id: sourceId, source_name: sourceName, relation, evidence, matched_keywords: matchedKeywords })),
          analysis_evidence: profileEvidence,
        },
        questions,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    console.warn("JEV score request failed:", error instanceof Error ? error.message : error);
    return json({ error: "JEV 评分服务暂时不可用" }, 502);
  }

  let payload: any;
  try {
    payload = await upstream.json();
  } catch {
    return json({ error: "JEV 返回了无法解析的结果" }, 502);
  }
  if (!upstream.ok || (payload?.code != null && payload.code !== 0)) {
    console.warn("JEV score rejected:", upstream.status, payload?.message || "unknown error");
    if (upstream.status === 401) return json({ error: "JEV API Key 无效或已失效，请在个人资料中重新配置" }, 401);
    return json({ error: "JEV 评分失败" }, 502);
  }

  const answer = payload?.data?.answers?.knowledge_quality ?? payload?.answers?.knowledge_quality;
  const rawScore = parseJevScoreAnswer(answer);
  if (rawScore == null) return json({ error: "JEV 未返回有效评分" }, 502);
  // JEV score levels are zero-based. Convert the five configured levels to UI stars 1–5.
  const score = Math.max(1, Math.min(5, Math.round(rawScore) + 1));
  const confidenceValue = Number(answer?.confidence);
  const answers = payload?.data?.answers ?? payload?.answers ?? {};
  const profiles = analysisDefinitions.map((definition, index) => {
    const profileAnswer = answers[`profile_${index}`] || {};
    const profileConfidence = Number(profileAnswer.confidence);
    const keywordEvidence = profileEvidence[index]?.keywords || [];
    const evidence = [...new Set(keywordEvidence.flatMap((item) => item.evidence))].slice(0, 4);
    const loweredKeywords = new Set(definition.keywords.map((keyword) => keyword.toLocaleLowerCase()));
    const relatedEvidence = incomingRelationEvidence.filter((item) => item.matchedKeywords.some((keyword) => loweredKeywords.has(keyword))).slice(0, 4).map(({ sourceId, sourceName, relation, evidence, matchedKeywords }) => ({ sourceId, sourceName, relation, evidence, matchedKeywords }));
    return { ...definition, classification: String(profileAnswer.choice || "信息不足"), confidence: Number.isFinite(profileConfidence) ? Math.max(0, Math.min(1, profileConfidence)) : null, evidence, keywordEvidence, relatedEvidence };
  });
  const value = {
    score,
    rawScore,
    confidence: Number.isFinite(confidenceValue) ? Math.max(0, Math.min(1, confidenceValue)) : null,
    model,
    profiles,
  };
  db.run("UPDATE nodes SET jev_analysis_json = ?, jev_analysis_signature = ?, jev_analysis_updated_at = CURRENT_TIMESTAMP WHERE id = ?", [JSON.stringify(value), analysisSignature, node.id]);
  scoreCache.set(cacheKey, { expiresAt: Date.now() + SCORE_TTL_MS, value });
  const saved = db.query("SELECT jev_analysis_updated_at FROM nodes WHERE id = ?").get(node.id) as any;
  return json({ ...value, cached: false, cacheSource: "jev", analyzedAt: saved?.jev_analysis_updated_at || null });
}
