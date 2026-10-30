type Doc = Record<string, any>;
const idOf = (node: Doc) => String(node.sqlite_id || node.id || '').replace(/^entity\//, '');

/** Aggregate graph paths without losing parallel predicates or edge direction. */
export function buildRelationInsights(center: Doc, paths: Doc[], format: (node: Doc) => Doc, truncated = false) {
  const centerId = idOf(center), direct = new Map<string, Doc>(), indirect = new Map<string, Doc>();
  const incomingRelations: Doc[] = [], neighbors = new Map<string, Doc>(), edgeIds = new Set<string>();
  const step = (edge: Doc, from: Doc, to: Doc) => ({ id: String(edge.sqlite_id || edge._key),
    source: String(edge.source_id || idOf(edge._from === from._id ? from : to)).replace(/^entity\//, ''),
    target: String(edge.target_id || idOf(edge._to === to._id ? to : from)).replace(/^entity\//, ''),
    propertyId: edge.property_id, propertyName: edge.property_name || edge.property_id || '关联',
    direction: edge._from === from._id ? 'outgoing' : 'incoming' });
  for (const path of paths) {
    if (path.edges?.length !== 1 || path.vertices?.length !== 2) continue;
    const other = path.vertices[1], otherId = idOf(other), edge = path.edges[0];
    if (!otherId || otherId === centerId) continue;
    const identity = edge._key || `${edge.sqlite_id}:${edge._from}:${edge._to}`;
    if (edgeIds.has(identity)) continue;
    edgeIds.add(identity);
    const relation = step(edge, path.vertices[0], other);
    if (!direct.has(otherId)) direct.set(otherId, { node: format(other), relations: [] });
    direct.get(otherId)!.relations.push(relation);
    const legacyEdge = { id: `${edge.sqlite_id}:${edge.target_id}`, source: relation.source, target: relation.target,
      type: relation.propertyId, label: relation.propertyName, isAttribute: true };
    neighbors.set(otherId, { node: format(other), edge: legacyEdge });
    if (relation.direction === 'incoming') incomingRelations.push({ source: format(other), propertyId: relation.propertyId, propertyName: relation.propertyName });
  }
  const pathIds = new Set<string>();
  for (const path of paths) {
    if (path.edges?.length !== 2 || path.vertices?.length !== 3) continue;
    const target = path.vertices[2], targetId = idOf(target), viaId = idOf(path.vertices[1]);
    if (!targetId || targetId === centerId || direct.has(targetId)) continue;
    const identity = path.edges.map((edge: Doc) => edge._key || `${edge.sqlite_id}:${edge._from}:${edge._to}`).join('|');
    if (pathIds.has(identity)) continue;
    pathIds.add(identity);
    if (!indirect.has(targetId)) indirect.set(targetId, { node: format(target), via: new Set<string>(), pathCount: 0, paths: [] });
    const candidate = indirect.get(targetId)!;
    candidate.via.add(viaId); candidate.pathCount++;
    if (candidate.paths.length < 3) candidate.paths.push({ nodes: path.vertices.map(format),
      steps: path.edges.map((edge: Doc, index: number) => step(edge, path.vertices[index], path.vertices[index + 1])) });
    // Maintain the legacy incoming-chain contract for clients using it.
    if (path.edges[0]._to === center._id && path.edges[1]._to === path.vertices[1]._id) {
      for (const relation of incomingRelations.filter(item => item.source.id === viaId)) {
        relation.secondLevel ||= [];
        if (!relation.secondLevel.some((child: Doc) => child.source.id === targetId && child.propertyId === path.edges[1].property_id)) {
          relation.secondLevel.push({ source: format(target), propertyId: path.edges[1].property_id,
            propertyName: path.edges[1].property_name || path.edges[1].property_id || '关联' });
        }
      }
    }
  }
  const directItems = [...direct.values()].sort((a, b) => b.relations.length - a.relations.length || String(a.node.name).localeCompare(String(b.node.name), 'zh-CN'));
  const indirectItems = [...indirect.values()].map(({ via, ...item }): Doc => ({ ...item, sharedConnections: via.size }))
    .sort((a, b) => b.sharedConnections - a.sharedConnections || b.pathCount - a.pathCount || String(a.node.name).localeCompare(String(b.node.name), 'zh-CN'));
  const relations = directItems.flatMap(item => item.relations);
  // A shared high-frequency neighbor is weaker evidence than independent,
  // matching relation patterns. Parallel statements must not inflate relevance.
  const populations = new Map<string, Set<string>>();
  for (const [targetId, item] of indirect) for (const via of item.via) {
    if (!populations.has(via)) populations.set(via, new Set());
    populations.get(via)!.add(targetId);
  }
  const recommendations: Doc[] = [];
  for (const item of indirectItems) {
    if (item.node.type === 'ontology/wikibase-item' || ['实体条目', 'wikibase item'].includes(String(item.node.typeLabel || item.node.ontology?.name || '').trim().toLowerCase())) continue;
    const evidence = paths.filter(path => path.edges?.length === 2 && idOf(path.vertices[2]) === item.node.id);
    const independent = new Map<string, Doc>(), sameRole = new Map<string, Doc>();
    for (const path of evidence) {
      const via = path.vertices[1], first = step(path.edges[0], path.vertices[0], via), second = step(path.edges[1], via, path.vertices[2]);
      independent.set(idOf(via), { via, first, second });
      if (first.propertyId && first.propertyId === second.propertyId && first.direction !== second.direction) {
        sameRole.set(`${idOf(via)}:${first.propertyId}:${first.direction}`, { via, first });
      }
    }
    const reasons: string[] = [];
    let score = 0;
    for (const [viaId] of independent) score += 1 / Math.log2(2 + (populations.get(viaId)?.size || 1));
    for (const { via, first } of sameRole.values()) {
      score += 1.5 / Math.log2(2 + (populations.get(idOf(via))?.size || 1));
      const name = format(via).name || idOf(via);
      reasons.push(first.direction === 'outgoing'
        ? `与当前实体同样通过“${first.propertyName}”关联到“${name}”`
        : `“${name}”通过“${first.propertyName}”同时关联到这两个实体`);
    }
    const viaNames = [...independent.values()].map(({ via }) => format(via).name || idOf(via));
    if (independent.size > 1) reasons.unshift(`共同关联${viaNames.slice(0, 3).map(name => `“${name}”`).join('、')}${independent.size > 3 ? `等 ${independent.size} 个实体` : ''}`);
    else if (!reasons.length) reasons.push(`通过共同关联的“${viaNames[0]}”发现`);
    // Avoid recommending everyone connected to one popular generic node.
    if (independent.size === 1 && !sameRole.size && (populations.get([...independent.keys()][0]!)?.size || 0) > 10) continue;
    const rankedEvidence = [...evidence].sort((a, b) => {
      const matches = (path: Doc) => path.edges[0].property_id === path.edges[1].property_id
        && step(path.edges[0], path.vertices[0], path.vertices[1]).direction !== step(path.edges[1], path.vertices[1], path.vertices[2]).direction;
      return Number(matches(b)) - Number(matches(a));
    });
    const shownVia = new Set<string>(), samples: Doc[] = [];
    for (const path of rankedEvidence) {
      const via = idOf(path.vertices[1]);
      if (shownVia.has(via)) continue;
      shownVia.add(via);
      samples.push({ nodes: path.vertices.map(format), steps: path.edges.map((edge: Doc, index: number) => step(edge, path.vertices[index], path.vertices[index + 1])) });
      if (samples.length === 3) break;
    }
    recommendations.push({ ...item, paths: samples, score, reasons: [...new Set(reasons)].slice(0, 3),
      evidenceLabel: independent.size > 1 ? '多项关联线索' : sameRole.size ? '相似关系线索' : '共同关联线索' });
  }
  recommendations.sort((a, b) => b.score - a.score || b.sharedConnections - a.sharedConnections || String(a.node.name).localeCompare(String(b.node.name), 'zh-CN'));
  return { incomingRelations, neighbors: [...neighbors.values()], relationInsights: {
    direct: directItems, indirect: indirectItems, recommendations,
    summary: { entities: direct.size, relations: relations.length, incoming: relations.filter(item => item.direction === 'incoming').length,
      outgoing: relations.filter(item => item.direction === 'outgoing').length, relationTypes: new Set(relations.map(item => item.propertyId)).size,
      discoveries: indirect.size }, truncated, maxDepth: 2,
  } };
}
