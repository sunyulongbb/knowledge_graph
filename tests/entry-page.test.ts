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

test('main page selects the default application when no application is specified', async () => {
  for (const path of ['/', '/kb']) {
    const response = await serveStaticRoute(new Request(`http://localhost${path}`), path);
    expect(response?.status).toBe(302);
    expect(response?.headers.get('Location')).toBe(`http://localhost${path}?db=default`);
  }
  const selected = await serveStaticRoute(new Request('http://localhost/kb?db=demo'), '/kb');
  expect(selected?.status).toBe(200);
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

test('clear controls and scoped taxonomy clear endpoint are wired independently', async () => {
  const response = await serveStaticRoute(new Request('http://localhost/kb?db=demo'), '/kb');
  const html = await response!.text();
  expect(html).toContain('id="btnClearAllNodes"');
  expect(html).toContain('id="btnClearAllClasses"');
  expect(readFileSync('src/server/routes/schema.ts', 'utf8')).toContain('url.pathname === "/api/kb/classes/clear" && method === "DELETE"');
  const tableSelection = readFileSync('public/assets/scripts/table-selection.js', 'utf8');
  const schemaPanel = readFileSync('public/assets/scripts/schema-panel.js', 'utf8');
  expect(tableSelection).toContain('请再次确认：确定要永久删除当前应用的全部知识数据吗？');
  expect(schemaPanel).toContain('请再次确认：确定要永久删除当前应用的全部分类吗？');
});

test('anonymous users cannot expand application or user sidebars', () => {
  const page = readFileSync('public/index.html', 'utf8');
  const authPanel = readFileSync('public/assets/scripts/auth-panel.js', 'utf8');
  const sidebarPanel = readFileSync('public/assets/scripts/sidebar-panel.js', 'utf8');
  expect(page).toContain('/assets/scripts/sidebar-panel.js?v=20260921-2');
  expect(page).toContain('/assets/scripts/auth-panel.js?v=20260921-2');
  expect(page).toContain('/assets/scripts/knowledge-access.js?v=20260921-1');
  expect(authPanel).toContain('if (authUser) window.toggleUserSidebar?.();\n      else openAuthModal(false);');
  expect(sidebarPanel).toContain('if (!collapsed && !window.authUser) collapsed = true;');
  expect(sidebarPanel).toContain('if (!window.authUser) {\n        applyUserSidebarCollapsed(true);');
  expect(sidebarPanel).toContain("window.addEventListener('kb-auth-change'");
  expect(sidebarPanel).toContain('applyUserSidebarCollapsed(true, true);');
  expect(sidebarPanel).toContain('headerLogo.addEventListener("click"');
  expect(sidebarPanel).toContain('if (!window.authUser) return;');
});
