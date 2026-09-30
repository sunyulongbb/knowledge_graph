export function buildNetwork(data) {
  const nodes = new Map((data.nodes || []).filter(Boolean).map(n => [String(n.id), n]));
  const edges = (data.edges || []).filter(e => e && String(e.source) !== String(e.target) && nodes.has(String(e.source)) && nodes.has(String(e.target))).map((e, index) => ({ ...e, id: `link-${index}`, source: String(e.source), target: String(e.target) }));
  // Only stations linked to another accessible station belong on the transit map.
  const connected = new Set(edges.flatMap(edge => [edge.source, edge.target]));
  for (const id of nodes.keys()) if (!connected.has(id)) nodes.delete(id);
  const adjacency = new Map([...nodes.keys()].map(id => [id, []]));
  for (const edge of edges) {
    adjacency.get(edge.source).push({ id: edge.target, edge: edge.id });
    adjacency.get(edge.target).push({ id: edge.source, edge: edge.id });
  }
  return { nodes, edges, adjacency };
}

export function reachableStations(network, start) {
  if (!network.nodes.has(start)) return new Set();
  const reachable = new Set([start]), queue = [start];
  for (let index = 0; index < queue.length; index++) {
    for (const next of network.adjacency.get(queue[index])) {
      if (reachable.has(next.id)) continue;
      reachable.add(next.id); queue.push(next.id);
    }
  }
  return reachable;
}

// Keep all shortest paths with at least four stations, including intermediate stops.
export function learningRoutes(network, start) {
  const destinations = new Set(), nodes = new Set(), edges = new Set();
  if (!network.nodes.has(start)) return { destinations, nodes, edges };
  const distance = new Map([[start, 0]]), parents = new Map(), queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i], nextDistance = distance.get(id) + 1;
    for (const next of network.adjacency.get(id)) {
      if (!distance.has(next.id)) { distance.set(next.id, nextDistance); queue.push(next.id); }
      if (distance.get(next.id) === nextDistance) {
        if (!parents.has(next.id)) parents.set(next.id, []);
        parents.get(next.id).push({ id, edge: next.edge });
      }
    }
  }
  for (const [id, hops] of distance) if (hops >= 3) destinations.add(id);
  const pending = [...destinations];
  for (let i = 0; i < pending.length; i++) {
    const id = pending[i];
    if (nodes.has(id)) continue;
    nodes.add(id);
    for (const parent of parents.get(id) || []) { edges.add(parent.edge); pending.push(parent.id); }
  }
  return { destinations, nodes, edges };
}

export function learningMap(network) {
  const nodes = new Set(), edges = new Set();
  for (const start of network.nodes.keys()) {
    const routes = learningRoutes(network, start);
    for (const id of routes.nodes) nodes.add(id);
    for (const id of routes.edges) edges.add(id);
    if (edges.size === network.edges.length) break;
  }
  return { nodes, edges };
}

// Components of the displayed route map, not individual transit lines.
export function transitIslands(network, visible = learningMap(network)) {
  const unseen = new Set([...visible.nodes].sort()), islands = [];
  while (unseen.size) {
    const start = unseen.values().next().value;
    const nodes = new Set([start]), edges = new Set(), queue = [start];
    unseen.delete(start);
    for (let i = 0; i < queue.length; i++) {
      for (const next of network.adjacency.get(queue[i]) || []) {
        if (!visible.edges.has(next.edge) || !visible.nodes.has(next.id)) continue;
        edges.add(next.edge);
        if (!unseen.has(next.id)) continue;
        unseen.delete(next.id); nodes.add(next.id); queue.push(next.id);
      }
    }
    islands.push({ nodes, edges });
  }
  return islands.sort((a, b) => b.nodes.size - a.nodes.size);
}

// Name each map after its most connected stations, counting unique neighbours.
export function transitIslandName(network, island) {
  const ranked = [...island.nodes].map(id => {
    const node = network.nodes.get(id) || {};
    const name = [node.name, node.label, node.label_zh, id]
      .map(value => String(value || '').trim()).find(Boolean);
    const degree = new Set((network.adjacency.get(id) || [])
      .filter(next => island.nodes.has(next.id) && island.edges.has(next.edge))
      .map(next => next.id)).size;
    return { id, name, degree };
  }).sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id));
  return [...new Set(ranked.map(node => node.name))].slice(0, 2).join(' · ') || '未命名线路图';
}

// Knowledge associations are traversable in both directions; every hop costs one.
export function shortestRoute(network, start, end) {
  if (!network.nodes.has(start) || !network.nodes.has(end)) return null;
  const previous = new Map([[start, null]]), queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (current === end) break;
    for (const next of network.adjacency.get(current)) {
      if (previous.has(next.id)) continue;
      previous.set(next.id, { id: current, edge: next.edge }); queue.push(next.id);
    }
  }
  if (!previous.has(end)) return null;
  const nodes = [], edges = [];
  for (let id = end; id !== null;) {
    nodes.push(id);
    const parent = previous.get(id);
    if (parent) edges.push(parent.edge);
    id = parent?.id ?? null;
  }
  return { nodes: nodes.reverse(), edges: edges.reverse() };
}

// Extract long simple paths first, then connect their contracted lines with a
// spanning forest. Bounded diameter sweeps avoid exponential longest-path search.
export function buildTransitMap(network, visible = learningMap(network)) {
  const remaining = new Set([...network.nodes.keys()].filter(id => visible.nodes.has(id)).sort());
  const adjacency = new Map([...remaining].map(id => [id, (network.adjacency.get(id) || [])
    .filter(next => remaining.has(next.id) && visible.edges.has(next.edge))
    .slice().sort((a, b) => a.id.localeCompare(b.id) || a.edge.localeCompare(b.edge))]));
  const sweep = (start) => {
    const parents = new Map([[start, null]]), queue = [start];
    for (let i = 0; i < queue.length; i++) {
      for (const next of adjacency.get(queue[i]) || []) {
        if (!remaining.has(next.id) || parents.has(next.id)) continue;
        parents.set(next.id, { id: queue[i], edge: next.edge }); queue.push(next.id);
      }
    }
    const nodes = [], edges = [];
    for (let id = queue.at(-1); id != null;) {
      nodes.push(id);
      const parent = parents.get(id);
      if (parent) edges.push(parent.edge);
      id = parent?.id;
    }
    nodes.reverse(); edges.reverse();
    const included = new Set(nodes);
    for (const front of [false, true]) {
      while (true) {
        const endpoint = front ? nodes[0] : nodes.at(-1);
        const next = adjacency.get(endpoint)?.find(item => remaining.has(item.id) && !included.has(item.id));
        if (!next) break;
        included.add(next.id);
        if (front) { nodes.unshift(next.id); edges.unshift(next.edge); }
        else { nodes.push(next.id); edges.push(next.edge); }
      }
    }
    return { nodes, edges, reached: queue };
  };
  const lines = [], stationLine = new Map(), edgeLine = new Map();
  while (remaining.size) {
    let longest = { nodes: [], edges: [] };
    const checked = new Set();
    for (const id of remaining) {
      if (checked.has(id)) continue;
      const first = sweep(id);
      first.reached.forEach(node => checked.add(node));
      let candidate = sweep(first.nodes.at(-1));
      // A few alternate starts improve cyclic graphs without exhaustive search.
      for (const seed of [id, candidate.nodes.at(-1), first.reached[Math.floor(first.reached.length / 2)]]) {
        const alternative = sweep(seed);
        if (alternative.nodes.length > candidate.nodes.length) candidate = alternative;
      }
      if (candidate.nodes.length > longest.nodes.length) longest = candidate;
    }
    const line = { id: lines.length, nodes: longest.nodes, edges: longest.edges };
    lines.push(line);
    for (const id of line.nodes) { remaining.delete(id); stationLine.set(id, line.id); }
    for (const id of line.edges) edgeLine.set(id, line.id);
  }

  const parents = lines.map(line => line.id);
  const root = id => { while (parents[id] !== id) { parents[id] = parents[parents[id]]; id = parents[id]; } return id; };
  const connectors = [], transfers = new Set();
  const candidates = network.edges.filter(edge => visible.edges.has(edge.id) &&
    stationLine.has(edge.source) && stationLine.has(edge.target) &&
    stationLine.get(edge.source) !== stationLine.get(edge.target));
  // Prefer links between the major lines before attaching shorter branches.
  candidates.sort((a, b) => {
    const score = edge => Math.max(stationLine.get(edge.source), stationLine.get(edge.target));
    return score(a) - score(b) || a.source.localeCompare(b.source) || a.target.localeCompare(b.target);
  });
  for (const edge of candidates) {
    const a = root(stationLine.get(edge.source)), b = root(stationLine.get(edge.target));
    if (a === b) continue;
    parents[b] = a; connectors.push(edge);
    transfers.add(edge.source); transfers.add(edge.target);
  }

  const positions = new Map(), placed = new Set();
  const lineLinks = new Map(lines.map(line => [line.id, []]));
  for (const edge of connectors) {
    const a = stationLine.get(edge.source), b = stationLine.get(edge.target);
    lineLinks.get(a).push({ line: b, from: edge.source, to: edge.target });
    lineLinks.get(b).push({ line: a, from: edge.target, to: edge.source });
  }
  let row = 0;
  for (const first of lines) {
    if (placed.has(first.id)) continue;
    const queue = [{ line: first.id, offset: 0 }]; placed.add(first.id);
    for (let i = 0; i < queue.length; i++) {
      const { line: lineId, offset } = queue[i], line = lines[lineId];
      line.nodes.forEach((id, index) => positions.set(id, { x: (offset + index) * 180, y: row * 150 }));
      row++;
      for (const link of lineLinks.get(lineId)) {
        if (placed.has(link.line)) continue;
        placed.add(link.line);
        queue.push({ line: link.line, offset: offset + line.nodes.indexOf(link.from) - lines[link.line].nodes.indexOf(link.to) });
      }
    }
    row++;
  }
  return { lines, positions, stationLine, edgeLine, transfers,
    edges: new Set([...edgeLine.keys(), ...connectors.map(edge => edge.id)]),
    connectors: new Set(connectors.map(edge => edge.id)) };
}
