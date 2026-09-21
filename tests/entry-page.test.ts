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
  expect(page).toContain('/assets/scripts/auth-panel.js?v=20260921-3');
  expect(page).toContain('/assets/scripts/knowledge-access.js?v=20260921-3');
  expect(page).toContain('id="appHomeMaintenance"');
  expect(page).toContain('/assets/scripts/application-pages.js?v=20260922-6');
  expect(page).toContain('/assets/scripts/applications.js?v=20260921-1');
  expect(authPanel).toContain('if (authUser) window.toggleUserSidebar?.();\n      else openAuthModal(false);');
  expect(authPanel).toContain('defaultHome.searchParams.set("db", "default")');
  expect(authPanel).toContain('defaultHome.hash = "view=app_home"');
  expect(authPanel).toContain('window.location.assign(defaultHome.toString())');
  expect(sidebarPanel).toContain('if (!collapsed && !window.authUser) collapsed = true;');
  expect(sidebarPanel).toContain('if (!window.authUser) {\n        applyUserSidebarCollapsed(true);');
  expect(sidebarPanel).toContain("window.addEventListener('kb-auth-change'");
  expect(sidebarPanel).toContain('applyUserSidebarCollapsed(true, true);');
  expect(sidebarPanel).toContain('headerLogo.addEventListener("click"');
  expect(sidebarPanel).toContain('if (!window.authUser) return;');
  expect(page).toContain('class="btn sm user-sidebar-logout"');
  expect(page.indexOf('id="btnLogout"')).toBeGreaterThan(page.indexOf('id="userSidebar"'));
});

test('application home provides inspiration draw, category tree, and knowledge cards', () => {
  const page = readFileSync('public/index.html', 'utf8');
  const script = readFileSync('public/assets/scripts/application-pages.js', 'utf8');
  const css = readFileSync('public/assets/styles/app.css', 'utf8');
  expect(page).toContain('id="appHomeContent" class="app-home-dashboard"');
  expect(page).toContain('id="applicationHomePanel" class="application-content-page"');
  expect(script).toContain("api('/api/kb/classes')");
  expect(script).toContain('data-home-inspire');
  expect(script).toContain('data-home-category');
  expect(script).toContain("class_id: homeSelectedCategory");
  expect(script).toContain('app-home-knowledge-grid');
  expect(script).toContain('function firstVideo(node)');
  expect(script).toContain('preload="metadata"');
  expect(script).toContain('app-inspiration-progress-track');
  expect(script).toContain('再抽一张');
  expect(script).toContain('data-home-inspiration-modal');
  expect(script).toContain('modal?.showModal()');
  expect(script).toContain('app-inspiration-media-stage');
  expect(script).toContain('shell.innerHTML = inspirationDrawContent');
  expect(css).toContain('.app-inspiration-card');
  expect(css).toContain('.app-category-tree');
  expect(css).toContain('.app-home-knowledge-card');
  expect(css).toContain('.app-home-heading { display: none; }');
  expect(css).toContain('right: calc(var(--user-sidebar-width, 0px) + 18px);');
  expect(css).toContain('height: calc(100dvh - 104px);');
});

test('view menu switches reuse the mounted entity editor without repainting it', () => {
  const page = readFileSync('public/index.html', 'utf8');
  expect(page).toContain('isCurrentNode && hasCurrentPayload && options.refreshCurrent === false');
  expect(page).toContain('ensureEntityIdPrefix(editorPayloadId) === fullId');
  expect(page).toContain('Hash changes caused by switching views must not fetch and repaint');
  expect(page).toContain('function ensureEntityRelationList(nodeId)');
  expect(page).toContain('void ensureEntityRelationList(fullId)');
  expect(page).toContain('await ensureEntityRelationList(fullId)');
  expect(page).toContain('/assets/scripts/attr-panel.js?v=20260922-1');
  const attrPanel = readFileSync('public/assets/scripts/attr-panel.js', 'utf8');
  expect(attrPanel).toContain("attrList.dataset.loadState = 'loading'");
  expect(attrPanel).toContain("attrList.dataset.loadState = rendered ? 'ready' : 'error'");
});

test('entity editor uses the post-composer hierarchy without changing existing control ids', () => {
  const page = readFileSync('public/index.html', 'utf8');
  const css = readFileSync('public/assets/styles/app.css', 'utf8');
  expect(page).toContain('class="entity-composer-titlebar"');
  expect(page).toContain('id="btnCancelEdit"');
  expect(page).toContain('id="btnEntityImport"');
  expect(page).toContain('id="btnSubmit"');
  expect(page).toContain('/assets/styles/app.css?v=20260922-12');
  expect(css).toContain('/* Entity composer: compact post-editor layout */');
  expect(css).toContain('.editor-panel #entityDisplayImageWrap');
  expect(css).toContain('.entity-composer-titlebar');
  expect(css).toContain('.entity-composer-footer');
  expect(page).toContain('id="entityDisplayImageWrap" class="wd-entity-avatar-wrap empty social-avatar-wrap" hidden');
  expect(page).toContain('id="composerUserAvatar" class="composer-user-avatar" hidden');
  expect(page).toContain('/assets/scripts/entity-import.js?v=20260921-6');
  expect(page).toContain('/assets/scripts/detail-panel.js?v=20260921-8');
  expect(readFileSync('public/assets/scripts/entity-import.js', 'utf8')).toContain("window.addEventListener('kb-auth-change'");
  expect(readFileSync('public/assets/scripts/entity-import.js', 'utf8')).toContain("document.getElementById('composerUserAvatar')");
  expect(readFileSync('public/assets/scripts/detail-panel.js', 'utf8')).toContain('extractImageUrls(val, isMediaAttrItem(it))');
  const detailPanel = readFileSync('public/assets/scripts/detail-panel.js', 'utf8');
  expect(detailPanel).toContain('const hasImageMedia = renderWikiMediaGrid(detailMediaAttrItems, imageEntries)');
  expect(detailPanel).toContain('stage.dataset.activeMedia = key');
  expect(page).toContain('id="detailMediaTabs" class="detail-media-tabs"');
  expect(detailPanel).toContain('zoomResetButton.textContent = "适合"');
  expect(detailPanel).toContain('openLink.setAttribute("aria-label", "在新窗口打开 PDF")');
  expect(detailPanel).toContain('wasmUrl: "/node_modules/pdfjs-dist/wasm/"');
  expect(detailPanel).toContain('detailPdfViewerState.resizeObserver = new ResizeObserver');
  expect(detailPanel).toContain('availableHeight / baseViewport.height');
  expect(page.indexOf('id="wikiTopMedia"')).toBeLessThan(page.indexOf('id="wikiTopVideo"'));
  expect(page.indexOf('id="wikiTopVideo"')).toBeLessThan(page.indexOf('id="wikiTopPdf"'));
  expect(css).toContain('.editor-panel .social-compose-toolbar .wd-btn-icon');
  expect(css).toContain('flex: 0 0 32px;');
  expect(page).toContain('fa-solid fa-paper-plane');
  expect(page).toContain("btnSubmit.innerHTML = '<i class=\"fa-regular fa-floppy-disk\"");
  expect(css).toContain('.editor-panel .social-compose-form-shell { padding: 0; margin: 0; }');
});
