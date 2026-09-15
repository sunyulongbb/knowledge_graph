import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { serveStaticRoute } from '../src/server/static.ts';

test('standalone SPARQL and legacy bookmarks preserve the selected knowledge base', async () => {
  for (const path of ['/sparql', '/sparql.html']) {
    const response = await serveStaticRoute(new Request(`http://localhost${path}?db=demo`), path);
    expect(response?.status).toBe(200);
    expect(response?.headers.get('Content-Type')).toContain('text/html');
    const html = await response!.text();
    expect(html).toContain('id="sparqlImportView"');
    expect(html).toContain('sparql-panel.js');
    expect(html).not.toContain('pipeline-ui.js');
  }
  for (const path of ['/', '/kb']) {
    const response = await serveStaticRoute(new Request(`http://localhost${path}?db=demo&tool=sparql`), path);
    expect(response?.status).toBe(302);
    expect(response?.headers.get('Location')).toBe('http://localhost/sparql?db=demo');
  }
});

test('main page scripts remain valid after removing legacy entry initialization', async () => {
  const response = await serveStaticRoute(new Request('http://localhost/kb?db=demo'), '/kb');
  const html = await response!.text();
  expect(html).toContain('id="entryPanel"');
  expect(html).toContain('pipeline-ui.js');
  expect(html).not.toMatch(/entryManagerView|initEntryPanel|entryGridHost|sparql-panel\.js|kbPipelineEnabled/);
  for (const page of [html, readFileSync('public/sparql.html', 'utf8')]) {
    for (const match of page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!/\btype\s*=\s*["']module["']/.test(match[1]!)) {
        expect(() => new Function(match[2]!)).not.toThrow();
      }
    }
  }
});
