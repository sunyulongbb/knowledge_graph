(function () {
  const urlParams = new URLSearchParams(window.location.search);
  let tblPage = parseInt(urlParams.get("page") || "1", 10);
  let tblPageSize = parseInt(urlParams.get("limit") || "20", 10);
  let tblTotalNodes = 0;
  let tblLoadedNodes = [];
  let tblGridLoadingMore = false;
  let tblGridLoadExhausted = false;
  let tblCacheStorageDisabled = false;
  let tblActiveType = "";
  let tblActiveClassId = "";
  let tblActiveClassLabel = "";
  let tblGridLoadCheckRaf = 0;
  let tblTypeTreeCache = null;
  const EMPTY_TYPE_FILTER = "__EMPTY_NODE_TYPE__";

  const tblPaginationControls = document.getElementById(
    "tblPaginationControls",
  );
  let tblPaginationController = null;
  const tblSortSelect = document.getElementById("tblSort");
  const tblSearch = document.getElementById("tblSearch");
  const tblTypeFilter = document.getElementById("tblTypeFilter");
  const btnTblTypeFilterTree = document.getElementById("btnTblTypeFilterTree");
  const tblTypeFilterTreeLabel = document.getElementById(
    "tblTypeFilterTreeLabel",
  );
  const tblTypeFilterTreeDropdown = document.getElementById(
    "tblTypeFilterTreeDropdown",
  );
  const tblPropertyFilter = document.getElementById("tblPropertyFilter");
  const tblPropertyFilterValue = document.getElementById(
    "tblPropertyFilterValue",
  );
  const btnClearTableFilter = document.getElementById("btnClearTableFilter");
  const btnTableRefresh = document.getElementById("btnTableRefresh");
  const btnTblLayoutToggle = document.getElementById("btnTblLayoutToggle");
  const tblGridZoomControls = document.getElementById("tblGridZoomControls");
  const tblGridZoom = document.getElementById("tblGridZoom");
  const btnTblGridZoomOut = document.getElementById("btnTblGridZoomOut");
  const btnTblGridZoomIn = document.getElementById("btnTblGridZoomIn");
  const btnDeleteSelected = document.getElementById("btnDeleteSelected");
  const tblCount = document.getElementById("tblCount");
  const tblPagination = document.getElementById("tblPagination");
  const TABLE_LAYOUT_MODES = ["list", "grid", "timeline", "semantic", "manage"];
  const normalizeTableLayoutMode = (mode) =>
    mode === "table"
      ? "list"
      : TABLE_LAYOUT_MODES.includes(mode)
        ? mode
        : "list";
  const getInitialTableLayoutMode = () => {
    let mode = "list";
    try {
      if (window.localStorage) {
        const stored = localStorage.getItem("kbTableLayoutMode");
        mode = normalizeTableLayoutMode(stored);
      }
    } catch {
      // ignore
    }
    return mode;
  };
  const isInfiniteTableLayoutMode = (mode = window.kbTableLayoutMode) =>
    mode === "list" || mode === "grid";

  let semanticMapRuntimePromise = null;
  const applySemanticMapSelection = (nodeId) => {
    if (typeof window.setTableSelection !== "function") return;
    window.setTableSelection(nodeId, false, { skipGraphFocus: true });
  };
  window.addEventListener("kb-semantic-map-selection", (event) => {
    applySemanticMapSelection(String(event.detail?.nodeId || "").trim());
  });
  const loadSemanticMapScript = (src, id) =>
    new Promise((resolve, reject) => {
      const existing = document.getElementById(id);
      if (existing) {
        if (existing.dataset.ready === "1") resolve();
        else existing.addEventListener("load", () => resolve(), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = true;
      script.addEventListener("load", () => {
        script.dataset.ready = "1";
        resolve();
      });
      script.addEventListener("error", () => reject(new Error(`加载失败：${src}`)));
      document.head.appendChild(script);
    });
  const ensureSemanticMapRuntime = () => {
    if (window.__kbSemanticMapRuntimeLoaded) return Promise.resolve();
    if (!semanticMapRuntimePromise) {
      semanticMapRuntimePromise = loadSemanticMapScript(
        "/node_modules/deck.gl/dist.min.js",
        "kbDeckGlRuntime",
      )
        .then(() =>
          loadSemanticMapScript(
            "/assets/scripts/semantic-map.js?v=20260904-4",
            "kbSemanticMapRuntime",
          ),
        )
        .then(() => {
          window.__kbSemanticMapRuntimeLoaded = true;
        })
        .catch((error) => {
          semanticMapRuntimePromise = null;
          console.error("加载语义地图失败", error);
        });
    }
    return semanticMapRuntimePromise;
  };

  const clampGridSize = (value) =>
    Math.min(280, Math.max(88, Number(value) || 136));
  const getInitialGridSize = () => {
    try {
      return clampGridSize(localStorage.getItem("kbTableGridSize"));
    } catch {
      return 136;
    }
  };
  const applyGridSize = (value, persist = true) => {
    const size = clampGridSize(value);
    const tblNodes = document.getElementById("tblNodes");
    if (tblNodes)
      tblNodes.style.setProperty("--table-grid-card-size", `${size}px`);
    if (tblGridZoom) {
      tblGridZoom.value = String(size);
      tblGridZoom.setAttribute("aria-valuetext", `${size} 像素`);
    }
    if (btnTblGridZoomOut) btnTblGridZoomOut.disabled = size <= 88;
    if (btnTblGridZoomIn) btnTblGridZoomIn.disabled = size >= 280;
    if (persist) {
      try {
        localStorage.setItem("kbTableGridSize", String(size));
      } catch {}
    }
  };

  const applyTableLayoutMode = (mode) => {
    const normalized = normalizeTableLayoutMode(mode);
    window.kbTableLayoutMode = normalized;
    try {
      if (window.localStorage)
        localStorage.setItem("kbTableLayoutMode", normalized);
    } catch {
      // ignore
    }
    const tblNodes = document.getElementById("tblNodes");
    if (tblNodes) {
      tblNodes.classList.toggle("grid-layout", normalized === "grid");
    }
    document
      .getElementById("tablePanel")
      ?.classList.toggle("manage-layout", normalized === "manage");
    if (btnTblLayoutToggle) {
      const nextMode =
        TABLE_LAYOUT_MODES[
          (TABLE_LAYOUT_MODES.indexOf(normalized) + 1) %
            TABLE_LAYOUT_MODES.length
        ];
      const nextLabel =
        nextMode === "grid"
          ? "网格布局"
          : nextMode === "timeline"
            ? "时间轴布局"
            : nextMode === "semantic"
              ? "语义地图布局"
            : nextMode === "manage"
              ? "管理表格"
              : "列表布局";
      const icon =
        normalized === "grid"
          ? "fa-table-columns"
          : normalized === "timeline"
            ? "fa-clock"
            : normalized === "semantic"
              ? "fa-star-of-life"
            : normalized === "manage"
              ? "fa-list"
              : "fa-th-large";
      btnTblLayoutToggle.innerHTML = `<i class="fa-solid ${icon}"></i>`;
      btnTblLayoutToggle.title = `切换到${nextLabel}`;
      btnTblLayoutToggle.setAttribute("aria-label", `切换到${nextLabel}`);
    }
    if (tblGridZoomControls) {
      tblGridZoomControls.style.display =
        normalized === "grid" ? "flex" : "none";
    }
    const timelineControls = document.getElementById("timelineControls");
    const timelineView = document.getElementById("timelineView");
    const semanticMapView = document.getElementById("semanticMapView");
    const tableWrap = document.querySelector("#tablePanel > .tbl-wrap");
    if (timelineControls)
      timelineControls.style.display =
        normalized === "timeline" ? "flex" : "none";
    if (timelineView)
      timelineView.style.display = normalized === "timeline" ? "block" : "none";
    if (semanticMapView)
      semanticMapView.style.display = normalized === "semantic" ? "block" : "none";
    if (tableWrap)
      tableWrap.style.display =
        normalized === "timeline" || normalized === "semantic" ? "none" : "";
    if (tblPagination) {
      tblPagination.style.display = normalized === "manage" ? "flex" : "none";
    }
    if (typeof window.renderTableList === "function") {
      window.renderTableList();
    }
    if (normalized === "manage") window.openEntityManageTable?.();
    else window.closeEntityManageTable?.();
    updateGridManualLoadButton();
    if (normalized === "timeline") loadTablePage({ resetPage: true });
    if (normalized === "semantic") {
      void ensureSemanticMapRuntime().then(() => {
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event("resize"));
        });
      });
    }
  };
  window.applyTableLayoutMode = applyTableLayoutMode;
  applyGridSize(getInitialGridSize(), false);

  function getUrlParams() {
    const params = new URLSearchParams(window.location.search || "");
    const node = params.get("node") || "";
    const label = params.get("label") || "";
    const view = (params.get("view") || "").toLowerCase();
    const order = params.get("order") || "";
    const type = params.has("type")
      ? params.get("type") || EMPTY_TYPE_FILTER
      : "";
    const classId = params.get("class_id") || "";
    return { node, label, view, order, type, classId };
  }

  function normalizeClassIdForQuery(rawId) {
    if (!rawId) return "";
    const id = String(rawId).trim();
    if (!id) return "";
    if (id.startsWith("entity/")) {
      return id.slice("entity/".length) || "";
    }
    return id;
  }

  function flattenOntologyTree(items, bucket = []) {
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (!item) return;
      const id = String(item.id || item.value || "").trim();
      const name = String(item.name || item.label || item.alias || id).trim();
      if (id && name) bucket.push({ id, name });
      if (Array.isArray(item.children) && item.children.length) {
        flattenOntologyTree(item.children, bucket);
      }
    });
    return bucket;
  }

  async function loadTableTypeTree() {
    if (Array.isArray(tblTypeTreeCache)) return tblTypeTreeCache;
    const url = new URL("/api/kb/ontology/tree", window.location.origin);
    if (typeof window.appendCurrentDbParam === "function") {
      const scopedUrl = window.appendCurrentDbParam(url);
      if (scopedUrl instanceof URL) {
        url.search = scopedUrl.search;
      }
    }
    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    tblTypeTreeCache = Array.isArray(data?.items) ? data.items : [];
    const flat = flattenOntologyTreeWithShape(tblTypeTreeCache);
    window.kbOntologyDisplayShapes = new Map();
    flat.forEach((item) => {
      [item.id, item.name, ...(Array.isArray(item.alias) ? item.alias : [])]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .forEach((key) => {
          window.kbOntologyDisplayShapes.set(
            key,
            item.display_shape || "rectangle",
          );
          window.kbOntologyDisplayShapes.set(
            key.toLowerCase(),
            item.display_shape || "rectangle",
          );
        });
    });
    return tblTypeTreeCache;
  }

  function flattenOntologyTreeWithShape(items, bucket = []) {
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (!item) return;
      const id = String(item.id || "").trim();
      if (id)
        bucket.push({
          id,
          name: item.name || item.label || "",
          alias: item.alias || [],
          display_shape: item.display_shape || "rectangle",
        });
      flattenOntologyTreeWithShape(item.children, bucket);
    });
    return bucket;
  }

  function updateTableTypeTreeLabel() {
    if (!tblTypeFilterTreeLabel) return;
    if (!tblActiveType) {
      tblTypeFilterTreeLabel.textContent = "\u672c\u4f53\u7c7b\u578b";
      return;
    }
    if (tblActiveType === EMPTY_TYPE_FILTER) {
      tblTypeFilterTreeLabel.textContent = "\u65e0\u7c7b\u578b";
      return;
    }
    tblTypeFilterTreeLabel.textContent =
      tblTypeFilter?.selectedOptions?.[0]?.textContent || tblActiveType;
  }

  function setTableTypeFilterValue(nextValue) {
    if (!tblTypeFilter) return;
    tblTypeFilter.value = nextValue || "";
    tblTypeFilter.dispatchEvent(new Event("change", { bubbles: true }));
    if (tblTypeFilterTreeDropdown) {
      tblTypeFilterTreeDropdown.style.display = "none";
    }
    btnTblTypeFilterTree?.setAttribute("aria-expanded", "false");
  }

  function renderTableTypeTreeNodes(items, depth = 0) {
    const frag = document.createDocumentFragment();
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (!item) return;
      const itemId = String(item.id || item.value || "").trim();
      const itemName = String(
        item.name || item.label || item.alias || itemId,
      ).trim();
      if (!itemId || !itemName) return;
      const childItems = Array.isArray(item.children) ? item.children : [];
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "ontology-dropdown-item ontology-dropdown-tree-item" +
        (itemId === tblActiveType ? " selected" : "");
      button.dataset.value = itemId;
      button.style.setProperty("--ontology-tree-depth", String(depth));
      const row = document.createElement("span");
      row.className = "ontology-dropdown-tree-item__row";
      const label = document.createElement("span");
      label.className = "ontology-dropdown-tree-item__label";
      label.textContent = itemName;
      row.appendChild(label);
      if (childItems.length) {
        const meta = document.createElement("span");
        meta.className = "ontology-dropdown-tree-item__meta";
        meta.textContent = String(childItems.length);
        row.appendChild(meta);
      }
      button.appendChild(row);
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        setTableTypeFilterValue(itemId);
      });
      frag.appendChild(button);
      if (childItems.length) {
        frag.appendChild(renderTableTypeTreeNodes(childItems, depth + 1));
      }
    });
    return frag;
  }

  async function buildTableTypeTreeDropdown() {
    if (!tblTypeFilterTreeDropdown) return;
    tblTypeFilterTreeDropdown.innerHTML = "";

    const createAction = (labelText, value, selected) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "ontology-dropdown-item ontology-dropdown-tree-item" +
        (selected ? " selected" : "");
      const row = document.createElement("span");
      row.className = "ontology-dropdown-tree-item__row";
      const label = document.createElement("span");
      label.className = "ontology-dropdown-tree-item__label";
      label.textContent = labelText;
      row.appendChild(label);
      button.appendChild(row);
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        setTableTypeFilterValue(value);
      });
      return button;
    };

    tblTypeFilterTreeDropdown.appendChild(
      createAction("\u5168\u90e8\u7c7b\u578b", "", !tblActiveType),
    );
    tblTypeFilterTreeDropdown.appendChild(
      createAction(
        "\u65e0\u7c7b\u578b",
        EMPTY_TYPE_FILTER,
        tblActiveType === EMPTY_TYPE_FILTER,
      ),
    );

    try {
      const treeItems = await loadTableTypeTree();
      tblTypeFilterTreeDropdown.appendChild(
        renderTableTypeTreeNodes(treeItems, 0),
      );
    } catch (error) {
      console.warn("buildTableTypeTreeDropdown failed", error);
    }
  }

  function getTableScrollContainer() {
    const tblNodes = document.getElementById("tblNodes");
    if (!tblNodes) return null;
    try {
      return tblNodes.closest(".tbl-wrap") || tblNodes;
    } catch {
      return tblNodes;
    }
  }

  function updateGridManualLoadButton(state = "idle") {
    const tblNodes = document.getElementById("tblNodes");
    if (!tblNodes) return;
    tblNodes.querySelector(".table-grid-load-more")?.remove();
    if (window.kbTableLayoutMode !== "grid") return;

    const loaded = Array.isArray(window.kbTableNodes)
      ? window.kbTableNodes.length
      : tblLoadedNodes.length;
    const hasMore = loaded < tblTotalNodes && !tblGridLoadExhausted;
    if (!hasMore && state !== "error") return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "table-grid-load-more";
    button.disabled = state === "loading";
    button.innerHTML =
      state === "loading"
        ? '<i class="fa-solid fa-spinner fa-spin"></i><span>正在加载…</span>'
        : state === "error"
          ? '<i class="fa-solid fa-rotate-right"></i><span>加载失败，点击重试</span>'
          : '<i class="fa-solid fa-plus"></i><span>加载更多</span>';
    button.addEventListener("click", () => loadMoreTableRowsManually());
    tblNodes.appendChild(button);
  }

  function loadMoreTableRowsManually() {
    if (window.kbTableLayoutMode !== "grid") return;
    if (tblGridLoadingMore || tblGridLoadExhausted) return;
    if (tblLoadedNodes.length >= tblTotalNodes) {
      tblGridLoadExhausted = true;
      updateGridManualLoadButton();
      return;
    }
    tblGridLoadingMore = true;
    tblPage += 1;
    updateGridManualLoadButton("loading");
    loadTablePage({ append: true })
      .then(() => updateGridManualLoadButton())
      .catch(() => {
        tblPage = Math.max(1, tblPage - 1);
        updateGridManualLoadButton("error");
      })
      .finally(() => {
        tblGridLoadingMore = false;
      });
  }

  function maybeLoadMoreTableRows() {
    if (!isInfiniteTableLayoutMode()) return;
    if (tblGridLoadingMore || tblGridLoadExhausted) return;
    if (!tblTotalNodes) return;
    const scrollContainer = getTableScrollContainer();
    if (!scrollContainer) return;
    const remaining =
      scrollContainer.scrollHeight -
      scrollContainer.scrollTop -
      scrollContainer.clientHeight;
    if (remaining > 240) return;
    if (tblLoadedNodes.length >= tblTotalNodes) {
      tblGridLoadExhausted = true;
      return;
    }
    tblGridLoadingMore = true;
    tblPage += 1;
    updateGridManualLoadButton("loading");
    loadTablePage({ append: true })
      .catch(() => {
        tblPage = Math.max(1, tblPage - 1);
        updateGridManualLoadButton("error");
      })
      .finally(() => {
        tblGridLoadingMore = false;
        updateGridManualLoadButton();
      });
  }

  function scheduleGridLoadMoreCheck() {
    if (tblGridLoadCheckRaf) return;
    tblGridLoadCheckRaf = requestAnimationFrame(() => {
      tblGridLoadCheckRaf = 0;
      maybeLoadMoreTableRows();
    });
  }

  function updateTblPageInfo() {
    const maxPage = Math.max(1, Math.ceil(tblTotalNodes / tblPageSize));
    if (tblPaginationController) {
      tblPaginationController.setState({
        page: tblPage,
        pageSize: tblPageSize,
        total: tblTotalNodes,
      });
    }
  }

  async function loadTableFilters() {
    const fetchJson = async (url) => {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    };

    try {
      const ontologyUrl = new URL(
        "/api/kb/ontologies?q=",
        window.location.origin,
      );
      if (typeof window.appendCurrentDbParam === "function") {
        const scopedUrl = window.appendCurrentDbParam(ontologyUrl);
        if (scopedUrl instanceof URL) {
          ontologyUrl.search = scopedUrl.search;
        }
      }
      const [ontologies, properties] = await Promise.all([
        fetchJson(ontologyUrl.toString()),
        fetchJson("/api/kb/properties?status=active"),
      ]);

      if (tblTypeFilter) {
        // 优先使用内存状态 tblActiveType 作为还原基准，避免选项未加载时 tblTypeFilter.value 为空的竞态问题
        const currentValue = tblActiveType || tblTypeFilter.value || "";
        tblTypeFilter.innerHTML = "";
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "本体类型";
        tblTypeFilter.appendChild(defaultOption);

        const emptyTypeOption = document.createElement("option");
        emptyTypeOption.value = EMPTY_TYPE_FILTER;
        emptyTypeOption.textContent = "无类型";
        if (emptyTypeOption.value === currentValue)
          emptyTypeOption.selected = true;
        tblTypeFilter.appendChild(emptyTypeOption);

        const treeItems = await loadTableTypeTree().catch(() => []);
        const flatOntologies = treeItems.length
          ? flattenOntologyTree(treeItems)
          : Array.isArray(ontologies)
            ? ontologies.map((item) => ({
                id: item.id || item.name || item.label || "",
                name: item.name || item.label || item.id || "",
              }))
            : [];
        const seenTypeValues = new Set(["", EMPTY_TYPE_FILTER]);
        flatOntologies.forEach((item) => {
          const optionValue = String(item?.id || "").trim();
          if (!optionValue || seenTypeValues.has(optionValue)) return;
          seenTypeValues.add(optionValue);
          const option = document.createElement("option");
          option.value = optionValue;
          option.textContent = item.name || optionValue;
          if (option.value === currentValue) option.selected = true;
          tblTypeFilter.appendChild(option);
        });
        if (!tblActiveClassLabel && tblTypeFilter.value) {
          tblActiveClassLabel =
            tblTypeFilter.selectedOptions[0]?.textContent ||
            tblTypeFilter.value;
        }
        updateTableTypeTreeLabel();
      }

      if (tblPropertyFilter) {
        const currentValue = tblPropertyFilter.value || "";
        tblPropertyFilter.innerHTML = "";
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "筛选属性";
        tblPropertyFilter.appendChild(defaultOption);
        if (Array.isArray(properties)) {
          properties.forEach((item) => {
            const option = document.createElement("option");
            option.value = item.id || item.name || "";
            option.textContent = item.name || item.id || "";
            if (option.value === currentValue) option.selected = true;
            tblPropertyFilter.appendChild(option);
          });
        }
      }
    } catch (err) {
      console.warn("load table filters failed", err);
    }
  }

  function setPropertyValueOptions(values = []) {
    if (!tblPropertyFilterValue) return;
    const currentValue = tblPropertyFilterValue.value || "";
    tblPropertyFilterValue.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "属性值";
    tblPropertyFilterValue.appendChild(placeholder);
    values.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id || item.label || String(item);
      option.textContent = item.label || item.id || String(item);
      if (option.value === currentValue) option.selected = true;
      tblPropertyFilterValue.appendChild(option);
    });
  }

  async function loadPropertyValueOptions(propertyId) {
    if (!propertyId || !tblPropertyFilterValue) {
      setPropertyValueOptions([]);
      return;
    }
    setPropertyValueOptions([]);
    const loadingOption = document.createElement("option");
    loadingOption.value = "";
    loadingOption.textContent = "加载属性值…";
    tblPropertyFilterValue.appendChild(loadingOption);

    try {
      const url = new URL(
        "/api/kb/property/value_suggestions",
        window.location.origin,
      );
      if (typeof window.appendCurrentDbParam === "function") {
        const scopedUrl = window.appendCurrentDbParam(url);
        if (scopedUrl instanceof URL) {
          url.search = scopedUrl.search;
        }
      }
      url.searchParams.set("property", propertyId);
      url.searchParams.set("limit", "100");
      const resp = await fetch(url.toString());
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      setPropertyValueOptions(items);
    } catch (err) {
      console.warn("load property values failed", err);
      setPropertyValueOptions([]);
    }
  }

  async function loadTablePage(options = {}) {
    const opts = options || {};
    const append = opts.append === true;
    const hasClassId = Object.prototype.hasOwnProperty.call(opts, "classId");
    if (hasClassId) {
      const incomingId = opts.classId || "";
      if (incomingId !== tblActiveClassId && opts.resetPage !== false) {
        tblPage = 1;
      }
      tblActiveClassId = incomingId;
    }
    if (opts.resetPage) {
      tblPage = 1;
    }
    if (Object.prototype.hasOwnProperty.call(opts, "classLabel")) {
      tblActiveClassLabel = opts.classLabel || "";
    } else if (hasClassId && !opts.classId) {
      tblActiveClassLabel = "";
    }

    if (typeof window.setStatus === "function") {
      window.setStatus(true, "加载中…");
    }

    try {
      const offset = (tblPage - 1) * tblPageSize;
      const url = new URL("/api/kb/entity_search", window.location.origin);
      if (typeof window.appendCurrentDbParam === "function") {
        const scopedUrl = window.appendCurrentDbParam(url);
        if (scopedUrl instanceof URL) {
          url.search = scopedUrl.search;
        }
      }
      url.searchParams.set(
        "limit",
        window.kbTableLayoutMode === "timeline" ? "300" : tblPageSize,
      );
      url.searchParams.set("offset", offset);

      const sortOrder = tblSortSelect ? tblSortSelect.value : "";
      if (typeof window.updateUrlParam === "function") {
        window.updateUrlParam("order", sortOrder === "id" ? "" : sortOrder);
        window.updateUrlParam("page", tblPage);
        window.updateUrlParam("limit", tblPageSize);
        window.updateUrlParam(
          "type",
          tblActiveType === EMPTY_TYPE_FILTER
            ? EMPTY_TYPE_FILTER
            : tblActiveType,
        );
        window.updateUrlParam("class_id", tblActiveClassId);
      }

      const keyword = tblSearch ? (tblSearch.value || "").trim() : "";
      const propertyId = tblPropertyFilter
        ? (tblPropertyFilter.value || "").trim()
        : "";
      const propertyValue = tblPropertyFilterValue
        ? (tblPropertyFilterValue.value || "").trim()
        : "";

      if (keyword) url.searchParams.set("q", keyword);
      if (tblActiveType === EMPTY_TYPE_FILTER) {
        url.searchParams.set("type", "");
      } else if (tblActiveType) {
        url.searchParams.set("type", tblActiveType);
      }
      if (tblActiveClassId) url.searchParams.set("class_id", tblActiveClassId);
      if (propertyId) url.searchParams.set("property_id", propertyId);
      if (propertyValue) url.searchParams.set("property_value", propertyValue);
      if (window.kbTableLayoutMode === "grid") {
        url.searchParams.set("has_media", "1");
      }
      url.searchParams.set("hide_entity", "1");

      const resp = await fetch(url);
      if (!resp.ok) throw new Error("HTTP " + resp.status);

      const data = await resp.json();
      const nodes = Array.isArray(data.nodes) ? data.nodes : [];
      if (append) {
        const existing = Array.isArray(window.kbTableNodes)
          ? window.kbTableNodes
          : [];
        const seen = new Set(
          existing.map((item) => String(item?._id || item?.id || "").trim()),
        );
        const merged = [...existing];
        nodes.forEach((item) => {
          const nodeKey = String(item?._id || item?.id || "").trim();
          if (nodeKey && seen.has(nodeKey)) return;
          if (nodeKey) seen.add(nodeKey);
          merged.push(item);
        });
        window.kbTableNodes = merged;
        tblLoadedNodes = merged;
      } else {
        window.kbTableNodes = nodes;
        tblLoadedNodes = nodes;
        tblGridLoadExhausted = false;
      }
      window.kbTablePage = tblPage;
      window.kbTablePageSize = tblPageSize;
      window.kbTableTotalNodes = data.total || nodes.length;
      if (window.kbTableLayoutMode === "timeline") {
        window.kbTimeline?.update(window.kbTableNodes);
      }
      try {
        if (!tblCacheStorageDisabled && window.localStorage) {
          localStorage.setItem("kbTableNodesCache", JSON.stringify(nodes));
        }
      } catch (err) {
        if (err && err.name === "QuotaExceededError") {
          tblCacheStorageDisabled = true;
          try {
            localStorage.removeItem("kbTableNodesCache");
          } catch {}
        } else {
          console.warn("kbTableNodes cache failed", err);
        }
      }
      tblTotalNodes = window.kbTableTotalNodes;
      updateTblPageInfo();
      if (tblPagination) {
        tblPagination.style.display =
          window.kbTableLayoutMode === "manage" ? "flex" : "none";
      }

      if (tblCount) {
        const parts = [`总计 ${tblTotalNodes} 条`];
        if (tblActiveClassLabel) parts.push(`分类 ${tblActiveClassLabel}`);
        else if (tblActiveClassId) parts.push(`分类 ${tblActiveClassId}`);
        if (tblActiveType) {
          const typeLabel =
            tblActiveType === EMPTY_TYPE_FILTER
              ? "无类型"
              : tblTypeFilter
                ? tblTypeFilter.selectedOptions[0]?.textContent || tblActiveType
                : tblActiveType;
          parts.push(`类型 ${typeLabel}`);
        }
        if (propertyId) {
          const propertyLabel = tblPropertyFilter
            ? tblPropertyFilter.selectedOptions[0]?.textContent || propertyId
            : propertyId;
          parts.push(`属性 ${propertyLabel}`);
        }
        if (propertyValue) {
          parts.push(`值 ${propertyValue}`);
        }
        tblCount.textContent = parts.join(" · ");
      }

      if (typeof window.renderTableList === "function") {
        window.renderTableList({ append });
      }
      if (window.kbTableLayoutMode === "manage") {
        window.openEntityManageTable?.();
      }
      updateGridManualLoadButton();
      if (isInfiniteTableLayoutMode()) {
        setTimeout(() => {
          maybeLoadMoreTableRows();
        }, 0);
      }

      if (opts.scrollToTop === true) {
        try {
          const list = document.getElementById("tblNodes");
          const container = list?.closest?.(".tbl-wrap") || list;
          if (container) {
            container.scrollTop = 0;
          }
        } catch {}
      }

      const labelHint = tblActiveClassLabel
        ? ` · 分类 ${tblActiveClassLabel}`
        : tblActiveClassId
          ? ` · 分类 ${tblActiveClassId}`
          : tblActiveType
            ? ` · 类型 ${tblActiveType}`
            : "";
      if (typeof window.setStatus === "function") {
        window.setStatus(false, `已加载 ${nodes.length} 条${labelHint}`);
      }
    } catch (e) {
      if (typeof window.setStatus === "function") {
        window.setStatus(false, "加载失败");
      }
      if (append) throw e;
      alert("加载失败: " + (e.message || e));
    }
  }

  async function loadInstancesForClass(classId, options = {}) {
    const normalizedId = normalizeClassIdForQuery(classId);
    const nextOptions = {
      classId: normalizedId,
      resetPage: options.resetPage !== false,
      classLabel: options.classLabel || "",
    };
    await loadTablePage(nextOptions);
  }

  function initTablePanel() {
    const initial = getUrlParams();
    if (tblSortSelect) {
      const allowedSortValues = Array.from(tblSortSelect.options || []).map(
        (opt) => opt.value,
      );
      const initialOrder = initial.order || "modified_desc";
      if (allowedSortValues.includes(initialOrder)) {
        tblSortSelect.value = initialOrder;
      }
    }

    if (tblPaginationControls && window.KbPaginationController) {
      tblPaginationController = new window.KbPaginationController(
        tblPaginationControls,
        {
          page: tblPage,
          pageSize: tblPageSize,
          onPageChange: (page) => {
            tblPage = page;
            loadTablePage({ scrollToTop: true });
          },
          onPageSizeChange: (pageSize) => {
            tblPageSize = pageSize;
            tblPage = 1;
            loadTablePage({ scrollToTop: true });
          },
        },
      );
    }

    const tblSortTimeHeader = document.getElementById("tblSortTimeHeader");
    const tblSortTimeIcon = document.getElementById("tblSortTimeIcon");

    const updateTimeSortHeader = () => {
      if (!tblSortSelect || !tblSortTimeIcon) return;
      const value = tblSortSelect.value;
      if (value === "modified_desc") {
        tblSortTimeIcon.textContent = "↓";
      } else if (value === "modified_asc") {
        tblSortTimeIcon.textContent = "↑";
      } else {
        tblSortTimeIcon.textContent = "";
      }
    };

    if (tblSortSelect) {
      tblSortSelect.addEventListener("change", () => {
        tblPage = 1;
        updateTimeSortHeader();
        loadTablePage();
      });
      updateTimeSortHeader();
    }

    if (tblSortTimeHeader) {
      tblSortTimeHeader.addEventListener("click", () => {
        if (!tblSortSelect) return;
        const current = tblSortSelect.value;
        if (current === "modified_desc") {
          tblSortSelect.value = "modified_asc";
        } else {
          tblSortSelect.value = "modified_desc";
        }
        tblPage = 1;
        updateTimeSortHeader();
        loadTablePage();
      });
    }

    if (tblSearch) {
      tblSearch.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          tblPage = 1;
          loadTablePage();
        }
      });
    }

    if (tblTypeFilter) {
      if (initial.type) {
        tblActiveType = initial.type;
        tblTypeFilter.value = initial.type;
      }
      if (initial.classId) {
        tblActiveClassId = normalizeClassIdForQuery(initial.classId);
      }
      tblTypeFilter.addEventListener("change", () => {
        tblPage = 1;
        tblActiveType = tblTypeFilter.value || "";
        updateTableTypeTreeLabel();
        loadTablePage({ resetPage: false });
      });
    }

    if (btnTblTypeFilterTree && tblTypeFilterTreeDropdown) {
      const positionTableTypeDropdown = () => {
        const rect = btnTblTypeFilterTree.getBoundingClientRect();
        const dropdownWidth = Math.min(360, Math.max(240, rect.width));
        const viewportPadding = 12;
        const left = Math.min(
          Math.max(viewportPadding, rect.left),
          Math.max(
            viewportPadding,
            window.innerWidth - dropdownWidth - viewportPadding,
          ),
        );
        const availableBelow =
          window.innerHeight - rect.bottom - viewportPadding;
        const openAbove = availableBelow < 220 && rect.top > availableBelow;
        tblTypeFilterTreeDropdown.style.width = `${dropdownWidth}px`;
        tblTypeFilterTreeDropdown.style.left = `${left}px`;
        tblTypeFilterTreeDropdown.style.right = "auto";
        if (openAbove) {
          tblTypeFilterTreeDropdown.style.top = "auto";
          tblTypeFilterTreeDropdown.style.bottom = `${window.innerHeight - rect.top + 6}px`;
        } else {
          tblTypeFilterTreeDropdown.style.top = `${rect.bottom + 6}px`;
          tblTypeFilterTreeDropdown.style.bottom = "auto";
        }
      };

      btnTblTypeFilterTree.addEventListener("click", async (event) => {
        event.stopPropagation();
        await buildTableTypeTreeDropdown();
        const isVisible = tblTypeFilterTreeDropdown.style.display !== "none";
        if (isVisible) {
          tblTypeFilterTreeDropdown.style.display = "none";
          btnTblTypeFilterTree.setAttribute("aria-expanded", "false");
          return;
        }
        if (tblTypeFilterTreeDropdown.parentElement !== document.body) {
          document.body.appendChild(tblTypeFilterTreeDropdown);
        }
        tblTypeFilterTreeDropdown.classList.add("is-portal");
        positionTableTypeDropdown();
        tblTypeFilterTreeDropdown.style.display = "block";
        btnTblTypeFilterTree.setAttribute("aria-expanded", "true");
      });

      document.addEventListener("click", (event) => {
        const target = event.target;
        if (
          tblTypeFilterTreeDropdown.style.display !== "none" &&
          target instanceof Node &&
          !tblTypeFilterTreeDropdown.contains(target) &&
          !btnTblTypeFilterTree.contains(target)
        ) {
          tblTypeFilterTreeDropdown.style.display = "none";
          btnTblTypeFilterTree.setAttribute("aria-expanded", "false");
        }
      });

      window.addEventListener("resize", () => {
        if (tblTypeFilterTreeDropdown.style.display !== "none") {
          positionTableTypeDropdown();
        }
      });
    }

    if (tblPropertyFilter) {
      tblPropertyFilter.addEventListener("change", () => {
        tblPage = 1;
        if (tblPropertyFilterValue) {
          tblPropertyFilterValue.value = "";
          setPropertyValueOptions([]);
        }
        loadPropertyValueOptions(tblPropertyFilter.value || "");
        loadTablePage();
      });
    }

    if (tblPropertyFilterValue) {
      const refreshOnPropertyValueChange = () => {
        tblPage = 1;
        loadTablePage();
      };
      tblPropertyFilterValue.addEventListener(
        "change",
        refreshOnPropertyValueChange,
      );
      tblPropertyFilterValue.addEventListener(
        "input",
        refreshOnPropertyValueChange,
      );
    }

    if (btnClearTableFilter) {
      btnClearTableFilter.addEventListener("click", () => {
        if (tblPropertyFilter) tblPropertyFilter.value = "";
        if (tblPropertyFilterValue) {
          tblPropertyFilterValue.value = "";
          setPropertyValueOptions([]);
        }
        tblPage = 1;
        loadTablePage();
      });
    }

    if (btnTblLayoutToggle) {
      btnTblLayoutToggle.addEventListener("click", () => {
        const currentMode = normalizeTableLayoutMode(window.kbTableLayoutMode);
        const nextMode =
          TABLE_LAYOUT_MODES[
            (TABLE_LAYOUT_MODES.indexOf(currentMode) + 1) %
              TABLE_LAYOUT_MODES.length
          ];
        applyTableLayoutMode(nextMode);
        tblPage = 1;
        tblLoadedNodes = [];
        tblGridLoadExhausted = false;
        loadTablePage({ resetPage: false, scrollToTop: true });
      });
    }

    if (tblGridZoom) {
      tblGridZoom.addEventListener("input", () =>
        applyGridSize(tblGridZoom.value),
      );
    }
    if (btnTblGridZoomOut) {
      btnTblGridZoomOut.addEventListener("click", () =>
        applyGridSize(Number(tblGridZoom?.value || 136) - 16),
      );
    }
    if (btnTblGridZoomIn) {
      btnTblGridZoomIn.addEventListener("click", () =>
        applyGridSize(Number(tblGridZoom?.value || 136) + 16),
      );
    }

    const tblNodes = document.getElementById("tblNodes");
    if (tblNodes) {
      tblNodes.addEventListener(
        "wheel",
        (event) => {
          if (
            window.kbTableLayoutMode !== "grid" ||
            (!event.ctrlKey && !event.metaKey)
          )
            return;
          event.preventDefault();
          applyGridSize(
            Number(tblGridZoom?.value || 136) + (event.deltaY < 0 ? 8 : -8),
          );
        },
        { passive: false },
      );
    }

    const scrollContainer = getTableScrollContainer();
    if (scrollContainer) {
      scrollContainer.addEventListener(
        "scroll",
        () => {
          if (isInfiniteTableLayoutMode()) {
            scheduleGridLoadMoreCheck();
          }
        },
        { passive: true },
      );
    }

    applyTableLayoutMode(getInitialTableLayoutMode());

    // 先加载筛选选项，确保下拉框选中项与 tblActiveType 同步，再加载数据，避免竞态导致筛选显示不正确
    loadTableFilters()
      .catch(() => {})
      .finally(() => {
        if (tblTypeFilter && tblActiveType) {
          tblTypeFilter.value = tblActiveType;
        }
        updateTableTypeTreeLabel();
        loadTablePage({ resetPage: true });
      });
  }

  // 切换应用（db 参数变化）时重置所有筛选状态并重新加载
  window.addEventListener("kb:url-param-changed", (event) => {
    const detail = event && event.detail ? event.detail : {};
    if ((detail.key || "") !== "db") return;
    if ((detail.value || "") === (detail.previousValue || "")) return;

    // db-modal.js 的 setUrlParam 先触发事件再做 location.href 整页跳转，
    // 此时 URL 尚未更新；若事件触发时 URL 中的 db 与新值不符，说明即将整页跳转，
    // 不需要在此处 fetch（跳转后页面自行初始化），直接跳过避免 Failed to fetch。
    try {
      const currentDbInUrl =
        new URL(window.location.href).searchParams.get("db") || "";
      if (currentDbInUrl !== (detail.value || "")) return;
    } catch {
      return;
    }

    // 重置筛选状态
    tblPage = 1;
    tblActiveType = "";
    tblActiveClassId = "";
    tblActiveClassLabel = "";

    if (tblTypeFilter) tblTypeFilter.value = "";
    if (tblTypeFilterTreeDropdown)
      tblTypeFilterTreeDropdown.style.display = "none";
    if (tblPropertyFilter) tblPropertyFilter.value = "";
    if (tblPropertyFilterValue) {
      tblPropertyFilterValue.value = "";
      setPropertyValueOptions([]);
    }
    if (tblSearch) tblSearch.value = "";

    // 重新加载筛选选项和数据
    loadTableFilters()
      .catch(() => {})
      .finally(() => {
        updateTableTypeTreeLabel();
        loadTablePage({ resetPage: true });
      });
  });

  window.normalizeClassIdForQuery = normalizeClassIdForQuery;
  window.loadTablePage = loadTablePage;
  window.loadInstancesForClass = loadInstancesForClass;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTablePanel, {
      once: true,
    });
  } else {
    initTablePanel();
  }
})();
