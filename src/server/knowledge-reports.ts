import type { Database } from 'bun:sqlite';

export type ReportSectionItem = {
  id: string;
  name: string;
  description: string;
  image: string;
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

function firstReportImage(node: any) {
  const candidates: unknown[] = [node?.images];
  try {
    const extra = JSON.parse(String(node?.data || '{}'));
    candidates.push(extra?.images, extra?.image, extra?.thumbnail);
  } catch {}
  const visit = (value: unknown): string => {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item);
        if (found) return found;
      }
      return '';
    }
    if (value && typeof value === 'object') {
      const item = value as Record<string, unknown>;
      return visit(item.url ?? item.src ?? item.href ?? item.value);
    }
    const text = String(value || '').trim();
    if (!text) return '';
    try {
      const parsed = JSON.parse(text);
      if (parsed !== text) return visit(parsed);
    } catch {}
    return /^(?:https?:\/\/|\/static\/uploads\/|\/uploads\/|data:image\/)/i.test(text) ? text : '';
  };
  return visit(candidates);
}

function reportItem(node: any, related = false, relation = ''): ReportSectionItem {
  return {
    id: String(node.id || ''),
    name: String(node.name || node.id || '未命名知识'),
    description: compactText(node.description || node.wiki_md || '暂无内容摘要。'),
    image: firstReportImage(node),
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
  const hiddenTypeIds = new Set<string>();
  try {
    const hiddenTypes = (projectId === null
      ? db.query(`SELECT id FROM ontologies WHERE project_id IS NULL AND (
          lower(trim(COALESCE(name, ''))) IN ('实体条目', 'wikibase item')
          OR lower(COALESCE(description, '')) LIKE '%wikibase-item 属性值自动创建%'
        )`).all()
      : db.query(`SELECT id FROM ontologies WHERE project_id = ? AND (
          lower(trim(COALESCE(name, ''))) IN ('实体条目', 'wikibase item')
          OR lower(COALESCE(description, '')) LIKE '%wikibase-item 属性值自动创建%'
        )`).all(projectId)) as any[];
    hiddenTypes.forEach((item) => hiddenTypeIds.add(String(item.id)));
  } catch {}
  const nodes = ((projectId === null
    ? db.query('SELECT * FROM nodes WHERE project_id IS NULL').all()
    : db.query('SELECT * FROM nodes WHERE project_id = ?').all(projectId)) as any[])
    .filter((node) => (!allowedIds || allowedIds.has(String(node.id))) && !hiddenTypeIds.has(String(node.type || '')));

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

  const relatedBySeed = new Map<string, Map<string, { node: any; score: number; relation: string }>>();
  for (const relation of relations) {
    const sourceId = String(relation.node_id || '');
    for (const targetId of relationTargets(relation.value)) {
      const sourceDirect = directIds.has(sourceId);
      const targetDirect = directIds.has(targetId);
      if (!sourceDirect && !targetDirect) continue;
      if (sourceDirect && targetDirect) continue;
      const candidateId = sourceDirect ? targetId : sourceId;
      if (directIds.has(candidateId) || !nodeById.has(candidateId)) continue;
      const seedId = sourceDirect ? sourceId : targetId;
      const seed = scored.find((item) => String(item.node.id) === seedId);
      const candidate = nodeById.get(candidateId);
      if (!relatedBySeed.has(seedId)) relatedBySeed.set(seedId, new Map());
      const seedRelations = relatedBySeed.get(seedId)!;
      const current = seedRelations.get(candidateId);
      const nextScore = (seed?.score || 1) * .35 + 2;
      if (!current || current.score < nextScore) {
        seedRelations.set(candidateId, {
          node: candidate,
          score: nextScore,
          relation: String(relation.property_name_snapshot || relation.key || '相关内容'),
        });
      }
    }
  }

  const chapterTargets = scored.slice(0, 10);
  const sections: ReportSection[] = chapterTargets.map((target) => {
    const targetId = String(target.node.id);
    const relatedItems = [...(relatedBySeed.get(targetId)?.values() || [])]
      .sort((left, right) => right.score - left.score || String(left.node.name).localeCompare(String(right.node.name), 'zh-CN'))
      .slice(0, 9);
    const items = [
      reportItem(target.node),
      ...relatedItems.map((item) => reportItem(item.node, true, item.relation)),
    ];
    const targetName = String(target.node.name || target.node.id || '相关知识');
    const targetSummary = compactText(target.node.description || target.node.wiki_md, 120);
    return {
      keyword: targetId,
      title: targetName,
      introduction: targetSummary || `本节整理“${targetName}”及其直接相关内容。`,
      items,
    };
  });

  if (!sections.length) {
    sections.push({
      keyword: '',
      title: '检索结果',
      introduction: '当前知识库中暂未找到与报告标题和关键词高度相关的内容。',
      items: [],
    });
  }

  const sourceCount = new Set(sections.flatMap((section) => section.items.map((item) => item.id))).size;
  const chapterKeywords = keywords.length ? keywords : [title];
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
