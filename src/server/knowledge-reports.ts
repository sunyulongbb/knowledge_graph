import type { Database } from 'bun:sqlite';

export type ReportSectionItem = {
  id: string;
  name: string;
  description: string;
  link: string;
  tags: string[];
  related: boolean;
  relation: string;
};

export type ReportSection = {
  keyword: string;
  title: string;
  introduction: string;
  items: ReportSectionItem[];
};

function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  const text = String(value || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean);
  } catch {}
  return text.split(/[,，、;；\s]+/).map((item) => item.trim()).filter(Boolean);
}

export function normalizeReportKeywords(value: unknown): string[] {
  const input = Array.isArray(value) ? value : String(value || '').split(/[,，、;；\n]+/);
  return [...new Set(input.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 12);
}

function searchable(node: any) {
  return {
    name: String(node.name || '').toLocaleLowerCase(),
    aliases: parseList(node.aliases).join(' ').toLocaleLowerCase(),
    tags: parseList(node.tags).join(' ').toLocaleLowerCase(),
    description: String(node.description || '').toLocaleLowerCase(),
    wiki: String(node.wiki_md || '').toLocaleLowerCase(),
  };
}

function termScore(node: any, term: string) {
  const needle = term.toLocaleLowerCase();
  if (!needle) return 0;
  const fields = searchable(node);
  let score = 0;
  if (fields.name === needle) score += 20;
  else if (fields.name.includes(needle)) score += 12;
  if (fields.tags.includes(needle)) score += 9;
  if (fields.aliases.includes(needle)) score += 7;
  if (fields.description.includes(needle)) score += 5;
  if (fields.wiki.includes(needle)) score += 2;
  return score;
}

function compactText(value: unknown, maxLength = 360) {
  const text = String(value || '').replace(/[#>*_`\[\]]/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}…` : text;
}

function reportItem(node: any, related = false, relation = ''): ReportSectionItem {
  return {
    id: String(node.id || ''),
    name: String(node.name || node.id || '未命名知识'),
    description: compactText(node.description || node.wiki_md || '暂无内容摘要。'),
    link: String(node.link || ''),
    tags: parseList(node.tags).slice(0, 6),
    related,
    relation,
  };
}

function relationTargets(value: unknown) {
  try {
    const parsed = JSON.parse(String(value || ''));
    const values = Array.isArray(parsed) ? parsed : [parsed];
    return values.map((item) => String(item?.id || '').replace(/^entity\//, '')).filter(Boolean);
  } catch {
    return [];
  }
}

export function buildKnowledgeReport(db: Database, projectId: number | null, title: string, keywordInput: unknown, allowedIds?: Set<string>) {
  const keywords = normalizeReportKeywords(keywordInput);
  const terms = normalizeReportKeywords([title, ...keywords]);
  const nodes = ((projectId === null
    ? db.query('SELECT * FROM nodes WHERE project_id IS NULL').all()
    : db.query('SELECT * FROM nodes WHERE project_id = ?').all(projectId)) as any[])
    .filter((node) => !allowedIds || allowedIds.has(String(node.id)));

  const scored = nodes.map((node) => {
    const scores = terms.map((term) => ({ term, score: termScore(node, term) }));
    const score = scores.reduce((sum, item) => sum + item.score, 0);
    const best = scores.sort((a, b) => b.score - a.score)[0] || { term: '', score: 0 };
    return { node, score, bestTerm: best.term };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || String(a.node.name).localeCompare(String(b.node.name), 'zh-CN')).slice(0, 40);

  const directIds = new Set(scored.map((item) => String(item.node.id)));
  const nodeById = new Map(nodes.map((node) => [String(node.id), node]));
  const relations = (projectId === null
    ? db.query("SELECT a.* FROM attributes a JOIN nodes n ON n.id = a.node_id WHERE n.project_id IS NULL AND a.datatype = 'wikibase-entityid'").all()
    : db.query("SELECT a.* FROM attributes a JOIN nodes n ON n.id = a.node_id WHERE n.project_id = ? AND a.datatype = 'wikibase-entityid'").all(projectId)) as any[];

  const related = new Map<string, { node: any; score: number; keyword: string; relation: string }>();
  for (const relation of relations) {
    const sourceId = String(relation.node_id || '');
    for (const targetId of relationTargets(relation.value)) {
      const sourceDirect = directIds.has(sourceId);
      const targetDirect = directIds.has(targetId);
      if (!sourceDirect && !targetDirect) continue;
      const candidateId = sourceDirect ? targetId : sourceId;
      if (directIds.has(candidateId) || !nodeById.has(candidateId)) continue;
      const seedId = sourceDirect ? sourceId : targetId;
      const seed = scored.find((item) => String(item.node.id) === seedId);
      const candidate = nodeById.get(candidateId);
      const current = related.get(candidateId);
      const nextScore = (seed?.score || 1) * .35 + 2;
      if (!current || current.score < nextScore) {
        related.set(candidateId, {
          node: candidate,
          score: nextScore,
          keyword: seed?.bestTerm || keywords[0] || title,
          relation: String(relation.property_name_snapshot || relation.key || '相关内容'),
        });
      }
    }
  }

  const chapterKeywords = keywords.length ? keywords : [title];
  const sections: ReportSection[] = chapterKeywords.map((keyword) => {
    const directItems = scored.filter((item) => item.bestTerm === keyword || termScore(item.node, keyword) > 0);
    const relatedItems = [...related.values()].filter((item) => item.keyword === keyword).sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    const items = [
      ...directItems.map((item) => reportItem(item.node)),
      ...relatedItems.map((item) => reportItem(item.node, true, item.relation)),
    ].filter((item) => item.id && !seen.has(item.id) && seen.add(item.id)).slice(0, 14);
    return {
      keyword,
      title: keyword,
      introduction: items.length
        ? `本节汇集与“${keyword}”直接相关的知识，并补充其关联内容。`
        : `当前知识库中暂未找到与“${keyword}”高度相关的内容。`,
      items,
    };
  });

  const assigned = new Set(sections.flatMap((section) => section.items.map((item) => item.id)));
  const remainder = scored.filter((item) => !assigned.has(String(item.node.id))).slice(0, 12);
  if (remainder.length) {
    sections.push({
      keyword: '相关内容',
      title: '相关内容',
      introduction: '以下内容与报告主题具有补充关系，可用于扩展阅读和交叉核对。',
      items: remainder.map((item) => reportItem(item.node)),
    });
  }

  const sourceCount = new Set(sections.flatMap((section) => section.items.map((item) => item.id))).size;
  const keywordText = chapterKeywords.map((item) => `“${item}”`).join('、');
  const summary = sourceCount
    ? `本报告围绕${keywordText}整理现有知识，概括主要信息并补充与主题直接相关的内容，共引用 ${sourceCount} 条知识资料。`
    : `本报告围绕${keywordText}进行检索，当前知识库中尚无足够内容形成有效结论。`;
  const sources = sections.flatMap((section) => section.items).filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index)
    .map((item) => ({ id: item.id, name: item.name, link: item.link }));
  return { title, keywords: chapterKeywords, summary, sections, sources };
}

export function mapKnowledgeReport(row: any) {
  const parse = (value: unknown, fallback: any) => {
    try { return JSON.parse(String(value || '')); } catch { return fallback; }
  };
  return {
    id: String(row.id),
    title: String(row.title || ''),
    keywords: parse(row.keywords_json, []),
    summary: String(row.summary || ''),
    sections: parse(row.sections_json, []),
    sources: parse(row.sources_json, []),
    ownerUserId: row.owner_user_id == null ? null : Number(row.owner_user_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
