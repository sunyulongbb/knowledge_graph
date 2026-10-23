import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { serveStaticRoute } from '../src/server/static.ts';

test('main page loads the local Cytoscape and self-registering Dagre assets', async () => {
  const page = readFileSync('public/index.html', 'utf8');
  expect(page).toContain('/js/cytoscape.min.js?v=20261023');
  expect(page).toContain('/js/cytoscape-dagre.min.js?v=20261023');
  const loadGraphStart = page.indexOf('async function loadGraph(prefetchedData)');
  const graphContainerLookup = page.indexOf('document.getElementById("cy")', loadGraphStart);
  expect(page.indexOf('document.readyState === "loading"', loadGraphStart)).toBeGreaterThan(loadGraphStart);
  expect(page.indexOf('document.addEventListener("DOMContentLoaded"', loadGraphStart)).toBeLessThan(graphContainerLookup);

  const response = await serveStaticRoute(
    new Request('http://localhost/js/cytoscape-dagre.min.js'),
    '/js/cytoscape-dagre.min.js',
  );
  expect(response?.status).toBe(200);
  const plugin = await response!.text();
  expect(plugin).toContain('cytoscapeDagre');
  expect(plugin).toContain('window.cytoscape');
});
