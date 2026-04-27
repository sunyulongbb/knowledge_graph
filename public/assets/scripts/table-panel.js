(function () {
  const urlParams = new URLSearchParams(window.location.search);
  let tblPage = parseInt(urlParams.get("page") || "1", 10);
  let tblPageSize = parseInt(urlParams.get("limit") || "20", 10);
  let tblTotalNodes = 0;
  let tblActiveClassId = "";
  let tblActiveClassLabel = "";

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
  const tblCount = document.getElementById("tblCount");

  if (tblPageSizeSelect) {
    tblPageSizeSelect.value = tblPageSize.toString();
  }

  function getUrlParams() {
    const params = new URLSearchParams(window.location.search || "");
    const node = params.get("node") || "";
    const label = params.get("label") || "";
    const view = (params.get("view") || "").toLowerCase();
    const order = params.get("order") || "";
    return { node, label, view, order };
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
      const ontologyUrl = new URL("/api/kb/ontologies?q=", window.location.origin);
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
        const currentValue = tblTypeFilter.value || "";
        tblTypeFilter.innerHTML = "";
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "本体类型";
        tblTypeFilter.appendChild(defaultOption);
        if (Array.isArray(ontologies)) {
          ontologies.forEach((item) => {
            const option = document.createElement("option");
            option.value = item.name || item.label || item.id || "";
            option.textContent = item.name || item.label || item.id || "";
            if (option.value === currentValue) option.selected = true;
            tblTypeFilter.appendChild(option);
          });
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
      }

      if (sortOrder && sortOrder !== "id") {
        url.searchParams.set("order", sortOrder);
      }

      const keyword = tblSearch ? (tblSearch.value || "").trim() : "";
      const propertyId = tblPropertyFilter
        ? (tblPropertyFilter.value || "").trim()
        : "";
      const propertyValue = tblPropertyFilterValue
        ? (tblPropertyFilterValue.value || "").trim()
        : "";

      if (keyword) url.searchParams.set("q", keyword);
      if (tblActiveClassId) url.searchParams.set("type", tblActiveClassId);
      if (propertyId) url.searchParams.set("property_id", propertyId);
      if (propertyValue) url.searchParams.set("property_value", propertyValue);
      url.searchParams.set("hide_entity", "1");

      const resp = await fetch(url);
      if (!resp.ok) throw new Error("HTTP " + resp.status);

      const data = await resp.json();
      const nodes = Array.isArray(data.nodes) ? data.nodes : [];
      window.kbTableNodes = nodes;
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

      if (tblCount) {
        const parts = [`总计 ${tblTotalNodes} 条`];
        if (tblActiveClassLabel) parts.push(`分类 ${tblActiveClassLabel}`);
        else if (tblActiveClassId) parts.push(`分类 ${tblActiveClassId}`);
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
        window.renderTableList();
      }

      const labelHint = tblActiveClassLabel
        ? ` · 分类 ${tblActiveClassLabel}`
        : tblActiveClassId
          ? ` · 分类 ${tblActiveClassId}`
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
          loadTablePage();
        }
      });
    }

    if (btnNextPage) {
      btnNextPage.addEventListener("click", () => {
        const maxPage = Math.ceil(tblTotalNodes / tblPageSize);
        if (tblPage < maxPage) {
          tblPage++;
          loadTablePage();
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
      tblTypeFilter.addEventListener("change", () => {
        tblPage = 1;
        tblActiveClassId = tblTypeFilter.value || "";
        tblActiveClassLabel =
          tblTypeFilter.selectedOptions[0]?.textContent || "";
        loadTablePage({
          classId: tblActiveClassId,
          classLabel: tblActiveClassLabel,
          resetPage: false,
        });
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

    loadTableFilters().catch(() => {});
    loadTablePage();
  }

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
