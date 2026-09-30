import { expect, test } from 'bun:test';
import { buildNetwork, buildTransitMap, shortestRoute } from '../public/assets/scripts/knowledge-roam-graph.js';

function make(edges: string[][]) {
  return buildNetwork({ nodes: [...new Set(edges.flat())].map(id => ({ id })),
    edges: edges.map(([source, target]) => ({ source, target })) });
}
function all(network: ReturnType<typeof make>) {
  return { nodes: new Set(network.nodes.keys()), edges: new Set(network.edges.map(edge => edge.id)) };
}

test('extracts the longest trunk before branches and aligns real transfer stations', () => {
  const network = make([['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['C', 'X'], ['X', 'Y']]);
  const map = buildTransitMap(network, all(network));
  expect(map.lines[0].nodes.length).toBe(5);
  expect(map.lines[1].nodes.length).toBe(2);
  expect(map.connectors.size).toBe(1);
  expect(map.positions.size).toBe(7);
  expect(new Set([...map.positions.values()].map(p => `${p.x},${p.y}`)).size).toBe(7);
  for (const line of map.lines) {
    expect(new Set(line.nodes.map(id => map.positions.get(id)?.y)).size).toBe(1);
    line.edges.forEach((id, index) => {
      const edge = network.edges.find(edge => edge.id === id)!;
      expect(new Set([edge.source, edge.target])).toEqual(new Set(line.nodes.slice(index, index + 2)));
    });
  }
  for (const edge of network.edges.filter(edge => map.connectors.has(edge.id))) {
    expect(map.positions.get(edge.source)?.x).toBe(map.positions.get(edge.target)?.x);
    expect(map.transfers.has(edge.source)).toBe(true);
    expect(map.transfers.has(edge.target)).toBe(true);
  }
});

test('reduces cycles and parallel links without changing shortest-route data', () => {
  const network = make([['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'], ['A', 'C'], ['B', 'A']]);
  const before = shortestRoute(network, 'A', 'C');
  const map = buildTransitMap(network, all(network));
  expect(map.positions.size).toBe(4);
  expect(map.edges.size).toBe(3);
  expect(shortestRoute(network, 'A', 'C')).toEqual(before);
  expect(buildTransitMap(network, all(network))).toEqual(map);
});

test('retains connected coverage without inventing links across components', () => {
  const network = make([['A', 'B'], ['A', 'C'], ['A', 'D'], ['A', 'E'], ['X', 'Y'], ['Y', 'Z']]);
  const map = buildTransitMap(network, all(network));
  const backbone = buildNetwork({ nodes: [...network.nodes.values()], edges: network.edges.filter(edge => map.edges.has(edge.id)) });
  expect(map.positions.size).toBe(network.nodes.size);
  expect(shortestRoute(backbone, 'B', 'E')).not.toBeNull();
  expect(shortestRoute(backbone, 'X', 'Z')).not.toBeNull();
  expect(shortestRoute(backbone, 'A', 'X')).toBeNull();
  expect(map.edges.size).toBe(network.nodes.size - 2);
});

test('supports empty maps and excludes stations outside the learning overview', () => {
  expect(buildTransitMap(buildNetwork({})).positions.size).toBe(0);
  const network = make([['A', 'B'], ['B', 'C'], ['C', 'D'], ['X', 'Y']]);
  expect([...buildTransitMap(network).positions.keys()].sort()).toEqual(['A', 'B', 'C', 'D']);
});
