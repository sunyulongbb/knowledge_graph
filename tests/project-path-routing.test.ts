import { test, expect } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { serveStaticRoute } from '../src/server/static';

const origin = 'http://localhost:8080';
test('legacy project links redirect while preserving filters', async () => {
  const response = await serveStaticRoute(new Request(origin + '/?db=project_example&node=42'), '/');
  expect(response?.status).toBe(302);
  expect(response?.headers.get('location')).toBe(origin + '/project_example?node=42');
});
test('project path serves the application and root redirects to default', async () => {
  expect((await serveStaticRoute(new Request(origin + '/project_example'), '/project_example'))?.status).toBe(200);
  expect((await serveStaticRoute(new Request(origin), '/'))?.headers.get('location')).toBe(origin + '/default');
  expect(await serveStaticRoute(new Request(origin + '/api/not-found'), '/api/not-found')).toBeNull();
});
test('project scope and generated page links use path IDs', async () => {
  const source = await Bun.file('public/assets/scripts/application-scope.js').text();
  for (const [path, expected] of [['/project_example', 'project_example'], ['/default', 'default'], ['/?db=legacy', 'legacy'], ['/sparql', '']]) {
    const window: any = { location: new URL(origin + path) };
    runInNewContext(source, { window, URL });
    expect(window.getCurrentDbParam()).toBe(expected);
    expect(window.projectPageUrl('next', origin + '/?db=old&node=42#view=table').href).toBe(origin + '/next?node=42#view=table');
    if (expected) expect(window.appendCurrentDbParam('/api/kb/list').searchParams.get('db')).toBe(expected);
  }
});

test('menu pages resolve and preserve application scope', async () => {
  const source = await Bun.file('public/assets/scripts/application-scope.js').text();
  for (const [page, view] of [['home','app_home'], ['popular','app_home'], ['news','app_home'], ['explore','app_explore'], ['shorts','shorts'], ['learning','learning']]) {
    const path = '/project_example/' + page;
    expect((await serveStaticRoute(new Request(origin + path), path))?.status).toBe(200);
    const window: any = { location:new URL(origin + path) };
    runInNewContext(source, { window, URL, URLSearchParams });
    expect(window.getCurrentDbParam()).toBe('project_example');
    expect(window.getProjectPageRoute().view).toBe(view);
    expect(window.projectViewUrl('app_explore').pathname).toBe('/project_example/home/explore');
    expect(window.projectViewUrl('app_home', window.location.href, 'for-you').pathname).toBe('/project_example/home');
  }
});

test('page URL cleanup removes UI defaults and inactive filters', async () => {
  const window: any = { location:new URL(origin + '/project_example/home') };
  runInNewContext(await Bun.file('public/assets/scripts/application-scope.js').text(), { window, URL, URLSearchParams });
  const dirty = origin + '/project_example?limit=20&leftSidebar=closed&rightSidebar=closed&prop_limit=20&prop_page=1&order=modified_desc&page=1&explore_category=class%2Fexample#app_home';
  expect(window.cleanProjectPageUrl(dirty).href).toBe(origin + '/project_example/home');
  const table = window.cleanProjectPageUrl(origin + '/project_example/table?page=3&limit=50&order=title&node=42');
  expect(table.searchParams.get('page')).toBe('3');
  expect(table.searchParams.get('node')).toBe('42');
  expect(window.cleanProjectPageUrl(origin + '/project_example/explore?explore_category=class%2Fexample').searchParams.get('explore_category')).toBe('class/example');
});

test('content navigation stays within its space', async () => {
  const window: any = { location:new URL(origin + '/project_example/home') };
  runInNewContext(await Bun.file('public/assets/scripts/application-scope.js').text(), { window, URL, URLSearchParams });
  expect(window.resolveSpaceView('table','knowledge_detail')).toBe('detail');
  expect(window.resolveSpaceView('app_home','detail')).toBe('knowledge_detail');
  expect(window.resolveSpaceView('table','app_home')).toBe('');
  expect(window.resolveSpaceView('app_home','table')).toBe('');
  expect(window.resolveSpaceView('app_home','table',true)).toBe('table');
  expect(window.resolveSpaceView('table','app_home',true)).toBe('app_home');
});

test('application switching preserves the source space without stale state', async () => {
  const window: any = { location:new URL(origin + '/old/knowledge?class_id=old#node=42') };
  runInNewContext(await Bun.file('public/assets/scripts/application-scope.js').text(), { window, URL, URLSearchParams });
  expect(window.projectSwitchUrl('next','home').href).toBe(origin + '/next/home');
  expect(window.projectSwitchUrl('next','workspace').href).toBe(origin + '/next/workspace/table');
});

test('application settings resolve the selected app from workspace paths', async () => {
  const scope = await Bun.file('public/assets/scripts/application-scope.js').text();
  const settings = await Bun.file('public/assets/scripts/app-settings.js').text();
  const getter = settings.match(/function getCurrentDbSlug\(\) \{[\s\S]*?\n  \}/)?.[0];
  expect(getter).toBeDefined();
  for (const path of ['/project_example/table', '/project_example/attr', '/project_example/home']) {
    const window: any = { location: new URL(origin + path) };
    expect(runInNewContext(scope + '\n' + getter + '\ngetCurrentDbSlug()', { window, URL, URLSearchParams })).toBe('project_example');
  }
});

test('home and workspace use separate route prefixes', async () => {
  const source = await Bun.file('public/assets/scripts/application-scope.js').text();
  for (const [path, view] of [['/project_example/home/explore','app_explore'],['/project_example/workspace/table','table'],['/project_example/workspace/detail','detail']]) {
    const window: any = { location:new URL(origin + path) };
    runInNewContext(source, { window, URL, URLSearchParams });
    expect(window.getCurrentDbParam()).toBe('project_example');
    expect(window.getProjectPageRoute().view).toBe(view);
    expect((await serveStaticRoute(new Request(origin + path), path))?.status).toBe(200);
  }
});

test('joined type routes are distinct from explore routes', async () => {
  const window: any = { location:new URL(origin + '/project_example/home/type?type_id=class%2Fone') };
  runInNewContext(await Bun.file('public/assets/scripts/application-scope.js').text(), { window, URL, URLSearchParams });
  expect(window.getProjectPageRoute().view).toBe('joined_type');
  expect(window.cleanProjectPageUrl(window.location.href).searchParams.get('type_id')).toBe('class/one');
  const explore = window.projectViewUrl('app_explore');
  expect(explore.pathname).toBe('/project_example/home/explore');
  expect(explore.searchParams.has('type_id')).toBe(false);
});

test('static scripts revalidate with ETag on browser refresh',async()=>{
 const path='/assets/scripts/application-scope.js';
 const first=await serveStaticRoute(new Request(origin+path),path);
 expect(first?.status).toBe(200);const etag=first!.headers.get('etag');expect(etag).toBeTruthy();
 const repeated=await serveStaticRoute(new Request(origin+path,{headers:{'If-None-Match':etag!}}),path);
 expect(repeated?.status).toBe(304);expect(await repeated!.text()).toBe('');
});
