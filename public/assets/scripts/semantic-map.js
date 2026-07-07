(function () {
  const deckLib = window.deck;
  if (
    !deckLib ||
    !deckLib.Deck ||
    !deckLib.ScatterplotLayer ||
    !deckLib.OrthographicView
  ) {
    console.error("deck.gl failed to load");
    return;
  }

  const rootEl = document.getElementById("deck-root");
  const tooltipEl = document.getElementById("semanticTooltip");
  const searchInputEl = document.getElementById("semanticSearchInput");
  const searchButtonEl = document.getElementById("semanticSearchButton");
  const searchResultsEl = document.getElementById("semanticSearchResults");
  const detailBodyEl = document.getElementById("semanticDetailBody");
  const detailHotEl = document.getElementById("semanticDetailHot");
  const legendEl = document.getElementById("semanticLegend");
  const statsEl = document.getElementById("semanticStats");

  if (
    !rootEl ||
    !tooltipEl ||
    !searchInputEl ||
    !searchButtonEl ||
    !searchResultsEl ||
    !detailBodyEl ||
    !detailHotEl ||
    !legendEl ||
    !statsEl
  ) {
    console.error("semantic map page is missing required DOM nodes");
    return;
  }

  const nodeMap = new Map();
  const typeColorCache = new Map();
  const searchState = {
    keyword: "",
    matches: [],
    activeIndex: 0,
  };
  const viewState = {
    target: [0, 0, 0],
    zoom: 0,
    minZoom: -6,
    maxZoom: 8,
  };

  let selectedNodeId = "";
  let deckInstance = null;
  let viewportFetchTimer = 0;
  let lastViewportKey = "";
  let initLoaded = false;

  const TYPE_COLORS = [
    [76, 201, 240],
    [251, 191, 36],
    [248, 113, 113],
    [52, 211, 153],
    [167, 139, 250],
    [244, 114, 182],
    [129, 140, 248],
    [251, 146, 60],
  ];

  function api(path) {
    let requestPath = String(path || "");
    try {
      const requestUrl = new URL(requestPath, window.location.origin);
      const currentUrl = new URL(window.location.href);
      const db = (currentUrl.searchParams.get("db") || "").trim();
      if (db) {
        requestUrl.searchParams.set("db", db);
      }
      requestPath = requestUrl.pathname + requestUrl.search + requestUrl.hash;
    } catch {
      // ignore
    }
    return fetch(requestPath, {
      headers: { Accept: "application/json" },
    }).then(async (resp) => {
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || ("HTTP " + resp.status));
      }
      return resp.json();
    });
  }

  function normalizeItems(items) {
    return Array.isArray(items) ? items : [];
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function hashText(text) {
    let hash = 0;
    const value = String(text || "");
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function parseColor(hex, fallback) {
    const raw = String(hex || "").trim();
    if (/^#([0-9a-f]{6})$/i.test(raw)) {
      return [
        Number.parseInt(raw.slice(1, 3), 16),
        Number.parseInt(raw.slice(3, 5), 16),
        Number.parseInt(raw.slice(5, 7), 16),
      ];
    }
    return fallback;
  }

  function colorForType(item) {
    if (item && item.color) {
      return parseColor(item.color, [99, 102, 241]);
    }
    const key = String((item && item.type) || "Unknown");
    if (typeColorCache.has(key)) return typeColorCache.get(key);
    const color = TYPE_COLORS[hashText(key) % TYPE_COLORS.length];
    typeColorCache.set(key, color);
    return color;
  }

  function mergeNodes(items) {
    normalizeItems(items).forEach((item) => {
      if (!item || !item.id) return;
      const existing = nodeMap.get(item.id) || {};
      nodeMap.set(item.id, Object.assign({}, existing, item));
    });
  }

  function getLoadedNodes() {
    return Array.from(nodeMap.values());
  }

  function getMatchSet() {
    return new Set(
      searchState.matches.map((item) => item.id).filter(Boolean),
    );
  }

  function getNodeRadius(item) {
    const base = Math.max(2, Number((item && item.size) || 4));
    const hotBonus = clamp(Number((item && item.hot) || 0) * 0.02, 0, 14);
    let radius = base + hotBonus;
    if (item && item.id === selectedNodeId) radius += 5;
    if (searchState.keyword && getMatchSet().has(item && item.id)) radius += 4;
    return radius;
  }

  function computeViewportBounds() {
    const scale = Math.pow(2, viewState.zoom || 0);
    const width = rootEl.clientWidth || window.innerWidth || 1200;
    const height = rootEl.clientHeight || window.innerHeight || 800;
    const centerX = Number((viewState.target && viewState.target[0]) || 0);
    const centerY = Number((viewState.target && viewState.target[1]) || 0);
    const halfWidth = width / (2 * scale);
    const halfHeight = height / (2 * scale);
    return {
      minX: centerX - halfWidth,
      maxX: centerX + halfWidth,
      minY: centerY - halfHeight,
      maxY: centerY + halfHeight,
    };
  }

  function viewportKey(bounds) {
    return [
      bounds.minX.toFixed(1),
      bounds.maxX.toFixed(1),
      bounds.minY.toFixed(1),
      bounds.maxY.toFixed(1),
    ].join(":");
  }

  function scheduleViewportFetch() {
    if (viewportFetchTimer) window.clearTimeout(viewportFetchTimer);
    viewportFetchTimer = window.setTimeout(() => {
      viewportFetchTimer = 0;
      void loadViewport();
    }, 220);
  }

  async function loadViewport() {
    if (!initLoaded) return;
    const bounds = computeViewportBounds();
    const nextKey = viewportKey(bounds);
    if (nextKey === lastViewportKey) return;
    lastViewportKey = nextKey;
    const params = new URLSearchParams({
      minX: String(bounds.minX),
      maxX: String(bounds.maxX),
      minY: String(bounds.minY),
      maxY: String(bounds.maxY),
      limit: "10000",
    });
    try {
      const data = await api("/api/semantic-map/viewport?" + params.toString());
      mergeNodes(data.items);
      renderLegend();
      renderStats();
      updateSearchMatches(false);
      renderLayer();
    } catch (err) {
      console.error("load viewport failed", err);
    }
  }

  function renderTooltip(info) {
    if (!info || !info.object || !Number.isFinite(info.x) || !Number.isFinite(info.y)) {
      tooltipEl.style.display = "none";
      return;
    }
    const node = info.object;
    tooltipEl.innerHTML = [
      '<div class="tooltip-title">' +
        escapeHtml(node.label || node.id || "Unnamed Node") +
        "</div>",
      '<div class="tooltip-meta">' +
        escapeHtml(node.type || "Unknown Type") +
        " • Hot " +
        escapeHtml(String(Number(node.hot || 0))) +
        "</div>",
    ].join("");
    tooltipEl.style.display = "block";
    tooltipEl.style.left = String(info.x) + "px";
    tooltipEl.style.top = String(info.y) + "px";
  }

  function renderEmptyDetail() {
    detailHotEl.style.display = "none";
    detailBodyEl.innerHTML =
      '<div class="detail-empty">Pan, zoom, or search the map, then click a node to view its detail.</div>';
  }

  function formatTags(tags) {
    if (Array.isArray(tags)) return tags.join(", ");
    try {
      const parsed = JSON.parse(String(tags || ""));
      if (Array.isArray(parsed)) return parsed.join(", ");
    } catch {}
    return String(tags || "").trim();
  }

  async function showNodeDetail(nodeId) {
    if (!nodeId) return;
    selectedNodeId = nodeId;
    renderLayer();
    try {
      const data = await api(
        "/api/semantic-map/detail/" + encodeURIComponent(nodeId),
      );
      const item = data.item || {};
      detailHotEl.style.display = "";
      detailHotEl.textContent = "Hot " + String(Number(item.hot || 0));
      detailBodyEl.innerHTML = [
        '<div class="detail-section">',
        "<h3>Summary</h3>",
        "<div>" + escapeHtml(item.description || "No description.") + "</div>",
        "</div>",
        '<div class="detail-section">',
        "<h3>Metadata</h3>",
        '<dl class="detail-grid">',
        "<dt>ID</dt><dd>" + escapeHtml(item.id || "") + "</dd>",
        "<dt>Label</dt><dd>" + escapeHtml(item.label || "") + "</dd>",
        "<dt>Type</dt><dd>" + escapeHtml(item.type || "Unknown Type") + "</dd>",
        "<dt>Tags</dt><dd>" + escapeHtml(formatTags(item.tags) || "-") + "</dd>",
        "<dt>Position</dt><dd>" +
          escapeHtml(
            Number(item.x || 0).toFixed(3) +
              ", " +
              Number(item.y || 0).toFixed(3),
          ) +
          "</dd>",
        "<dt>Size</dt><dd>" + escapeHtml(String(Number(item.size || 4))) + "</dd>",
        "<dt>Color</dt><dd>" +
          escapeHtml(item.color || "Auto-mapped by type") +
          "</dd>",
        "<dt>Created</dt><dd>" + escapeHtml(item.created_at || "-") + "</dd>",
        "<dt>Updated</dt><dd>" + escapeHtml(item.updated_at || "-") + "</dd>",
        "</dl>",
        "</div>",
      ].join("");
    } catch (err) {
      console.error("load detail failed", err);
      detailBodyEl.innerHTML =
        '<div class="detail-empty">Failed to load node detail: ' +
        escapeHtml((err && err.message) || String(err)) +
        "</div>";
    }
  }

  function renderLegend() {
    const counts = new Map();
    getLoadedNodes().forEach((item) => {
      const key = String(item.type || "Unknown Type");
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const entries = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    legendEl.innerHTML = entries
      .map(([type, count]) => {
        const color = colorForType({ type: type });
        return (
          '<div class="legend-item">' +
          '<span class="legend-dot" style="background: rgb(' +
          color.join(",") +
          ');"></span>' +
          "<span>" +
          escapeHtml(type) +
          " (" +
          escapeHtml(String(count)) +
          ")</span>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderStats() {
    const total = nodeMap.size;
    const keyword = searchState.keyword.trim();
    statsEl.textContent = keyword
      ? "Loaded " +
        total.toLocaleString() +
        " nodes • " +
        searchState.matches.length.toLocaleString() +
        " matches"
      : "Loaded " +
        total.toLocaleString() +
        " nodes • pan or zoom to load more in the current viewport";
  }

  function renderSearchResults() {
    const matches = searchState.matches.slice(0, 20);
    if (!matches.length || !searchState.keyword) {
      searchResultsEl.style.display = "none";
      searchResultsEl.innerHTML = "";
      return;
    }
    searchResultsEl.style.display = "flex";
    searchResultsEl.innerHTML = matches
      .map((item, index) => {
        return (
          '<div class="search-result ' +
          (index === searchState.activeIndex ? "active" : "") +
          '" data-node-id="' +
          escapeHtml(item.id) +
          '">' +
          '<div class="search-result-label">' +
          escapeHtml(item.label || item.id) +
          "</div>" +
          '<div class="search-result-meta">' +
          escapeHtml(item.type || "Unknown Type") +
          " • Hot " +
          escapeHtml(String(Number(item.hot || 0))) +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    Array.from(searchResultsEl.querySelectorAll(".search-result")).forEach(
      (el) => {
        el.addEventListener("click", () => {
          const nodeId = el.getAttribute("data-node-id") || "";
          focusNodeById(nodeId);
        });
      },
    );
  }

  function updateSearchMatches(shouldRender) {
    const keyword = searchState.keyword.trim().toLowerCase();
    const items = getLoadedNodes();
    if (!keyword) {
      searchState.matches = [];
      searchState.activeIndex = 0;
    } else {
      searchState.matches = items
        .filter((item) => {
          const text = [item.label, item.type, item.tags, item.description]
            .map((part) => String(part || "").toLowerCase())
            .join("\n");
          return text.indexOf(keyword) >= 0;
        })
        .sort((a, b) => Number(b.hot || 0) - Number(a.hot || 0))
        .slice(0, 100);
      searchState.activeIndex = 0;
    }
    renderStats();
    renderSearchResults();
    if (shouldRender !== false) renderLayer();
  }

  function focusNodeById(nodeId) {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    viewState.target = [Number(node.x || 0), Number(node.y || 0), 0];
    viewState.zoom = Math.max(viewState.zoom, 1.4);
    if (deckInstance) {
      deckInstance.setProps({ viewState: Object.assign({}, viewState) });
    }
    void showNodeDetail(nodeId);
    scheduleViewportFetch();
  }

  function renderLayer() {
    if (!deckInstance) return;
    const data = getLoadedNodes();
    const matchSet = getMatchSet();
    const layer = new deckLib.ScatterplotLayer({
      id: "semantic-nodes-layer",
      data: data,
      pickable: true,
      autoHighlight: true,
      radiusUnits: "pixels",
      stroked: false,
      filled: true,
      opacity: 0.9,
      getPosition: function (d) {
        return [Number(d.x || 0), Number(d.y || 0)];
      },
      getRadius: function (d) {
        return getNodeRadius(d);
      },
      getFillColor: function (d) {
        const base = colorForType(d);
        if (d && d.id === selectedNodeId) return [255, 255, 255, 255];
        if (searchState.keyword) {
          if (!matchSet.has(d && d.id)) return [base[0], base[1], base[2], 70];
          return [255, clamp(base[1] + 30, 0, 255), clamp(base[2] + 30, 0, 255), 255];
        }
        return [base[0], base[1], base[2], clamp(110 + Number((d && d.hot) || 0), 120, 245)];
      },
      getLineColor: [255, 255, 255, 180],
      lineWidthUnits: "pixels",
      lineWidthMinPixels: 1,
      updateTriggers: {
        getRadius: [searchState.keyword, selectedNodeId],
        getFillColor: [searchState.keyword, selectedNodeId],
      },
      onClick: function (info) {
        if (!info || !info.object) return;
        void showNodeDetail(info.object.id);
      },
      onHover: function (info) {
        renderTooltip(info);
      },
    });
    deckInstance.setProps({ layers: [layer] });
  }

  function fitToInitialData(items) {
    const nodes = normalizeItems(items);
    if (!nodes.length) return;
    const xs = nodes.map((item) => Number(item.x || 0));
    const ys = nodes.map((item) => Number(item.y || 0));
    const minX = Math.min.apply(Math, xs);
    const maxX = Math.max.apply(Math, xs);
    const minY = Math.min.apply(Math, ys);
    const maxY = Math.max.apply(Math, ys);
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const viewportWidth = rootEl.clientWidth || window.innerWidth || 1200;
    const viewportHeight = rootEl.clientHeight || window.innerHeight || 800;
    const scaleX = viewportWidth / width;
    const scaleY = viewportHeight / height;
    const zoom = Math.log2(Math.max(0.02, Math.min(scaleX, scaleY) * 0.72));
    viewState.target = [(minX + maxX) / 2, (minY + maxY) / 2, 0];
    viewState.zoom = clamp(zoom, -6, 8);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function initDeck() {
    deckInstance = new deckLib.Deck({
      parent: rootEl,
      controller: true,
      views: [new deckLib.OrthographicView({ id: "semantic-map-view" })],
      viewState: Object.assign({}, viewState),
      getCursor: function (params) {
        if (params.isDragging) return "grabbing";
        if (params.isHovering) return "pointer";
        return "grab";
      },
      onViewStateChange: function (params) {
        const nextViewState = params.viewState || {};
        viewState.target = Array.isArray(nextViewState.target)
          ? nextViewState.target.slice()
          : [0, 0, 0];
        viewState.zoom = Number(nextViewState.zoom || 0);
        scheduleViewportFetch();
        return nextViewState;
      },
      onClick: function (info) {
        if (!info || info.object) return;
        selectedNodeId = "";
        renderEmptyDetail();
        renderLayer();
      },
      layers: [],
    });
  }

  async function loadInit() {
    try {
      const data = await api("/api/semantic-map/init?limit=50000");
      const items = normalizeItems(data.items);
      mergeNodes(items);
      fitToInitialData(items);
      initLoaded = true;
      renderLegend();
      renderStats();
      renderLayer();
      if (deckInstance) {
        deckInstance.setProps({ viewState: Object.assign({}, viewState) });
      }
      scheduleViewportFetch();
    } catch (err) {
      console.error("semantic map init failed", err);
      statsEl.textContent = "Initial load failed.";
      detailBodyEl.innerHTML =
        '<div class="detail-empty">Initial load failed: ' +
        escapeHtml((err && err.message) || String(err)) +
        "</div>";
    }
  }

  function bindSearch() {
    searchInputEl.addEventListener("input", function () {
      searchState.keyword = searchInputEl.value || "";
      updateSearchMatches(true);
    });

    searchInputEl.addEventListener("keydown", function (event) {
      if (!searchState.matches.length) return;
      const visibleCount = Math.min(searchState.matches.length, 20);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        searchState.activeIndex = (searchState.activeIndex + 1) % visibleCount;
        renderSearchResults();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        searchState.activeIndex =
          (searchState.activeIndex - 1 + visibleCount) % visibleCount;
        renderSearchResults();
      } else if (event.key === "Enter") {
        event.preventDefault();
        const target =
          searchState.matches[searchState.activeIndex] ||
          searchState.matches[0];
        if (target) focusNodeById(target.id);
      } else if (event.key === "Escape") {
        searchState.keyword = "";
        searchInputEl.value = "";
        updateSearchMatches(true);
      }
    });

    searchButtonEl.addEventListener("click", function () {
      const target =
        searchState.matches[searchState.activeIndex] || searchState.matches[0];
      if (target) {
        focusNodeById(target.id);
      } else {
        searchInputEl.focus();
      }
    });
  }

  function init() {
    initDeck();
    bindSearch();
    renderEmptyDetail();
    renderLegend();
    renderStats();
    void loadInit();
  }

  init();
})();
