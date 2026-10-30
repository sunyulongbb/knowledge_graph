(function () {
  const element = (tag, className, text) => { const node = document.createElement(tag); node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const MIN_ZOOM = 1, MAX_ZOOM = 8, FOCUS_ZOOM = 6;
  let map, markers, labels, controller, version = 0, timer, filters = {}, places = [], tiles, tileTheme, lastItems = [], needsFocus = true, filterKey = '';
  const palette = name => getComputedStyle(document.getElementById('geographicMap')).getPropertyValue(name).trim();
  const dark = () => document.documentElement.getAttribute('data-theme') === 'dark';
  function syncTheme() {
    if (!map) return;
    const theme = dark() ? 'dark' : 'light';
    if (theme !== tileTheme) { tileTheme = theme; tiles.setUrl(`/maps/world/tiles/{z}/{x}/{y}.svg?theme=${theme}`); }
    paintPlaces(); draw(lastItems);
  }
  const status = () => document.getElementById('geographicStatus');
  const active = () => window.kbTableLayoutMode === 'geographic';
  const scoped = path => { const url = new URL(path, location.origin); const db = new URLSearchParams(location.search).get('db'); if (db) url.searchParams.set('db', db); return url; };
  function paintPlaces() {
    if (!map || !labels) return;
    labels.clearLayers(); const bounds = map.getBounds(), zoom = map.getZoom(), occupied = new Set();
    for (const place of places) {
      if (place.zoom > zoom || (place.kind === 'country' && zoom > 6) || !bounds.contains([place.lat, place.lon])) continue;
      const pixel = map.latLngToContainerPoint([place.lat, place.lon]), cell = `${Math.floor(pixel.x / 80)}:${Math.floor(pixel.y / 24)}`;
      if (occupied.has(cell)) continue; occupied.add(cell);
      const text = element('span', '', place.name);
      window.L.circleMarker([place.lat, place.lon], { pane: 'placeLabels', interactive: false, radius: place.kind === 'city' ? 2 : 0,
        color: palette('--geo-place-point'), weight: 1, fillOpacity: 0.8 }).bindTooltip(text, { permanent: true, direction: place.kind === 'city' ? 'right' : 'center',
        className: place.kind === 'city' ? 'geo-city-label' : 'geo-country-label', opacity: 1 }).addTo(labels);
    }
  }
  function popup(items) {
    const host = element('div', 'geo-knowledge-popup');
    for (const item of items.slice(0, 12)) {
      const row = element('div', 'geo-knowledge-popup-row');
      const button = element('button', '', item.node.name || item.node.id); button.type = 'button';
      button.addEventListener('click', () => {
        window.setTableSelection?.(item.node.id, true);
        window.setViewMode?.('knowledge_detail', { targetNodeId: item.node.id, focusDetailOnly: true });
      });
      row.append(button, element('small', '', `${item.node.typeLabel || '知识'} · ${item.property || '地理坐标'}`)); host.append(row);
    }
    if (items.length > 12) host.append(element('small', '', `还有 ${items.length - 12} 个知识位置，请放大地图查看。`));
    return host;
  }
  function draw(items) {
    lastItems = items;
    markers.clearLayers(); const cells = new Map();
    for (const item of items) {
      if (!Array.isArray(item.coordinates) || item.coordinates.length !== 2) continue;
      const [lon, lat] = item.coordinates;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      const pixel = map.latLngToContainerPoint([lat, lon]), cell = `${Math.floor(pixel.x / 30)}:${Math.floor(pixel.y / 30)}`;
      if (!cells.has(cell)) cells.set(cell, []); cells.get(cell).push(item);
    }
    for (const group of cells.values()) {
      const lon = group.reduce((sum, item) => sum + item.coordinates[0], 0) / group.length;
      const lat = group.reduce((sum, item) => sum + item.coordinates[1], 0) / group.length;
      const marker = group.length === 1
        ? window.L.circleMarker([lat, lon], { pane: 'knowledgePoints', radius: 7, color: palette('--geo-marker-border'), weight: 2, fillColor: palette('--geo-point'), fillOpacity: 0.9 })
        : window.L.marker([lat, lon], { pane: 'knowledgePoints', icon: window.L.divIcon({ className: 'geo-knowledge-cluster', html: `<span>${group.length}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }) });
      marker.bindPopup(popup(group), { maxWidth: 290 }).addTo(markers);
    }
  }
  function focusEntities(items) {
    const points = items.filter(item => Array.isArray(item.coordinates) && item.coordinates.length === 2
      && item.coordinates.every(Number.isFinite) && Math.abs(item.coordinates[0]) <= 180 && Math.abs(item.coordinates[1]) <= 85.05112878)
      .map(item => [item.coordinates[1], item.coordinates[0]]);
    if (!points.length) return;
    map.fitBounds(points, { padding: [48, 48], maxZoom: FOCUS_ZOOM, animate: false });
  }
  async function refresh(focus = false) {
    if (!map || !active()) return;
    const current = ++version; controller?.abort(); controller = new AbortController();
    lastItems = []; markers.clearLayers(); paintPlaces(); status().textContent = '正在查询当前地图范围内的知识…';
    const bounds = map.getBounds(), url = scoped('/api/kb/geography/viewport');
    let west = bounds.getWest(), east = bounds.getEast();
    if (east - west >= 360) { west = -180; east = 180; }
    else { west = ((west + 180) % 360 + 360) % 360 - 180; east = ((east + 180) % 360 + 360) % 360 - 180; }
    for (const [key, value] of Object.entries({ west, east, south: Math.max(-85.05112878, bounds.getSouth()), north: Math.min(85.05112878, bounds.getNorth()) })) url.searchParams.set(key, value);
    // Locate all matching entities first, even when the previous view is elsewhere.
    if (focus) for (const [key, value] of Object.entries({ west: -180, east: 180, south: -85.05112878, north: 85.05112878 })) url.searchParams.set(key, value);
    for (const key of ['q', 'type', 'class_id', 'property_id', 'property_value', 'hide_entity']) if (Object.hasOwn(filters, key)) url.searchParams.set(key, filters[key]);
    try {
      const response = await fetch(url, { signal: controller.signal }); const data = await response.json();
      if (!response.ok) throw new Error(data.error || '地理位置检索失败');
      if (current !== version || !active()) return;
      if (focus) { needsFocus = false; focusEntities(data.items || []); paintPlaces(); }
      draw(data.items || []);
      const text = data.items?.length ? `当前范围显示 ${data.items.length} 个知识位置${data.truncated ? '，请放大地图查看更完整结果' : ''}` : '当前范围暂无带地理坐标的知识。可放大、定位其他地区，或为知识添加地理坐标属性。';
      status().textContent = text;
      const count = document.getElementById('tblCount'); if (count) count.textContent = text;
    } catch (error) { if (current === version && error.name !== 'AbortError') status().textContent = `加载失败：${error.message}`; }
  }
  function init() {
    if (map) { map.invalidateSize(); return; }
    map = window.L.map('geographicMap', { minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, preferCanvas: true, maxBounds: [[-85.05112878, -180], [85.05112878, 180]], maxBoundsViscosity: 1 }).setView([22, 0], 2);
    map.createPane('placeLabels').style.zIndex = 390; map.createPane('knowledgePoints').style.zIndex = 450;
    tiles = window.L.tileLayer('/maps/world/tiles/{z}/{x}/{y}.svg', { minZoom: 0, maxNativeZoom: 5, maxZoom: MAX_ZOOM, noWrap: true,
      bounds: [[-85.05112878, -180], [85.05112878, 180]], attribution: 'Natural Earth · 公共领域' }).addTo(map)
      .on('tileerror', () => { document.getElementById('geographicBasemapStatus').textContent = '离线底图瓦片加载失败，请检查本地地图资源。'; });
    labels = window.L.layerGroup().addTo(map); markers = window.L.layerGroup().addTo(map);
    syncTheme();
    new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('kb-app-theme-change', syncTheme);
    map.on('moveend', () => { clearTimeout(timer); timer = setTimeout(() => refresh(needsFocus), 250); });
    window.addEventListener('resize', () => { if (active()) map.invalidateSize(); });
    document.getElementById('geographicWorld').addEventListener('click', () => { needsFocus = false; map.fitWorld(); });
    document.getElementById('geographicFocus').addEventListener('click', () => refresh(true));
    document.getElementById('geographicRefresh').addEventListener('click', () => refresh(needsFocus));
    const input = document.getElementById('geographicPlaceInput'), suggestions = document.getElementById('geographicPlaceResults');
    input.addEventListener('input', () => {
      suggestions.replaceChildren(); const q = input.value.trim().toLowerCase(); if (!q) return;
      for (const place of places.filter(place => [place.name, place.english, place.country, place.countryEnglish].some(value => String(value || '').toLowerCase().includes(q))).slice(0, 8)) {
        const button = element('button', '', `${place.name}${place.country ? ` · ${place.country}` : ''}`); button.type = 'button';
        button.addEventListener('click', () => { map.setView([place.lat, place.lon], place.kind === 'city' ? 7 : 4); input.value = place.name; suggestions.replaceChildren(); }); suggestions.append(button);
      }
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); suggestions.firstElementChild?.click(); }
      if (event.key === 'Escape') suggestions.replaceChildren();
    });
    fetch('/maps/world/places.json?v=20261030-zh').then(response => { if (!response.ok) throw new Error('地图标注文件不可用'); return response.json(); })
      .then(data => { places = data; paintPlaces(); }).catch(() => { document.getElementById('geographicBasemapStatus').textContent = '国家与城市标注加载失败，请检查本地地图资源。'; });
  }
  window.knowledgeGeography = {
    async setFilters(value) {
      const key = JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
      if (key !== filterKey) needsFocus = true;
      filterKey = key; filters = { ...value }; init(); map.invalidateSize(); clearTimeout(timer); await refresh(needsFocus);
    },
    cancel() { version++; controller?.abort(); clearTimeout(timer); needsFocus = true; },
  };
})();
