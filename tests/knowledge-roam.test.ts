import { test, expect } from 'bun:test';
import { buildNetwork, shortestRoute, reachableStations } from '../public/assets/scripts/knowledge-roam-graph.js';

const network = buildNetwork({
  nodes: ['A', 'B', 'C', 'D', 'E', 'isolated'].map(id => ({ id })),
  edges: [
    { source: 'A', target: 'B' }, { source: 'B', target: 'C' },
    { source: 'C', target: 'D' }, { source: 'A', target: 'E' },
    { source: 'E', target: 'D' }, { source: 'D', target: 'D' },
    { source: 'A', target: 'missing' },
  ],
});

test('destination choices include indirect and reverse connections but exclude other components', () => {
  const graph = buildNetwork({ nodes: ['A', 'B', 'C', 'D', 'E'].map(id => ({ id })), edges: [
    { source: 'A', target: 'B' }, { source: 'B', target: 'C' }, { source: 'D', target: 'E' },
  ] });
  expect([...reachableStations(graph, 'A')]).toEqual(['A', 'B', 'C']);
  expect([...reachableStations(graph, 'C')]).toEqual(['C', 'B', 'A']);
  expect([...reachableStations(graph, 'D')]).toEqual([]);
  expect(reachableStations(graph, '').size).toBe(0);
  expect(reachableStations(graph, 'missing').size).toBe(0);
});

test('roaming finds the fewest-hop route and the exact edges to highlight', () => {
  expect(shortestRoute(network, 'A', 'D')).toEqual({ nodes: ['A', 'E', 'D'], edges: ['link-3', 'link-4'] });
  expect(shortestRoute(network, 'D', 'A')?.nodes).toEqual(['D', 'E', 'A']);
});

test('roaming handles a single station, disconnected stations and stale endpoints', () => {
  expect(shortestRoute(network, 'A', 'A')).toEqual({ nodes: ['A'], edges: [] });
  expect(shortestRoute(network, 'A', 'isolated')).toBeNull();
  expect(shortestRoute(network, 'missing', 'D')).toBeNull();
  expect(shortestRoute(buildNetwork({}), '', '')).toBeNull();
  expect(network.edges).toHaveLength(5);
});

test('hides isolated, self-only and dangling stations while retaining separate connected components', () => {
  const graph = buildNetwork({
    nodes: ['A', 'B', 'C', 'D', 'E', 'F', 'pair1', 'pair2', 'isolated', 'self', 'dangling'].map(id => ({ id })),
    edges: [{ source: 'A', target: 'B' }, { source: 'B', target: 'C' },
      { source: 'D', target: 'E' }, { source: 'E', target: 'F' },
      { source: 'pair1', target: 'pair2' }, { source: 'pair2', target: 'pair1' },
      { source: 'self', target: 'self' }, { source: 'dangling', target: 'missing' }],
  });
  expect([...graph.nodes.keys()]).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  expect([...graph.adjacency.keys()]).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  expect(graph.edges).toHaveLength(4);
  expect(shortestRoute(graph, 'A', 'D')).toBeNull();
  expect(shortestRoute(graph, 'A', 'C')?.nodes).toEqual(['A', 'B', 'C']);
  expect(buildNetwork({ nodes: [{ id: 'alone' }], edges: [] }).nodes.size).toBe(0);
});

test('cycles and parallel edges do not duplicate stations', () => {
  const graph = buildNetwork({ nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }], edges: [{ source: 'A', target: 'B' }, { source: 'B', target: 'A' }, { source: 'B', target: 'C' }] });
  expect(shortestRoute(graph, 'A', 'B')?.nodes).toEqual(['A', 'B']);
});
