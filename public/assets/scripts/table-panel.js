(function () {
  const urlParams = new URLSearchParams(window.location.search);
  let tblPage = parseInt(urlParams.get("page") || "1", 10);
  let tblPageSize = parseInt(urlParams.get("limit") || "20", 10);
  let tblTotalNodes = 0;
  let tblLoadedNodes = [];
  let tblGridLoadingMore = false;
  let tblGridLoadExhausted = false;
  let tblActiveType = "";
  let tblActiveClassId = "";
  let tblActiveClassLabel = "";
  let tblGridLoadCheckRaf = 0;
  const EMPTY_TYPE_FILTER = "__EMPTY_NODE_TYPE__";

  const btnPrevPage = document.getElementById("btnPrevPage");
  const btnNextPage = document.getElementById("btnNextPage");
  const tblPageInfo = document.getElementById("tblPageInfo");
  const tblSortSelect = document.getElementById("tblSort");
  const tblPageSizeSelect = document.getElementById("tblPageSize");
  const tblSearch = document.getElementById("tblSearch");
  const tblTypeFilter = document.getElementById("tblTypeFilter");
  const tblPropertyFilter = document.getElementById("tblPropertyFilter");
  const tblPropertyFilterValue = document.getElementById(
    "tblPropertyFilterValue",
  );
  const btnClearTableFilter = document.getElementById("btnClearTableFilter");
  const btnTableRefresh = document.getElementById("btnTableRefresh");
  const btnTblLayoutToggle = document.getElementById("btnTblLayoutToggle");
  const btnDeleteSelected = document.getElementById("btnDeleteSelected");
  const tblCount = document.getElementById("tblCount");
  const tblPagination = document.getElementById("tblPagination");
  const getInitialTableLayoutMode = () => {
    let mode = "list";
    try {
      if (window.localStorage) {
        const stored = localStorage.getItem("kbTableLayoutMode");
        if (stored === "grid") mode = "grid";
      }
    } catch {
      // ignore
    }
    return mode;
  };

  const applyTableLayoutMode = (mode) => {
    const normalized = mode === "grid" ? "grid" : "list";
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
    if (btnTblLayoutToggle) {
      btnTblLayoutToggle.innerHTML =
        normalized === "grid"
          ? '<i class="fa-solid fa-list"></i>'
          : '<i class="fa-solid fa-th-large"></i>';
      btnTblLayoutToggle.title =
        normalized === "grid" ? "切换到列表布局" : "切换到网格布局";
    }
    if (tblPagination) {
      tblPagination.style.display = normalized === "grid" ? "none" : "";
    }
    if (typeof window.renderTableList === "function") {
      window.renderTableList();
    }
  };
  if (tblPageSizeSelect) {
    tblPageSizeSelect.value = tblPageSize.toString();
  }

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

  function getTableScrollContainer() {
    const tblNodes = document.getElementById("tblNodes");
    if (!tblNodes) return null;
    try {
      return tblNodes.closest(".tbl-wrap") || tblNodes;
    } catch {
      return tblNodes;
    }
  }

  function maybeLoadMoreGridRows() {
    if (window.kbTableLayoutMode !== "grid") return;
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
    loadTablePage({ append: true }).finally(() => {
      tblGridLoadingMore = false;
    });
  }

  function scheduleGridLoadMoreCheck() {
    if (tblGridLoadCheckRaf) return;
    tblGridLoadCheckRaf = requestAnimationFrame(() => {
      tblGridLoadCheckRaf = 0;
      maybeLoadMoreGridRows();
    });
  }

  function updateTblPageInfo() {
    const maxPage = Math.max(1, Math.ceil(tblTotalNodes / tblPageSize));
    if (tblPageInfo) {
      tblPageInfo.textContent = `第 ${tblPage} / ${maxPage} 页 · 共 ${tblTotalNodes} 条`;
    }
    if (btnPrevPage) btnPrevPage.disabled = tblPage <= 1;
    if (btnNextPage) btnNextPage.disabled = tblPage >= maxPage;
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

        if (Array.isArray(ontologies)) {
          ontologies.forEach((item) => {
            const option = document.createElement("option");
            option.value = item.id || item.name || item.label || "";
            option.textContent = item.name || item.label || item.id || "";
            if (option.value === currentValue) option.selected = true;
            tblTypeFilter.appendChild(option);
          });
        }
        if (!tblActiveClassLabel && tblTypeFilter.value) {
          tblActiveClassLabel =
            tblTypeFilter.selectedOptions[0]?.textContent ||
            tblTypeFilter.value;
        }
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
      url.searchParams.set("limit", tblPageSize);
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
      try {
        if (window.localStorage) {
          localStorage.setItem("kbTableNodesCache", JSON.stringify(nodes));
        }
      } catch (err) {
        console.warn("kbTableNodes cache failed", err);
      }
      tblTotalNodes = window.kbTableTotalNodes;
      updateTblPageInfo();
      if (tblPagination) {
        tblPagination.style.display =
          window.kbTableLayoutMode === "grid" ? "none" : "";
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
      if (append && window.kbTableLayoutMode === "grid") {
        setTimeout(() => {
          maybeLoadMoreGridRows();
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
    if (tblSortSelect && initial.order) {
      const allowedSortValues = Array.from(tblSortSelect.options || []).map(
        (opt) => opt.value,
      );
      if (allowedSortValues.includes(initial.order)) {
        tblSortSelect.value = initial.order;
      }
    }

    if (btnPrevPage) {
      btnPrevPage.addEventListener("click", () => {
        if (tblPage > 1) {
          tblPage--;
          loadTablePage({ scrollToTop: true });
        }
      });
    }

    if (btnNextPage) {
      btnNextPage.addEventListener("click", () => {
        const maxPage = Math.ceil(tblTotalNodes / tblPageSize);
        if (tblPage < maxPage) {
          tblPage++;
          loadTablePage({ scrollToTop: true });
        }
      });
    }

    if (tblPageSizeSelect) {
      tblPageSizeSelect.addEventListener("change", () => {
        tblPageSize = parseInt(tblPageSizeSelect.value, 10) || 20;
        tblPage = 1;
        loadTablePage();
      });
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
        loadTablePage({ resetPage: false });
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
        const nextMode = window.kbTableLayoutMode === "grid" ? "list" : "grid";
        applyTableLayoutMode(nextMode);
      });
    }

    const scrollContainer = getTableScrollContainer();
    if (scrollContainer) {
      scrollContainer.addEventListener(
        "scroll",
        () => {
          if (window.kbTableLayoutMode === "grid") {
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
