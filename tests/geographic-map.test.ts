import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { attributeEarthPoint, earthPoint } from '../src/shared/geography.ts';
import { edgeDocuments, entityDocument } from '../src/server/arangodb.ts';
import { geographicBounds, GeographicKnowledgeSearch } from '../src/server/geographic-search.ts';
import { createEnterpriseKnowledgeHandler } from '../src/server/routes/enterprise-knowledge.ts';
import { serveStaticRoute } from '../src/server/static.ts';

test('coordinate projections accept zero values and reject non-Earth or invalid coordinates', () => {
  expect(earthPoint({ latitude: 0, longitude: 0 })).toEqual({ type: 'Point', coordinates: [0, 0] });
  expect(earthPoint({ latitude: 91, longitude: 2 })).toBeNull();
  expect(earthPoint({ latitude: 0, longitude: 181 })).toBeNull();
  expect(earthPoint({ latitude: 0, longitude: 0, globe: 'http://www.wikidata.org/entity/Q405' })).toBeNull();
  const attr = { id: 'coord', node_id: 'one', key: 'P625', value: JSON.stringify({ latitude: 39.9, longitude: 116.4 }), datatype: 'globecoordinate',
    property_name_snapshot: '地理坐标', statement_json: null, created_at: null };
  expect(edgeDocuments({ id: 'one' }, [attr])[0]!.geo).toEqual({ type: 'Point', coordinates: [116.4, 39.9] });
});

test('maps require a coordinate datatype and structured numeric values', () => {
  expect(attributeEarthPoint('40.0883? N, 22.3586? E', 'string')).toBeNull();
  expect(attributeEarthPoint('40.0883? N, 22.3586? E', 'globe-coordinate')).toBeNull();
  expect(attributeEarthPoint({ latitude: 40, longitude: 22 }, 'string')).toBeNull();
  expect(attributeEarthPoint({ latitude: '40', longitude: '22' }, 'globe-coordinate')).toBeNull();
  expect(attributeEarthPoint({ latitude: 40.0883, longitude: 22.3586 }, 'globe-coordinate')).toEqual({ type: 'Point', coordinates: [22.3586, 40.0883] });
});

test('viewport validation handles global extents and antimeridian crossings without losing zero bounds', () => {
  expect(geographicBounds(new URLSearchParams('west=-180&east=180&south=-85&north=85'))).toMatchObject({ center: [0, 0], radius: 20_040_000, wraps: false });
  expect(geographicBounds(new URLSearchParams('west=170&east=-170&south=-10&north=10'))).toMatchObject({ center: [180, 0], wraps: true });
  expect(geographicBounds(new URLSearchParams('west=0&east=10&south=0&north=10')).west).toBe(0);
  for (const query of ['', 'west=0&east=0&south=0&north=10', 'west=-181&east=1&south=0&north=10', 'west=0&east=10&south=20&north=10']) {
    expect(() => geographicBounds(new URLSearchParams(query))).toThrow();
  }
});

function fixture() {
  const requests: any[] = [], rows: any[] = [{ node: { ...entityDocument({ id: 'one', name: '北京知识', visibility: 'public' }), _id: 'entity/one' }, coordinates: [116.4, 39.9], property: '地理坐标' },
    { node: { id: 'private', visibility: 'private', owner_user_id: 99 }, coordinates: [116, 39] }];
  const store = {
    ensure: async () => {},
    query: async (_db: string, query: string, bindVars: any) => { requests.push({ query, bindVars }); return query.includes('UPDATE ') ? [] : rows; },
    client: { database: async (_db: string, path: string, init: any) => { requests.push({ path, body: JSON.parse(init?.body || '{}') }); return { body: {} }; } },
  } as any;
  return { store, requests, rows };
}
test('geographic queries initialize a geo index and apply exact bounds, ACL and graph attribute filters', async () => {
  const f = fixture(), search = new GeographicKnowledgeSearch(f.store);
  const params = new URLSearchParams('west=110&east=120&south=30&north=45&property_id=P1&property_value=abc');
  const result = await search.search('app', params, null, ['class'], ['reference']);
  expect(result.items).toHaveLength(1);
  const index = f.requests.find(request => request.path === '/_api/index?collection=link');
  expect(index.body).toMatchObject({ type: 'geo', fields: ['geo'], geoJson: true });
  const request = f.requests.find(request => request.query?.includes('GEO_IN_RANGE'));
  expect(request.query).toContain('GEO_IN_RANGE(@center, location.geo, 0, @radius)');
  expect(request.query).toContain('doc.visibility'); expect(request.query).toContain('@wraps'); expect(request.query).toContain('edge.property_id == @property');
  expect(request.bindVars).toMatchObject({ property: 'P1', value: 'abc', classes: ['class'], excluded: ['reference'] });
  await search.search('app', params, null, null, []);
  expect(f.requests.filter(request => request.path === '/_api/index?collection=link')).toHaveLength(1);
});

test('map viewport endpoint preserves geographic coordinates and classification scope', async () => {
  const previous = process.env.KNOWLEDGE_STORAGE_BACKEND; process.env.KNOWLEDGE_STORAGE_BACKEND = 'arangodb';
  try {
    const f = fixture();
    const handler = createEnterpriseKnowledgeHandler({ store: f.store, getProject: () => ({ id: 7, name: 'app' }), getUser: () => null, canCreate: () => false,
      getSchema: () => ({ classes: [{ id: 'parent' }, { id: 'child', parent_id: 'parent' }], properties: [], ontologies: [] }) });
    const url = new URL('http://local/api/kb/geography/viewport?db=app&west=110&east=120&south=30&north=45&class_id=parent');
    const response = (await handler(new Request(url), url, 'GET'))!;
    expect(response.status).toBe(200);
    const data = await response.json(); expect(data.source).toBe('arangodb-geo'); expect(data.items[0]).toMatchObject({ node: { id: 'one', name: '北京知识' }, coordinates: [116.4, 39.9] });
    expect(f.requests.find(request => request.query?.includes('GEO_IN_RANGE')).bindVars.classes).toEqual(['parent', 'child']);
    const invalid = new URL('http://local/api/kb/geography/viewport?db=app');
    expect((await handler(new Request(invalid), invalid, 'GET'))!.status).toBe(400);
  } finally { if (previous === undefined) delete process.env.KNOWLEDGE_STORAGE_BACKEND; else process.env.KNOWLEDGE_STORAGE_BACKEND = previous; }
});

test('offline world assets and locally installed Leaflet are available without online tile requests', async () => {
  const manifest = JSON.parse(readFileSync('public/maps/world/manifest.json', 'utf8'));
  const places = JSON.parse(readFileSync('public/maps/world/places.json', 'utf8'));
  expect(manifest.tiles).toBe(1365); expect(places.filter((place: any) => place.kind === 'city')).toHaveLength(1251);
  for (const path of ['/maps/world/manifest.json', '/maps/world/places.json', '/maps/world/tiles/0/0/0.svg', '/node_modules/leaflet/dist/leaflet.js', '/node_modules/leaflet/dist/leaflet.css']) {
    const response = await serveStaticRoute(new Request('http://local' + path), path); expect(response?.status).toBe(200);
  }
  const path = '/maps/world/tiles/0/0/0.svg';
  expect((await serveStaticRoute(new Request('http://local' + path), path))!.headers.get('Content-Type')).toBe('image/svg+xml');
  const script = readFileSync('public/assets/scripts/geographic-map.js', 'utf8');
  expect(script).toContain("'/maps/world/tiles/{z}/{x}/{y}.svg'"); expect(script).not.toContain('tile.openstreetmap.org');
  expect(readFileSync('public/assets/scripts/table-panel.js', 'utf8')).not.toContain('/node_modules/deck.gl/dist.min.js');
});

test('offline city names are Chinese while English aliases remain searchable', () => {
  const places = JSON.parse(readFileSync('public/maps/world/places.json', 'utf8'));
  expect(places.find((place: any) => place.kind === 'city' && place.english === 'Beijing')).toMatchObject({ name: '北京', country: '中华人民共和国' });
  expect(places.find((place: any) => place.kind === 'city' && place.english === 'Shanghai').name).toBe('上海');
  expect(places.find((place: any) => place.kind === 'city' && place.english === 'London').name).toBe('伦敦');
  expect(places.filter((place: any) => place.kind === 'city' && /[\u3400-\u9fff]/.test(place.name))).toHaveLength(1251);
});

test('dark offline tiles retain their geometry and use a dedicated dark palette', async () => {
  const path = '/maps/world/tiles/0/0/0.svg';
  const light = await (await serveStaticRoute(new Request('http://local' + path), path))!.text();
  const dark = await (await serveStaticRoute(new Request('http://local' + path + '?theme=dark'), path))!.text();
  expect(light).toContain('#eef3f7'); expect(dark).toContain('#111827'); expect(dark).toContain('#1f2937'); expect(dark).toContain('#475569');
  expect(dark.match(/d="[^"]*"/g)).toEqual(light.match(/d="[^"]*"/g));
});

test('map focuses matching entities globally, preserves manual views and handles empty results', async () => {
  const controls = new Map<string, any>(), requests: URL[] = [], fits: any[] = [];
  let items: any[] = [{ coordinates: [22.3586, 40.0883], node: { id: 'olympus' } }], options: any;
  const control = () => ({ textContent: '', value: '', append() {}, replaceChildren() {}, listeners: {} as any,
    addEventListener(name: string, callback: any) { this.listeners[name] = callback; } });
  const document = { documentElement: { getAttribute: () => 'light' }, createElement: control,
    getElementById(id: string) { if (!controls.has(id)) controls.set(id, control()); return controls.get(id); } };
  const map: any = { setView: () => map, createPane: () => ({ style: {} }), on() {}, invalidateSize() {}, getZoom: () => 4,
    fitBounds: (points: any, settings: any) => fits.push({ points, settings }), fitWorld() {},
    getBounds: () => ({ contains: () => true, getWest: () => 100, getEast: () => 120, getSouth: () => 20, getNorth: () => 40 }),
    latLngToContainerPoint: () => ({ x: 50, y: 50 }) };
  const layer = () => { const value: any = { addTo: () => value, clearLayers() {}, on: () => value, setUrl() {}, bindPopup: () => value }; return value; };
  const window: any = { kbTableLayoutMode: 'geographic', addEventListener() {}, L: {
    map: (_id: string, settings: any) => { options = settings; return map; }, tileLayer: layer, layerGroup: layer, circleMarker: layer } };
  const fetch = async (input: any) => {
    const url = new URL(String(input), 'http://local');
    if (url.pathname.includes('places.json')) return { ok: true, json: async () => [] };
    requests.push(url); return { ok: true, json: async () => ({ items }) };
  };
  new Function('window', 'document', 'location', 'fetch', 'getComputedStyle', 'MutationObserver', readFileSync('public/assets/scripts/geographic-map.js', 'utf8'))(
    window, document, { origin: 'http://local', search: '?db=app' }, fetch, () => ({ getPropertyValue: () => '#94a3b8' }), class { observe() {} });
  await window.knowledgeGeography.setFilters({ class_id: 'places' });
  expect(options).toMatchObject({ minZoom: 1, maxZoom: 8 });
  expect(requests[0]!.searchParams.get('west')).toBe('-180');
  expect(requests[0]!.searchParams.get('class_id')).toBe('places');
  expect(fits).toEqual([{ points: [[40.0883, 22.3586]], settings: { padding: [48, 48], maxZoom: 6, animate: false } }]);
  await window.knowledgeGeography.setFilters({ class_id: 'places' });
  expect(requests[1]!.searchParams.get('west')).toBe('100'); expect(fits).toHaveLength(1);
  items = [{ coordinates: [23.7275, 37.9838], node: { id: 'athens' } }];
  await window.knowledgeGeography.setFilters({ q: 'athens' });
  expect(requests[2]!.searchParams.get('west')).toBe('-180'); expect(fits[1].points).toEqual([[37.9838, 23.7275]]);
  await controls.get('geographicFocus').listeners.click();
  expect(fits).toHaveLength(3);
  items = []; await window.knowledgeGeography.setFilters({ q: 'missing' });
  expect(fits).toHaveLength(3);
  window.knowledgeGeography.cancel();
});

test('map responds to system theme changes without resetting the view or refetching knowledge', async () => {
  let theme = 'light', themeObserver: Function = () => {}, views = 0;
  const tileUrls: string[] = [], fetches: string[] = [], tooltips: string[] = [];
  const controls = new Map();
  const control = () => ({ textContent: '', value: '', addEventListener() {}, replaceChildren() {} });
  const document = { documentElement: { getAttribute: () => theme }, createElement: () => control(),
    getElementById: (id: string) => { if (!controls.has(id)) controls.set(id, control()); return controls.get(id); } };
  const map = { setView() { views++; return map; }, createPane: () => ({ style: {} }), on() {}, invalidateSize() {}, getZoom: () => 4,
    getBounds: () => ({ contains: () => true, getWest: () => 0, getEast: () => 10, getSouth: () => 0, getNorth: () => 10 }),
    latLngToContainerPoint: () => ({ x: 50, y: 50 }) };
  const layer = () => { const value: any = { addTo: () => value, clearLayers() {}, on: () => value,
    setUrl: (url: string) => { tileUrls.push(url); return value; }, bindTooltip: (node: any) => { tooltips.push(node.textContent); return value; } }; return value; };
  const window: any = { kbTableLayoutMode: 'geographic', addEventListener() {}, L: { map: () => map, tileLayer: layer, layerGroup: layer, circleMarker: layer } };
  const fetch = async (url: any) => {
    fetches.push(String(url));
    return { ok: true, json: async () => String(url).includes('places.json') ? [{ name: '北京', english: 'Beijing', kind: 'city', zoom: 2, lat: 39.9, lon: 116.4 }] : { items: [] } };
  };
  class Observer { constructor(callback: Function) { themeObserver = callback; } observe() {} }
  new Function('window', 'document', 'location', 'fetch', 'getComputedStyle', 'MutationObserver', readFileSync('public/assets/scripts/geographic-map.js', 'utf8'))(
    window, document, { origin: 'http://local', search: '?db=app' }, fetch, () => ({ getPropertyValue: () => '#94a3b8' }), Observer);
  await window.knowledgeGeography.setFilters({});
  await Promise.resolve();
  const calls = fetches.length;
  theme = 'dark'; themeObserver();
  expect(tileUrls).toEqual(['/maps/world/tiles/{z}/{x}/{y}.svg?theme=light', '/maps/world/tiles/{z}/{x}/{y}.svg?theme=dark']);
  expect(views).toBe(1); expect(fetches).toHaveLength(calls); expect(tooltips).toContain('北京');
});
