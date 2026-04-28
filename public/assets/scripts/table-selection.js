(function () {
  const shared = window.kbApp || {};
  const state = shared.state || {};
  const dom = shared.dom || {};
  const byId = dom.byId || ((id) => document.getElementById(id));
  const btnDeleteSelected = byId("btnDeleteSelected");
  const tblNodes = byId("tblNodes");

  if (typeof state.bindAlias === "function") {
    state.bindAlias("kbSelectedRowId", "selectedRowId", "");
    state.bindAlias("kbSelectedRowIds", "selectedRowIds", () => new Set());
    state.bindAlias("kbLastAnchorRowId", "lastAnchorRowId", "");
    state.bindAlias("kbSelectionHydrated", "selectionHydrated", false);
  }

  function ensureTableSelectedButtonsState() {
    const count =
      window.kbSelectedRowIds &&
      typeof window.kbSelectedRowIds.size === "number"
        ? window.kbSelectedRowIds.size
        : window.kbSelectedRowId
          ? 1
          : 0;
    try {
      if (btnDeleteSelected) {
        btnDeleteSelected.disabled = count === 0;
      }
    } catch {}
  }

  function appendCurrentDbToUrl(url) {
    if (!(url instanceof URL)) return url;
    try {
      if (typeof window.appendCurrentDbParam === "function") {
        const scopedUrl = window.appendCurrentDbParam(new URL(url.toString()));
        if (scopedUrl instanceof URL) {
          url.search = scopedUrl.search;
          return url;
        }
      }
    } catch {}

    let db = "";
    try {
      if (typeof window.getCurrentDbParam === "function") {
        db = String(window.getCurrentDbParam() || "").trim();
      }
    } catch {}
    if (!db) {
      try {
        const currentUrl = new URL(window.location.href);
        db = String(currentUrl.searchParams.get("db") || "").trim();
      } catch {}
    }
    if (db) {
      url.searchParams.set("db", db);
    }
    return url;
  }

  function buildDetailPageUrl(nodeId) {
    if (!nodeId) return window.location.href;
    try {
      const currentUrl = new URL(window.location.href);
      const search = new URLSearchParams(currentUrl.search || "");
      search.delete("view");
      search.delete("node");
      const basePath = currentUrl.pathname || "/";
      const searchString = search.toString();
      return (
        basePath +
        (searchString ? "?" + searchString : "") +
        "#view=detail&node=" +
        encodeURIComponent(nodeId)
      );
    } catch (err) {
      return "/#view=detail&node=" + encodeURIComponent(nodeId);
    }
  }

  function navigateToDetailPage(nodeId) {
    if (!nodeId) return;
    try {
      setTableSelection("", false);
    } catch {}
    window.location.href = buildDetailPageUrl(nodeId);
  }

  function updateSelectedRowStyles() {
    try {
      if (!tblNodes) return;
      const rows = tblNodes.querySelectorAll("tbody tr");
      rows.forEach((tr) => {
        const rid = tr.getAttribute("data-id") || "";
        const selected =
          (window.kbSelectedRowIds && window.kbSelectedRowIds.has(rid)) ||
          rid === window.kbSelectedRowId;
        tr.classList.toggle("selected", selected);
      });
    } catch {}
  }

  function syncCheckboxStates() {
    try {
      if (!tblNodes) return;
      const checkboxes = tblNodes.querySelectorAll("tbody .row-checkbox");
      let checkedCount = 0;
      checkboxes.forEach((chk) => {
        const rid = chk.getAttribute("data-id") || "";
        const selected =
          window.kbSelectedRowIds && window.kbSelectedRowIds.has(rid);
        chk.checked = selected;
        if (selected) checkedCount++;
      });
      // 更新全选复选框状态
      const chkSelectAll = document.getElementById("chkSelectAll");
      if (chkSelectAll) {
        const total = checkboxes.length;
        chkSelectAll.checked = total > 0 && checkedCount === total;
        chkSelectAll.indeterminate = checkedCount > 0 && checkedCount < total;
      }
    } catch {}
  }

  function setTableSelection(id, autoEdit = true, options = {}) {
    const opts = options || {};
    const skipDetailRefresh = opts.skipDetailRefresh === true;
    const skipSidebarSync = opts.skipSidebarSync === true;
    const selectedId = id || "";
    window.kbSelectedRowId = selectedId;
    window.kbSelectedRowIds = new Set(selectedId ? [selectedId] : []);
    window.kbLastAnchorRowId = selectedId;
    window.kbSelectedNodeId = selectedId;
    window.kbCurrentNodeId = selectedId;
    if (id) {
      window.kbActiveVisNodeId =
        (typeof stripEntityIdPrefix === "function" &&
          stripEntityIdPrefix(id)) ||
        id;
      window.kbActiveDetailRouteId = id;
      try {
        if (typeof normalizeEntityIdForApi === "function") {
          window.kbActiveDetailNodeId = normalizeEntityIdForApi(id) || id;
        } else {
          window.kbActiveDetailNodeId = id;
        }
      } catch {
        window.kbActiveDetailNodeId = id;
      }
    } else {
      window.kbActiveVisNodeId = "";
      window.kbActiveDetailRouteId = "";
      window.kbActiveDetailNodeId = "";
    }
    if (!id) {
      window.kbSelectionHydrated = false;
    }
    updateSelectedRowStyles();
    syncCheckboxStates();
    ensureTableSelectedButtonsState();
    if ((window.kbViewMode || "table") === "table") {
      try {
        if (typeof syncHashForView === "function") {
          syncHashForView("table", {
            nodeId: id || "",
            includeNode: true,
          });
        }
      } catch (err) {
        if (window.console && console.warn) {
          console.warn("sync hash for selection failed", err);
        }
      }
    }
    if (autoEdit && id) {
      try {
        if (typeof enterEditById === "function") {
          enterEditById(id);
          window.kbSelectionHydrated = true;
        }
      } catch (e) {
        console.error("enterEditById failed", e);
      }
    }
    try {
      if (!skipDetailRefresh && window.kbViewMode === "detail" && id) {
        if (typeof showNodeDetailInline === "function") {
          showNodeDetailInline(id);
        }
      }
    } catch {}
    try {
      if (window.kbViewMode === "vis" && id) {
        if (typeof focusNode === "function") {
          focusNode(id, { fit: false, duration: 180 });
        }
      }
    } catch {}
    // --- 自动同步左侧属性/关系面板 ---
    try {
      if (!skipSidebarSync) {
        var fId = window.fId || document.getElementById("fId");
        if (fId && typeof fId === "object") fId.value = id || "";
        if (typeof window.loadAttributes === "function") {
          window.loadAttributes(id);
        }
      }
    } catch (e) {
      console.warn("自动同步属性面板失败", e);
    }
  }

  function toggleCtrlSelection(id) {
    if (!id) return;
    if (!window.kbSelectedRowIds) window.kbSelectedRowIds = new Set();
    if (window.kbSelectedRowIds.has(id)) window.kbSelectedRowIds.delete(id);
    else window.kbSelectedRowIds.add(id);
    if (window.kbSelectedRowIds.size === 1) {
      window.kbLastAnchorRowId = Array.from(window.kbSelectedRowIds)[0];
    }
    if (window.kbSelectedRowIds.size === 1) {
      const primaryId = Array.from(window.kbSelectedRowIds)[0] || "";
      window.kbSelectedRowId = primaryId;
      window.kbSelectedNodeId = primaryId;
      window.kbCurrentNodeId = primaryId;
      if (primaryId) {
        window.kbActiveVisNodeId =
          (typeof stripEntityIdPrefix === "function" &&
            stripEntityIdPrefix(primaryId)) ||
          primaryId;
        window.kbActiveDetailRouteId = primaryId;
      }
    }
    updateSelectedRowStyles();
    syncCheckboxStates();
    ensureTableSelectedButtonsState();
  }

  function rangeSelectTo(id) {
    try {
      if (!tblNodes) {
        setTableSelection(id);
        return;
      }
      const rows = Array.from(tblNodes.querySelectorAll("tbody tr"));
      const ids = rows.map((tr) => tr.getAttribute("data-id") || "");
      const a = ids.indexOf(window.kbLastAnchorRowId || "");
      const b = ids.indexOf(id || "");
      if (a === -1 || b === -1) {
        setTableSelection(id);
        return;
      }
      const [start, end] = a < b ? [a, b] : [b, a];
      window.kbSelectedRowIds = new Set(ids.slice(start, end + 1));
      const primaryId = ids[b] || id || "";
      window.kbSelectedRowId = primaryId;
      window.kbSelectedNodeId = primaryId;
      window.kbCurrentNodeId = primaryId;
      if (primaryId) {
        window.kbActiveVisNodeId =
          (typeof stripEntityIdPrefix === "function" &&
            stripEntityIdPrefix(primaryId)) ||
          primaryId;
        window.kbActiveDetailRouteId = primaryId;
      }
      updateSelectedRowStyles();
      syncCheckboxStates();
      ensureTableSelectedButtonsState();
    } catch {
      setTableSelection(id);
    }
  }

  function getTableRows() {
    try {
      if (!tblNodes) return [];
      return Array.from(tblNodes.querySelectorAll("tbody tr")) || [];
    } catch {
      return [];
    }
  }

  function focusRowElement(row) {
    if (!row) return;
    try {
      row.focus({ preventScroll: true });
    } catch {}
  }

  function scrollRowIntoView(row) {
    if (!row) return;
    try {
      row.scrollIntoView({ block: "nearest" });
    } catch {}
  }

  function moveTableSelection(step) {
    if (!step) return;
    const rows = getTableRows();
    if (!rows.length) return;
    let idx = rows.findIndex(
      (tr) => (tr.getAttribute("data-id") || "") === window.kbSelectedRowId,
    );
    if (idx === -1) idx = step > 0 ? -1 : rows.length;
    idx = Math.max(0, Math.min(rows.length - 1, idx + step));
    const target = rows[idx];
    if (!target) return;
    const id = target.getAttribute("data-id") || "";
    if (!id) return;
    if (window.kbSelectedRowId !== id) {
      setTableSelection(id);
    }
    requestAnimationFrame(() => {
      focusRowElement(target);
      scrollRowIntoView(target);
    });
  }

  function openSelectedNodeDetail() {
    const ids =
      window.kbSelectedRowIds && window.kbSelectedRowIds.size
        ? Array.from(window.kbSelectedRowIds)
        : [];
    const primaryId = ids.length ? ids[0] : window.kbSelectedRowId || "";
    if (!primaryId) return false;

    const rows = getTableRows();
    const target = rows.find(
      (tr) => (tr.getAttribute("data-id") || "") === primaryId,
    );
    let href = "";
    if (target) {
      const link = target.querySelector("td:nth-child(2) a");
      if (link && link.href) {
        href = link.href;
      }
    }
    if (!href) {
      const label = target
        ? target.querySelector("td:nth-child(2) a")?.textContent || ""
        : "";
      const params = new URLSearchParams();
      params.set("id", primaryId);
      const trimmed = label.trim();
      if (trimmed) params.set("label", trimmed);
      href = "/kb/detail" + (params.toString() ? "?" + params.toString() : "");
    }
    try {
      navigateToDetailPage(primaryId);
      return true;
    } catch {}
    return false;
  }

  function positionTooltip(e, tip) {
    const pad = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = tip.getBoundingClientRect();
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if (x + rect.width + pad > vw) x = vw - rect.width - pad;
    if (y + rect.height + pad > vh) y = vh - rect.height - pad;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }

  function openMediaViewForNode(viewMode, node) {
    const targetMode = viewMode === "gallery" ? "gallery" : "shorts";
    const nodeId = String(node?._id || node?.id || "").trim();
    if (!nodeId) return;
    try {
      setTableSelection(nodeId, false, {
        skipDetailRefresh: true,
        skipSidebarSync: true,
      });
    } catch {}
    const currentDbSuffix = (() => {
      try {
        const db =
          typeof window.getCurrentDbParam === "function"
            ? window.getCurrentDbParam()
            : new URL(window.location.href).searchParams.get("db") || "";
        return db ? `_${db}` : "";
      } catch {
        return "";
      }
    })();
    try {
      if (window.localStorage) {
        if (targetMode === "gallery") {
          localStorage.setItem(
            `kbGalleryCurrentNode${currentDbSuffix}`,
            nodeId,
          );
          window.kbGalleryForceFirst = false;
        } else {
          localStorage.removeItem(`kbShortsRandomCache${currentDbSuffix}`);
          window.kbShortsNodes = [];
          window.kbShortsPendingScrollIndex = null;
          window.kbShortsPendingSidebarNodeId = null;
          window.kbShortsSidebarHydratedId = null;
          window.kbShortsPendingAnchorKey = "";
          localStorage.setItem(`kbShortsCurrentNode${currentDbSuffix}`, nodeId);
          window.kbShortsForceFirst = false;
        }
      }
    } catch {}
    if (typeof setViewMode === "function") {
      setViewMode(targetMode, { targetNodeId: nodeId });
    }
  }

  function renderTableList() {
    if (!tblNodes) return;

    const tbody = tblNodes.querySelector("tbody");
    if (!tbody) return;

    const rawList = Array.isArray(window.kbTableNodes)
      ? window.kbTableNodes
      : [];

    const keyword =
      typeof tblSearch !== "undefined" && tblSearch
        ? (tblSearch.value || "").trim().toLowerCase()
        : "";

    const filteredList = rawList.filter((n) => {
      if (!n || typeof n !== "object") return false;

      if (keyword) {
        const text = [
          n.label_zh,
          n.label,
          n.name,
          n.id,
          n.classLabel,
          n.type,
          n.description,
          n.desc_zh,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!text.includes(keyword)) return false;
      }

      return true;
    });

    const frag = document.createDocumentFragment();

    filteredList.forEach((n) => {
      const tr = document.createElement("tr");
      tr.tabIndex = -1;
      tr.setAttribute("data-id", n._id || n.id || "");

      const desc = (n.desc_zh || n.description || "").trim();
      if (desc) tr.setAttribute("data-desc", desc);

      // 复选框列
      const tdChk = document.createElement("td");
      tdChk.style.textAlign = "center";
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.className = "row-checkbox";
      chk.style.cursor = "pointer";
      chk.setAttribute("data-id", n._id || n.id || "");
      chk.addEventListener("click", (e) => {
        e.stopPropagation();
        const rid = chk.getAttribute("data-id") || "";
        if (!rid) return;
        if (chk.checked) {
          if (!window.kbSelectedRowIds) window.kbSelectedRowIds = new Set();
          window.kbSelectedRowIds.add(rid);
          window.kbLastAnchorRowId = rid;
        } else {
          if (window.kbSelectedRowIds) window.kbSelectedRowIds.delete(rid);
        }
        updateSelectedRowStyles();
        syncCheckboxStates();
        ensureTableSelectedButtonsState();
      });
      tdChk.appendChild(chk);
      tr.appendChild(tdChk);

      const tdName = document.createElement("td");
      const nameWrapper = document.createElement("div");
      nameWrapper.style.display = "inline-flex";
      nameWrapper.style.alignItems = "center";
      nameWrapper.style.gap = "6px";

      const nameLink = document.createElement("a");
      nameLink.textContent = n.label_zh || n.label || "";
      nameLink.style.color = "var(--link)";
      nameLink.style.textDecoration = "none";
      nameLink.addEventListener("mouseenter", () => {
        nameLink.style.textDecoration = "underline";
      });
      nameLink.addEventListener("mouseleave", () => {
        nameLink.style.textDecoration = "none";
      });

      try {
        const id = n._id || n.id || "";
        const label = n.label_zh || n.label || "";
        const params = new URLSearchParams();
        if (id) params.set("id", id);
        else if (label) params.set("label", label);
        nameLink.href =
          "/kb/detail" + (params.toString() ? "?" + params.toString() : "");
        nameLink.rel = "noreferrer noopener";
      } catch {}

      nameLink.addEventListener("click", (e) => {
        try {
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          const rid = tr.getAttribute("data-id") || n._id || n.id || "";
          if (!rid) return;
          setTableSelection("", false);
          if (typeof setViewMode === "function") {
            setViewMode("detail", { targetNodeId: rid });
          }
        } catch {}
      });

      nameWrapper.appendChild(nameLink);

      const hasImage = Boolean(
        n.image || n.avatar || n.icon || n.logo || n.img,
      );
      const hasVideo = Boolean(n.video);
      if (hasImage || hasVideo) {
        const mediaContainer = document.createElement("span");
        mediaContainer.style.display = "inline-flex";
        mediaContainer.style.alignItems = "center";
        mediaContainer.style.gap = "4px";
        mediaContainer.style.marginLeft = "4px";

        if (hasImage) {
          const imgTag = document.createElement("button");
          imgTag.type = "button";
          imgTag.className = "node-media-tag";
          imgTag.title = "包含图片";
          imgTag.innerHTML = '<i class="fa-solid fa-image"></i>';
          imgTag.title = "打开图库";
          imgTag.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openMediaViewForNode("gallery", n);
          });
          mediaContainer.appendChild(imgTag);
        }
        if (hasVideo) {
          const vidTag = document.createElement("button");
          vidTag.type = "button";
          vidTag.className = "node-media-tag";
          vidTag.title = "包含视频";
          vidTag.innerHTML = '<i class="fa-solid fa-video"></i>';
          vidTag.title = "打开短视频";
          vidTag.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openMediaViewForNode("shorts", n);
          });
          mediaContainer.appendChild(vidTag);
        }

        nameWrapper.appendChild(mediaContainer);
      }

      if (n.link) {
        try {
          const externalLink = document.createElement("a");
          externalLink.href = n.link;
          externalLink.target = "_blank";
          externalLink.rel = "noreferrer noopener";
          externalLink.title = "外部链接";
          externalLink.style.display = "inline-flex";
          externalLink.style.alignItems = "center";
          externalLink.style.justifyContent = "center";
          externalLink.style.color = "var(--link)";
          externalLink.style.textDecoration = "none";
          externalLink.style.fontSize = "0.9rem";
          externalLink.style.marginLeft = "4px";
          externalLink.innerHTML = '<i class="fa-solid fa-link"></i>';
          externalLink.addEventListener("click", (e) => {
            e.stopPropagation();
          });
          nameWrapper.appendChild(externalLink);
        } catch {}
      }

      tdName.appendChild(nameWrapper);
      tr.appendChild(tdName);


      tr.addEventListener("click", (e) => {
        const target = e.target;
        if (
          target &&
          (target.closest("button") ||
            (target.closest("a") && target.closest("a") !== nameLink))
        ) {
          return;
        }
        const rid = tr.getAttribute("data-id") || "";
        if (!rid) return;
        if (e.shiftKey && window.kbLastAnchorRowId) {
          rangeSelectTo(rid);
        } else if (e.ctrlKey || e.metaKey) {
          toggleCtrlSelection(rid);
        } else {
          const alreadySelected =
            (window.kbSelectedRowIds &&
              window.kbSelectedRowIds.size === 1 &&
              window.kbSelectedRowIds.has(rid)) ||
            (!window.kbSelectedRowIds && window.kbSelectedRowId === rid);
          if (alreadySelected) {
            setTableSelection("", true);
          } else {
            setTableSelection(rid, true);
          }
        }
        focusRowElement(tr);
      });

      tr.addEventListener("dblclick", async () => {
        const rid = tr.getAttribute("data-id") || "";
        if (!rid) return;
        setTableSelection(rid);
        if (typeof setViewMode === "function") {
          setViewMode("vis", { targetNodeId: rid });
        }
        try {
          if (!window.kbCy && typeof loadGraph === "function")
            await loadGraph();
          if (typeof focusNode === "function") focusNode(rid);
        } catch {}
      });

      tr.addEventListener("mouseenter", (e) => {
        const d = tr.getAttribute("data-desc") || "";
        if (!d) return;
        let tip = document.querySelector(".kb-tooltip");
        if (!tip) {
          tip = document.createElement("div");
          tip.className = "kb-tooltip";
          document.body.appendChild(tip);
        }
        tip.textContent = d.length > 180 ? d.slice(0, 180) + "…" : d;
        tip.style.display = "block";
        positionTooltip(e, tip);
      });

      tr.addEventListener("mousemove", (e) => {
        const tip = document.querySelector(".kb-tooltip");
        if (tip && tip.style.display === "block") positionTooltip(e, tip);
      });

      tr.addEventListener("mouseleave", () => {
        const tip = document.querySelector(".kb-tooltip");
        if (tip) tip.style.display = "none";
      });

      frag.appendChild(tr);
    });

    tbody.innerHTML = "";
    tbody.appendChild(frag);

    try {
      const rows = Array.from(tblNodes.querySelectorAll("tbody tr"));
      const has = rows.some(
        (tr) => (tr.getAttribute("data-id") || "") === window.kbSelectedRowId,
      );
      const hasExistingSelection =
        (window.kbSelectedRowId && window.kbSelectedRowId.trim()) ||
        (window.kbSelectedRowIds && window.kbSelectedRowIds.size > 0);
      const isTableViewActive = (window.kbViewMode || "table") === "table";
      if (!has) {
        if (!hasExistingSelection) {
          if (!rows.length) {
            setTableSelection("");
          }
        }
      } else {
        updateSelectedRowStyles();
        syncCheckboxStates();
      }
    } catch {}

    syncCheckboxStates();
    ensureTableSelectedButtonsState();
  }

  async function renderShortsList() {
    const shortsPanel = document.getElementById("shortsPanel");
    const shortsList = document.getElementById("shortsList");
    const shortsCount = document.getElementById("shortsCount");
    if (!shortsPanel || !shortsList) return;

    if (window.kbShortsObserver) {
      try {
        window.kbShortsObserver.disconnect();
      } catch {}
      window.kbShortsObserver = null;
    }

    let rawList = Array.isArray(window.kbShortsNodes)
      ? window.kbShortsNodes
      : [];
    const shortsPageSize = 12;
    const currentDbSuffix = (() => {
      try {
        const db =
          typeof window.getCurrentDbParam === "function"
            ? window.getCurrentDbParam()
            : new URL(window.location.href).searchParams.get("db") || "";
        return db ? `_${db}` : "";
      } catch {
        return "";
      }
    })();
    const shortsCacheKey = `kbShortsRandomCache${currentDbSuffix}`;
    let shortsTotalNodes = Number(window.kbTableTotalNodes || 0) || 0;
    let shortsLoadingMore = false;

    const saveShortsCache = (items) => {
      try {
        if (window.localStorage) {
          localStorage.setItem(shortsCacheKey, JSON.stringify(items));
        }
      } catch (err) {
        console.warn("save shorts cache failed", err);
      }
    };

    const loadShortsCache = () => {
      if (!window.localStorage) return [];
      try {
        const cached = localStorage.getItem(shortsCacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (err) {
        console.warn("load shorts cache failed", err);
      }
      return [];
    };

    const fetchShortsRandomBatch = async (excludeIds = []) => {
      const url = appendCurrentDbToUrl(
        new URL("/api/kb/shorts_random", window.location.origin),
      );
      url.searchParams.set("limit", String(shortsPageSize));
      if (excludeIds && excludeIds.length) {
        url.searchParams.set("exclude_ids", excludeIds.join(","));
      }
      const currentDbSuffix = (() => {
        try {
          const db =
            typeof window.getCurrentDbParam === "function"
              ? window.getCurrentDbParam()
              : new URL(window.location.href).searchParams.get("db") || "";
          return db ? `_${db}` : "";
        } catch {
          return "";
        }
      })();
      const currentId =
        String(window.kbShortsPendingSidebarNodeId || "").trim() ||
        String(window.kbSelectedRowId || "").trim() ||
        String(
          localStorage.getItem(`kbShortsCurrentNode${currentDbSuffix}`) || "",
        ).trim();
      if (currentId) {
        url.searchParams.set("current_id", currentId);
      }
      const recentItems = rawList.slice(-18);
      const recentIds = recentItems
        .map((item) => String(item.id || "").trim())
        .filter(Boolean);
      if (recentIds.length) {
        url.searchParams.set("recent_ids", recentIds.join(","));
      }
      const recentClasses = recentItems
        .map((item) => String(item.classLabel || "").trim())
        .filter(Boolean)
        .slice(-12);
      if (recentClasses.length) {
        url.searchParams.set("recent_classes", recentClasses.join(","));
      }
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      shortsTotalNodes = Number(data.total || shortsTotalNodes || 0);
      return Array.isArray(data.nodes) ? data.nodes : [];
    };

    const normalizeShortsNodes = (nodes) =>
      nodes.map((item) => ({
        label_zh: item.label || "",
        id: item.id || "",
        link: item.link || "",
        classLabel: item.classLabel || item.type || "",
        video: item.video || "",
        image: item.image || item.avatar || "",
      }));

    const appendShortsNodes = async (nodes) => {
      const tableList = normalizeShortsNodes(nodes);
      const existingIds = new Set(rawList.map((item) => item.id));
      const newItems = tableList.filter(
        (item) => item.id && !existingIds.has(item.id),
      );
      if (!newItems.length) return false;
      rawList = rawList.concat(newItems);
      window.kbShortsNodes = rawList;
      saveShortsCache(rawList);
      await renderShortsList();
      return true;
    };

    const loadMoreShortsPage = async (retryCount = 0) => {
      if (shortsLoadingMore) return;
      if (shortsTotalNodes && rawList.length >= shortsTotalNodes) {
        setShortsStatus("");
        return;
      }
      shortsLoadingMore = true;
      try {
        const excludeIds = rawList.map((item) => item.id).filter((id) => id);
        const nodes = await fetchShortsRandomBatch(excludeIds);
        const appended = await appendShortsNodes(nodes);
        if (!appended && retryCount < 2 && rawList.length < shortsTotalNodes) {
          return await loadMoreShortsPage(retryCount + 1);
        }
      } catch (err) {
        console.warn("loadMoreShortsPage failed", err);
      } finally {
        shortsLoadingMore = false;
        if (!shortsLoadingMore) setShortsStatus("");
      }
    };

    const shouldLoadMoreShorts = (index) => {
      return (
        index >= videoItems.length - 2 &&
        !shortsLoadingMore &&
        (!shortsTotalNodes || rawList.length < shortsTotalNodes)
      );
    };

    const cachedShorts = loadShortsCache();
    if (cachedShorts.length) {
      rawList = cachedShorts;
      window.kbShortsNodes = rawList;
    } else if (
      Array.isArray(window.kbTableNodes) &&
      window.kbTableNodes.length
    ) {
      rawList = window.kbTableNodes
        .filter((item) => item.video && item.video.trim())
        .map((item) => ({
          label_zh: item.label || "",
          id: item.id || "",
          link: item.link || "",
          classLabel: item.classLabel || item.type || "",
          video: item.video || "",
          image: item.image || item.avatar || "",
        }));
      window.kbShortsNodes = rawList;
      saveShortsCache(rawList);
    }

    if (!rawList.length) {
      try {
        const nodes = await fetchShortsRandomBatch();
        rawList = normalizeShortsNodes(nodes);
        window.kbShortsNodes = rawList;
        saveShortsCache(rawList);
      } catch (err) {
        console.warn("load initial shorts batch failed", err);
        if (!rawList.length && typeof loadTablePage === "function") {
          try {
            await loadTablePage();
            rawList = Array.isArray(window.kbTableNodes)
              ? window.kbTableNodes
                  .filter((item) => item.video && item.video.trim())
                  .map((item) => ({
                    label_zh: item.label || "",
                    id: item.id || "",
                    link: item.link || "",
                    classLabel: item.classLabel || item.type || "",
                    video: item.video || "",
                    image: item.image || item.avatar || "",
                  }))
              : [];
            window.kbShortsNodes = rawList;
          } catch {}
        }
      }
    }

    const videoItems = rawList
      .map((item) => ({
        id: item._id || item.id || "",
        label: item.label_zh || item.label || "",
        classLabel: item.classLabel || item.type || "",
        video: item.video || "",
        image: item.image || "",
      }))
      .filter((item) => item.video && item.video.trim());

    const count = videoItems.length;
    if (shortsCount) {
      shortsCount.textContent = count
        ? `共 ${count} 个短视频`
        : "暂无可播放视频";
    }
    const shortsControls = document.getElementById("shortsControls");
    if (shortsControls) {
      shortsControls.style.display = count ? "inline-flex" : "none";
    }

    const cacheShortsVideos = async () => {
      if (!count || !("caches" in window)) return;
      try {
        const cache = await caches.open("kb-shorts-video-cache-v1");
        for (const item of videoItems) {
          let url;
          try {
            url = new URL(item.video, window.location.origin).toString();
          } catch {
            url = item.video;
          }
          if (!url) continue;
          const cachedResponse = await cache.match(url);
          if (cachedResponse) continue;
          try {
            const response = await fetch(url, {
              method: "GET",
              mode: "cors",
              credentials: "same-origin",
            });
            if (response.ok) {
              await cache.put(url, response.clone());
            }
          } catch (err) {
            console.warn("shorts cache fetch failed", url, err);
          }
        }
      } catch (err) {
        console.warn("shorts cache init failed", err);
      }
    };

    if (count) {
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(cacheShortsVideos);
      } else {
        setTimeout(cacheShortsVideos, 500);
      }
    }

    shortsList.innerHTML = "";
    if (!count) {
      const empty = document.createElement("div");
      empty.className = "shorts-empty";
      empty.textContent = "当前节点没有视频，先在节点详情中上传视频后再查看。";
      shortsList.appendChild(empty);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const videoEl = entry.target;
          if (!(videoEl instanceof HTMLVideoElement)) return;
          const index = videoToIndexMap.get(videoEl);
          if (entry.intersectionRatio >= 0.55) {
            videoEl.play().catch(() => {});
            if (typeof index === "number") {
              setActiveShortsIndex(index);
            }
          } else {
            videoEl.pause();
          }
        });
      },
      { threshold: [0.55] },
    );
    window.kbShortsObserver = observer;

    const cardElements = [];
    const videoElements = [];
    const videoToIndexMap = new Map();
    let activeShortsIndex = -1;

    const setActiveShortsIndex = (index) => {
      if (index < 0 || index >= cardCount) return;
      if (index === activeShortsIndex) return;
      activeShortsIndex = index;
      updateNavButtons(index);
      const targetId = videoItems[index].id;
      if (targetId) {
        try {
          const currentDbSuffix = (() => {
            try {
              const db =
                typeof window.getCurrentDbParam === "function"
                  ? window.getCurrentDbParam()
                  : new URL(window.location.href).searchParams.get("db") || "";
              return db ? `_${db}` : "";
            } catch {
              return "";
            }
          })();
          if (window.localStorage) {
            localStorage.setItem(
              `kbShortsCurrentNode${currentDbSuffix}`,
              targetId,
            );
          }
        } catch (err) {
          console.warn("persist shorts current node failed", err);
        }
        if (
          window.kbViewMode === "shorts" &&
          typeof syncHashForView === "function"
        ) {
          syncHashForView("shorts", {
            replace: true,
            nodeId: targetId,
            includeNode: true,
          });
        }
        if (window.kbSelectedRowId !== targetId) {
          try {
            setTableSelection(targetId, true);
          } catch (err) {
            console.warn("shorts auto-select failed", err);
          }
        }
      }
    };

    videoItems.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "shorts-card";

      const videoEl = document.createElement("video");
      videoEl.muted = true;
      videoEl.loop = true;
      videoEl.playsInline = true;
      videoEl.setAttribute("playsinline", "");
      videoEl.setAttribute("webkit-playsinline", "");
      videoEl.setAttribute("controlsList", "nodownload");
      videoEl.style.cursor = "pointer";
      videoEl.preload = "metadata";
      const resolvedUrl = (function () {
        try {
          return new URL(item.video, window.location.origin).toString();
        } catch {
          return item.video;
        }
      })();
      const src = document.createElement("source");
      src.src = resolvedUrl;
      const extMatch = resolvedUrl.split("?")[0].match(/\.([a-z0-9]+)$/i);
      if (extMatch) {
        src.type = `video/${extMatch[1].toLowerCase()}`;
      }
      videoEl.appendChild(src);
      if (item.image) {
        try {
          const resolvedImage = new URL(
            item.image,
            window.location.origin,
          ).toString();
          videoEl.poster = resolvedImage;
        } catch {
          videoEl.poster = item.image;
        }
      }
      videoEl.addEventListener("click", (event) => {
        event.preventDefault();
        if (videoEl.paused) {
          videoEl.play().catch(() => {});
        } else {
          videoEl.pause();
        }
      });

      const updateCurrentTimeProgress = () => {
        if (videoToIndexMap.get(videoEl) === activeShortsIndex) {
          updateShortsProgress(activeShortsIndex, videoEl);
        }
      };
      videoEl.addEventListener("timeupdate", updateCurrentTimeProgress);
      videoEl.addEventListener("loadedmetadata", updateCurrentTimeProgress);
      videoEl.addEventListener("ended", () => {
        updateCurrentTimeProgress();
      });

      observer.observe(videoEl);
      videoToIndexMap.set(videoEl, idx);
      card.appendChild(videoEl);
      videoElements.push(videoEl);
      cardElements.push(card);

      const meta = document.createElement("div");
      meta.className = "shorts-card-meta";

      const title = document.createElement("div");
      title.className = "shorts-card-title";
      title.textContent = item.label || item.id || "未命名节点";
      meta.appendChild(title);

      const label = document.createElement("div");
      label.className = "shorts-card-label";
      label.textContent = item.classLabel
        ? `分类：${item.classLabel}`
        : "无分类";
      meta.appendChild(label);

      const actions = document.createElement("div");
      actions.className = "shorts-card-actions";
      const detailBtn = document.createElement("button");
      detailBtn.type = "button";
      detailBtn.textContent = "查看节点";
      detailBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!item.id) return;
        navigateToDetailPage(item.id);
      });
      actions.appendChild(detailBtn);
      meta.appendChild(actions);
      card.appendChild(meta);
      shortsList.appendChild(card);
    });

    let wheelLock = false;
    let shortsScrollEndTimer = null;
    const scrollDuration = 400;
    const cardCount = cardElements.length;

    const getCurrentCardIndex = () => {
      const center = shortsList.scrollTop + shortsList.clientHeight / 2;
      let bestIndex = 0;
      let bestDistance = Infinity;
      cardElements.forEach((card, idx) => {
        const top = card.offsetTop;
        const distance = Math.abs(top - center + card.clientHeight / 2);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = idx;
        }
      });
      return bestIndex;
    };

    const scrollToCard = (index) => {
      if (index < 0 || index >= cardCount) return;
      wheelLock = true;
      const targetCard = cardElements[index];
      if (shortsList && targetCard) {
        shortsList.scrollTo({
          top: targetCard.offsetTop,
          behavior: "smooth",
        });
      }
      setActiveShortsIndex(index);
      setTimeout(() => {
        wheelLock = false;
      }, scrollDuration);
    };

    const shortsPrevBtn = document.getElementById("shortsPrevBtn");
    const shortsNextBtn = document.getElementById("shortsNextBtn");
    const shortsStatus = document.getElementById("shortsStatus");

    const setShortsStatus = (message) => {
      if (!shortsStatus) return;
      const statusText = shortsStatus.querySelector(".shorts-status-text");
      const statusBar = shortsStatus.querySelector(".shorts-status-bar");
      if (message) {
        if (statusText) statusText.textContent = message;
        shortsStatus.classList.add("active");
      } else {
        shortsStatus.classList.remove("active");
      }
    };

    const updateNavButtons = (index) => {
      if (!shortsPrevBtn || !shortsNextBtn) return;
      const canPrev = index > 0;
      const canNext =
        index < cardCount - 1 ||
        shortsTotalNodes === 0 ||
        rawList.length < shortsTotalNodes;
      shortsPrevBtn.disabled = !canPrev;
      shortsNextBtn.disabled = !canNext;
      shortsPrevBtn.classList.toggle("hidden", !canPrev);
      shortsNextBtn.classList.toggle("hidden", !canNext);
    };

    const maybeLoadMoreShorts = (index) => {
      if (shortsLoadingMore) return;
      if (!shouldLoadMoreShorts(index) && !isListScrolledToBottom()) return;
      window.kbShortsPendingScrollIndex = index + 1;
      setShortsStatus("正在加载新视频...");
      loadMoreShortsPage().catch(() => {
        setShortsStatus("");
      });
    };

    let isInitializingShorts = true;
    const isListScrolledToBottom = () => {
      if (!shortsList) return false;
      return (
        shortsList.scrollTop + shortsList.clientHeight >=
        shortsList.scrollHeight - 12
      );
    };

    const handleShortsScroll = () => {
      if (isInitializingShorts) return;
      const newIndex = getCurrentCardIndex();
      updateNavButtons(newIndex);
      setActiveShortsIndex(newIndex);
      if (shortsScrollEndTimer) {
        clearTimeout(shortsScrollEndTimer);
      }
      shortsScrollEndTimer = setTimeout(() => {
        const targetCard = cardElements[newIndex];
        if (targetCard && shortsList) {
          const targetTop = targetCard.offsetTop;
          if (Math.abs(shortsList.scrollTop - targetTop) > 8) {
            scrollToCard(newIndex);
            return;
          }
        }
        maybeLoadMoreShorts(newIndex);
      }, 120);
    };

    const handleShortsControlClick = async (event) => {
      const target = event.target.closest(".shorts-arrow-btn");
      if (!target) return;
      const isPrev = target.id === "shortsPrevBtn";
      const isNext = target.id === "shortsNextBtn";
      if (!isPrev && !isNext) return;
      event.preventDefault();
      const currentIndex = getCurrentCardIndex();
      if (isPrev) {
        const prevIndex = Math.max(currentIndex - 1, 0);
        if (prevIndex !== currentIndex) {
          scrollToCard(prevIndex);
        }
        return;
      }
      if (isNext) {
        if (currentIndex >= cardCount - 1) {
          if (shouldLoadMoreShorts(currentIndex) || isListScrolledToBottom()) {
            window.kbShortsPendingScrollIndex = currentIndex + 1;
            await loadMoreShortsPage();
          }
          return;
        }
        const nextIndex = currentIndex + 1;
        if (nextIndex !== currentIndex) {
          scrollToCard(nextIndex);
        }
      }
    };

    if (shortsPanel && !shortsPanel.dataset.shortsControlsBound) {
      shortsPanel.dataset.shortsControlsBound = "1";
      shortsPanel.addEventListener("click", handleShortsControlClick);
    }

    if (!shortsList.dataset.shortsScrollBound) {
      shortsList.dataset.shortsScrollBound = "1";
      shortsList.addEventListener("scroll", handleShortsScroll, {
        passive: true,
      });
    }

    if (!shortsList.dataset.shortsWheelBound) {
      shortsList.dataset.shortsWheelBound = "1";
      shortsList.addEventListener(
        "wheel",
        async (event) => {
          if (wheelLock) {
            event.preventDefault();
            return;
          }
          if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
          const currentIndex = getCurrentCardIndex();
          if (event.deltaY > 0) {
            if (currentIndex >= cardCount - 1) {
              if (
                shouldLoadMoreShorts(currentIndex) ||
                isListScrolledToBottom()
              ) {
                event.preventDefault();
                window.kbShortsPendingScrollIndex = currentIndex + 1;
                await loadMoreShortsPage();
              }
              return;
            }
            const nextIndex = currentIndex + 1;
            if (nextIndex !== currentIndex) {
              event.preventDefault();
              scrollToCard(nextIndex);
            }
            if (
              currentIndex >= cardCount - 2 &&
              !shortsLoadingMore &&
              (!shortsTotalNodes || rawList.length < shortsTotalNodes)
            ) {
              window.kbShortsPendingScrollIndex = currentIndex + 1;
              loadMoreShortsPage().catch(() => {});
            }
          } else {
            const prevIndex = Math.max(currentIndex - 1, 0);
            if (prevIndex !== currentIndex) {
              event.preventDefault();
              scrollToCard(prevIndex);
            }
          }
        },
        { passive: false },
      );
    }

    let initialNodeId = window.kbSelectedRowId || "";
    try {
      if (!initialNodeId && window.localStorage) {
        const currentDbSuffix = (() => {
          try {
            const db =
              typeof window.getCurrentDbParam === "function"
                ? window.getCurrentDbParam()
                : new URL(window.location.href).searchParams.get("db") || "";
            return db ? `_${db}` : "";
          } catch {
            return "";
          }
        })();
        const cachedShortsNode = localStorage.getItem(
          `kbShortsCurrentNode${currentDbSuffix}`,
        );
        if (cachedShortsNode) {
          initialNodeId = cachedShortsNode;
        }
      }
    } catch (err) {
      console.warn("load persisted shorts node failed", err);
    }

    const normalizeNodeId = (value) => {
      if (!value) return "";
      return String(value)
        .trim()
        .replace(/^entity\//, "");
    };
    const initialNormalizedId = normalizeNodeId(initialNodeId);
    let initialShortsIndex = videoItems.findIndex((item) => {
      const itemId = normalizeNodeId(item.id);
      return (
        itemId &&
        (itemId === initialNormalizedId ||
          initialNormalizedId.endsWith(itemId) ||
          itemId.endsWith(initialNormalizedId))
      );
    });
    if (initialShortsIndex < 0) initialShortsIndex = 0;

    const pendingIndex = Number(window.kbShortsPendingScrollIndex || -1);
    if (pendingIndex >= 0 && pendingIndex < videoItems.length) {
      initialShortsIndex = pendingIndex;
    }
    if (window.kbShortsPendingScrollIndex) {
      window.kbShortsPendingScrollIndex = null;
    }

    if (window.kbShortsForceFirst) {
      initialShortsIndex = 0;
      window.kbShortsForceFirst = false;
    }

    const originalScrollBehavior = shortsList.style.scrollBehavior;
    let listWasHidden = false;
    if (shortsList) {
      shortsList.style.visibility = "hidden";
      shortsList.style.scrollBehavior = "auto";
      listWasHidden = true;
    }

    if (initialShortsIndex > 0) {
      setActiveShortsIndex(initialShortsIndex);
      if (shortsList && cardElements[initialShortsIndex]) {
        shortsList.scrollTop = cardElements[initialShortsIndex].offsetTop;
      }
    } else {
      updateNavButtons(0);
      setActiveShortsIndex(0);
    }

    if (shortsList && cardElements[initialShortsIndex]) {
      shortsList.scrollTop = cardElements[initialShortsIndex].offsetTop;
    }
    if (listWasHidden && shortsList) {
      shortsList.style.visibility = "";
      shortsList.style.scrollBehavior = originalScrollBehavior;
    }
    isInitializingShorts = false;
    handleShortsScroll();
  }

  renderShortsList = async function () {
    const shortsPanel = document.getElementById("shortsPanel");
    const shortsList = document.getElementById("shortsList");
    const shortsCount = document.getElementById("shortsCount");
    const shortsControls = document.getElementById("shortsControls");
    const shortsPrevBtn = document.getElementById("shortsPrevBtn");
    const shortsNextBtn = document.getElementById("shortsNextBtn");
    const shortsStatus = document.getElementById("shortsStatus");
    const shortsProgressLabel = document.getElementById("shortsProgressLabel");
    const shortsProgressBar = document.getElementById("shortsProgressBar");
    if (!shortsPanel || !shortsList) return;

    if (window.kbShortsObserver) {
      try {
        window.kbShortsObserver.disconnect();
      } catch {}
      window.kbShortsObserver = null;
    }

    if (window.kbShortsHandlers?.scroll) {
      shortsList.removeEventListener("scroll", window.kbShortsHandlers.scroll);
    }
    if (window.kbShortsHandlers?.wheel) {
      shortsList.removeEventListener("wheel", window.kbShortsHandlers.wheel);
    }
    if (window.kbShortsHandlers?.click) {
      shortsPanel.removeEventListener("click", window.kbShortsHandlers.click);
    }
    if (window.kbShortsHandlers?.keydown) {
      document.removeEventListener("keydown", window.kbShortsHandlers.keydown);
    }
    if (window.kbShortsSidebarSyncTimer) {
      try {
        clearTimeout(window.kbShortsSidebarSyncTimer);
      } catch {}
      window.kbShortsSidebarSyncTimer = null;
    }

    let rawList = Array.isArray(window.kbShortsNodes)
      ? window.kbShortsNodes
      : [];
    const shortsPageSize = 12;
    const currentDbSuffix = (() => {
      try {
        const db =
          typeof window.getCurrentDbParam === "function"
            ? window.getCurrentDbParam()
            : new URL(window.location.href).searchParams.get("db") || "";
        return db ? `_${db}` : "";
      } catch {
        return "";
      }
    })();
    const shortsCacheKey = `kbShortsRandomCache${currentDbSuffix}`;
    let shortsTotalNodes = Number(window.kbTableTotalNodes || 0) || 0;
    let shortsLoadingMore = false;
    window.kbShortsMuted = window.kbShortsMuted !== false;

    const setShortsStatus = (message) => {
      if (!shortsStatus) return;
      const statusText = shortsStatus.querySelector(".shorts-status-text");
      if (message) {
        if (statusText) statusText.textContent = message;
        shortsStatus.classList.add("active");
      } else {
        shortsStatus.classList.remove("active");
      }
    };

    const saveShortsCache = (items) => {
      try {
        if (window.localStorage) {
          localStorage.setItem(shortsCacheKey, JSON.stringify(items));
        }
      } catch (err) {
        console.warn("save shorts cache failed", err);
      }
    };

    const loadShortsCache = () => {
      if (!window.localStorage) return [];
      try {
        const cached = localStorage.getItem(shortsCacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (err) {
        console.warn("load shorts cache failed", err);
      }
      return [];
    };

    const fetchShortsRandomBatch = async (excludeIds = []) => {
      const url = appendCurrentDbToUrl(
        new URL("/api/kb/shorts_random", window.location.origin),
      );
      url.searchParams.set("limit", String(shortsPageSize));
      if (excludeIds && excludeIds.length) {
        url.searchParams.set("exclude_ids", excludeIds.join(","));
      }
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      shortsTotalNodes = Number(data.total || shortsTotalNodes || 0);
      return Array.isArray(data.nodes) ? data.nodes : [];
    };

    const normalizeShortsNodeKey = (item) => {
      const id = String(item.id || item._id || "").trim();
      if (id) return `id:${id}`;
      const video = String(item.video || "").trim();
      if (video) return `video:${video}`;
      return "";
    };

    const dedupeShortsNodes = (items) => {
      const seen = new Set();
      return (Array.isArray(items) ? items : []).filter((item) => {
        const key = normalizeShortsNodeKey(item);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const normalizeShortsNodes = (nodes) =>
      dedupeShortsNodes(
        nodes.map((item) => ({
          label_zh: item.label_zh || item.label || item.name || "",
          id: item.id || item._id || "",
          _id: item._id || item.id || "",
          link: item.link || "",
          classLabel: item.classLabel || item.type || item.class || "",
          video: item.video || "",
          image: item.image || item.avatar || "",
        })),
      );

    const appendShortsNodes = async (nodes, options = {}) => {
      const allowDuplicates = options.allowDuplicates === true;
      const tableList = normalizeShortsNodes(nodes);
      const existingKeys = new Set(
        rawList.map((item) => normalizeShortsNodeKey(item)).filter(Boolean),
      );
      const newItems = tableList.filter((item) => {
        const key = normalizeShortsNodeKey(item);
        if (!key || existingKeys.has(key)) return false;
        return true;
      });
      if (!newItems.length) return false;
      window.kbShortsPendingAnchorKey =
        newItems[0]?.__shortsReplayKey || newItems[0]?.id || "";
      window.kbShortsPendingScrollIndex = rawList.length;
      const startIndex = rawList.length;
      rawList = rawList.concat(newItems);
      rawList = dedupeShortsNodes(rawList);
      window.kbShortsNodes = rawList;
      saveShortsCache(rawList);
      newItems.forEach((item, idx) => {
        const nextIndex = startIndex + idx;
        const addedItem = {
          id: item._id || item.id || "",
          label: item.label || "",
          label_zh: item.label_zh || item.label || "",
          classLabel: item.classLabel || item.type || "",
          video: item.video || "",
          image: item.image || "",
          replayKey: item.__shortsReplayKey || "",
        };
        videoItems.push(addedItem);
        createShortsCard(addedItem, nextIndex);
      });
      cardCount = videoItems.length;
      if (shortsCount) {
        shortsCount.textContent = cardCount
          ? `共 ${cardCount} 条短视频`
          : "暂无可播放视频";
      }
      if (shortsControls) {
        shortsControls.style.display = cardCount ? "inline-flex" : "none";
      }
      updateNavButtons(activeShortsIndex);
      return true;
    };

    const loadMoreShortsPage = async (retryCount = 0) => {
      if (shortsLoadingMore) return;
      let appended = false;
      shortsLoadingMore = true;
      setShortsStatus("正在加载更多视频...");
      try {
        const excludeIds = rawList.map((item) => item.id).filter((id) => id);
        const canUseFreshOnly =
          !shortsTotalNodes || excludeIds.length < shortsTotalNodes;
        const nodes = await fetchShortsRandomBatch(
          canUseFreshOnly ? excludeIds : [],
        );
        appended = await appendShortsNodes(nodes, {
          allowDuplicates: !canUseFreshOnly,
        });
        if (!appended && retryCount < 2) {
          if (canUseFreshOnly) {
            const replayNodes = await fetchShortsRandomBatch([]);
            const replayAppended = await appendShortsNodes(replayNodes, {
              allowDuplicates: true,
            });
            if (replayAppended) {
              appended = true;
              return;
            }
          }
          return await loadMoreShortsPage(retryCount + 1);
        }
      } catch (err) {
        console.warn("loadMoreShortsPage failed", err);
      } finally {
        shortsLoadingMore = false;
        setShortsStatus("");
      }
    };

    const cachedShorts = loadShortsCache();
    if (cachedShorts.length) {
      rawList = dedupeShortsNodes(cachedShorts);
      window.kbShortsNodes = rawList;
    } else if (
      Array.isArray(window.kbTableNodes) &&
      window.kbTableNodes.length
    ) {
      rawList = dedupeShortsNodes(
        window.kbTableNodes
          .filter((item) => item.video && item.video.trim())
          .map((item) => ({
            label_zh: item.label_zh || item.label || item.name || "",
            id: item.id || item._id || "",
            _id: item._id || item.id || "",
            link: item.link || "",
            classLabel: item.classLabel || item.type || item.class || "",
            video: item.video || "",
            image: item.image || item.avatar || "",
          })),
      );
      window.kbShortsNodes = rawList;
      saveShortsCache(rawList);
    }

    if (!rawList.length) {
      try {
        const nodes = await fetchShortsRandomBatch();
        rawList = normalizeShortsNodes(nodes);
        window.kbShortsNodes = rawList;
        saveShortsCache(rawList);
      } catch (err) {
        console.warn("load initial shorts batch failed", err);
        if (!rawList.length && typeof loadTablePage === "function") {
          try {
            await loadTablePage();
            rawList = Array.isArray(window.kbTableNodes)
              ? window.kbTableNodes
                  .filter((item) => item.video && item.video.trim())
                  .map((item) => ({
                    label_zh: item.label || "",
                    id: item.id || "",
                    link: item.link || "",
                    classLabel: item.classLabel || item.type || "",
                    video: item.video || "",
                    image: item.image || item.avatar || "",
                  }))
              : [];
            window.kbShortsNodes = rawList;
          } catch {}
        }
      }
    }

    const videoItems = rawList
      .map((item) => ({
        id: item._id || item.id || "",
        label: item.label_zh || item.label || "",
        classLabel: item.classLabel || item.type || "",
        video: item.video || "",
        image: item.image || "",
        replayKey: item.__shortsReplayKey || "",
      }))
      .filter((item) => item.video && item.video.trim());

    const count = videoItems.length;
    if (shortsCount) {
      shortsCount.textContent = count
        ? `共 ${count} 条短视频`
        : "暂无可播放视频";
    }
    if (shortsControls) {
      shortsControls.style.display = count ? "inline-flex" : "none";
    }

    const formatTime = (seconds) => {
      if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
      const sec = Math.floor(seconds % 60);
      const min = Math.floor(seconds / 60) % 60;
      const hrs = Math.floor(seconds / 3600);
      const paddedSec = String(sec).padStart(2, "0");
      const paddedMin = String(min).padStart(2, "0");
      if (hrs > 0) {
        return `${hrs}:${paddedMin}:${paddedSec}`;
      }
      return `${paddedMin}:${paddedSec}`;
    };

    const updateShortsProgress = (index, videoEl) => {
      if (shortsProgressLabel) {
        if (videoEl && videoEl.duration > 0) {
          shortsProgressLabel.textContent = `${formatTime(videoEl.currentTime)} / ${formatTime(videoEl.duration)}`;
        } else {
          shortsProgressLabel.textContent = "00:00 / 00:00";
        }
      }
      if (shortsProgressBar) {
        if (videoEl && videoEl.duration > 0) {
          const progress = (videoEl.currentTime / videoEl.duration) * 100;
          shortsProgressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        } else {
          shortsProgressBar.style.width = "0%";
        }
      }
    };

    const cacheShortsVideos = async () => {
      if (!count || !("caches" in window)) return;
      try {
        const cache = await caches.open("kb-shorts-video-cache-v1");
        for (const item of videoItems) {
          let url;
          try {
            url = new URL(item.video, window.location.origin).toString();
          } catch {
            url = item.video;
          }
          if (!url) continue;
          const cachedResponse = await cache.match(url);
          if (cachedResponse) continue;
          try {
            const response = await fetch(url, {
              method: "GET",
              mode: "cors",
              credentials: "same-origin",
            });
            if (response.ok) {
              await cache.put(url, response.clone());
            }
          } catch (err) {
            console.warn("shorts cache fetch failed", url, err);
          }
        }
      } catch (err) {
        console.warn("shorts cache init failed", err);
      }
    };

    if (count) {
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(cacheShortsVideos);
      } else {
        setTimeout(cacheShortsVideos, 500);
      }
    }

    shortsList.innerHTML = "";
    if (!count) {
      const empty = document.createElement("div");
      empty.className = "shorts-empty";
      empty.textContent =
        "当前还没有可播放的视频，先在节点详情里上传视频后再来看看。";
      shortsList.appendChild(empty);
      return;
    }

    const cardElements = [];
    const videoElements = [];
    const videoToIndexMap = new Map();
    let activeShortsIndex = -1;
    let wheelLock = false;
    let shortsScrollEndTimer = null;
    const scrollDuration = 360;
    let cardCount = videoItems.length;

    const createShortsCard = (item, idx) => {
      const card = document.createElement("div");
      card.className = "shorts-card is-paused is-portrait";
      card.dataset.index = String(idx);

      const stage = document.createElement("div");
      stage.className = "shorts-stage";

      const videoEl = document.createElement("video");
      videoEl.muted = window.kbShortsMuted !== false;
      videoEl.loop = true;
      videoEl.playsInline = true;
      videoEl.setAttribute("playsinline", "");
      videoEl.setAttribute("webkit-playsinline", "");
      videoEl.setAttribute("controlsList", "nodownload");
      videoEl.style.cursor = "pointer";
      videoEl.preload = "metadata";
      const resolvedUrl = (() => {
        try {
          return new URL(item.video, window.location.origin).toString();
        } catch {
          return item.video;
        }
      })();
      const src = document.createElement("source");
      src.src = resolvedUrl;
      const extMatch = resolvedUrl.split("?")[0].match(/\.([a-z0-9]+)$/i);
      if (extMatch) {
        src.type = `video/${extMatch[1].toLowerCase()}`;
      }
      videoEl.appendChild(src);
      if (item.image) {
        try {
          videoEl.poster = new URL(
            item.image,
            window.location.origin,
          ).toString();
        } catch {
          videoEl.poster = item.image;
        }
      }
      videoEl.addEventListener("click", (event) => {
        event.preventDefault();
        if (videoEl.paused) {
          videoEl.play().catch(() => {});
          card.classList.remove("is-paused");
        } else {
          videoEl.pause();
          card.classList.add("is-paused");
        }
      });
      videoEl.addEventListener("play", () => {
        card.classList.remove("is-paused");
      });
      videoEl.addEventListener("pause", () => {
        card.classList.add("is-paused");
      });
      videoEl.addEventListener("loadedmetadata", () => {
        try {
          const width = Number(videoEl.videoWidth || 0);
          const height = Number(videoEl.videoHeight || 0);
          if (!width || !height) return;
          const ratio = width / height;
          card.classList.remove("is-portrait", "is-landscape", "is-square");
          if (ratio >= 1.15) {
            card.classList.add("is-landscape");
          } else if (ratio >= 0.9) {
            card.classList.add("is-square");
          } else {
            card.classList.add("is-portrait");
          }
        } catch (err) {
          console.warn("shorts video metadata parse failed", err);
        }
      });

      const playIndicator = document.createElement("div");
      playIndicator.className = "shorts-video-play";
      playIndicator.innerHTML = '<i class="fa-solid fa-play"></i>';

      const muteBadge = document.createElement("div");
      muteBadge.className = "shorts-video-badge";
      muteBadge.innerHTML =
        '<i class="fa-solid fa-volume-xmark"></i><span>静音播放</span>';

      stage.appendChild(videoEl);
      stage.appendChild(playIndicator);
      stage.appendChild(muteBadge);
      card.appendChild(stage);

      const meta = document.createElement("div");
      meta.className = "shorts-card-meta";

      const metaMain = document.createElement("div");
      metaMain.className = "shorts-card-meta-main";

      const topLine = document.createElement("div");
      topLine.className = "shorts-card-meta-topline";
      const chip = document.createElement("span");
      chip.className = "shorts-card-chip";
      chip.textContent = item.classLabel || "未分类";
      topLine.appendChild(chip);
      metaMain.appendChild(topLine);

      const title = document.createElement("div");
      title.className = "shorts-card-title";
      title.textContent =
        item.label || item.label_zh || item.id || "未命名节点";
      metaMain.appendChild(title);

      const label = document.createElement("div");
      label.className = "shorts-card-label";
      label.textContent = item.id ? `节点 ID: ${item.id}` : "知识库节点视频";
      metaMain.appendChild(label);

      const actions = document.createElement("div");
      actions.className = "shorts-card-actions";
      const detailBtn = document.createElement("button");
      detailBtn.type = "button";
      detailBtn.textContent = "查看节点";
      detailBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!item.id) return;
        navigateToDetailPage(item.id);
      });
      actions.appendChild(detailBtn);
      const locateBtn = document.createElement("button");
      locateBtn.type = "button";
      locateBtn.textContent = "在表格中定位";
      locateBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!item.id) return;
        try {
          setTableSelection(item.id, true);
        } catch (err) {
          console.warn("shorts locate failed", err);
        }
      });
      actions.appendChild(locateBtn);

      meta.appendChild(metaMain);
      meta.appendChild(actions);
      card.appendChild(meta);

      const sideActions = document.createElement("div");
      sideActions.className = "shorts-side-actions";

      const muteWrap = document.createElement("div");
      muteWrap.className = "shorts-side-action";
      const muteBtn = document.createElement("button");
      muteBtn.type = "button";
      muteBtn.className = "shorts-action-btn";
      muteBtn.dataset.shortsAction = "mute";
      muteWrap.appendChild(muteBtn);
      const muteText = document.createElement("div");
      muteText.className = "shorts-action-label";
      muteText.textContent = "声音";
      muteWrap.appendChild(muteText);

      const detailWrap = document.createElement("div");
      detailWrap.className = "shorts-side-action";
      const detailIconBtn = document.createElement("button");
      detailIconBtn.type = "button";
      detailIconBtn.className = "shorts-action-btn";
      detailIconBtn.dataset.shortsAction = "detail";
      detailIconBtn.innerHTML =
        '<i class="fa-solid fa-up-right-from-square"></i>';
      detailWrap.appendChild(detailIconBtn);
      const detailText = document.createElement("div");
      detailText.className = "shorts-action-label";
      detailText.textContent = "详情";
      detailWrap.appendChild(detailText);

      sideActions.appendChild(muteWrap);
      sideActions.appendChild(detailWrap);
      card.appendChild(sideActions);

      observer.observe(videoEl);
      videoToIndexMap.set(videoEl, idx);
      videoElements.push(videoEl);
      cardElements.push(card);
      shortsList.appendChild(card);
      return card;
    };

    const updateMuteButtonState = () => {
      cardElements.forEach((card, index) => {
        const muteBtn = card.querySelector("[data-shorts-action='mute']");
        const badge = card.querySelector(".shorts-video-badge");
        const videoEl = videoElements[index];
        if (!muteBtn || !videoEl) return;
        const isMuted = !!videoEl.muted;
        muteBtn.innerHTML = isMuted
          ? '<i class="fa-solid fa-volume-xmark"></i>'
          : '<i class="fa-solid fa-volume-high"></i>';
        muteBtn.setAttribute("title", isMuted ? "开启声音" : "静音");
        if (badge) {
          badge.classList.toggle("hidden", !isMuted);
        }
      });
    };

    const updateNavButtons = (index) => {
      if (!shortsPrevBtn || !shortsNextBtn) return;
      const canPrev = index > 0;
      const canNext =
        index < cardCount - 1 ||
        shortsTotalNodes === 0 ||
        rawList.length < shortsTotalNodes;
      shortsPrevBtn.disabled = !canPrev;
      shortsNextBtn.disabled = !canNext;
      shortsPrevBtn.classList.toggle("hidden", !canPrev);
      shortsNextBtn.classList.toggle("hidden", !canNext);
    };

    const scheduleShortsSidebarSync = (targetId) => {
      if (!targetId) return;
      try {
        if (window.kbShortsSidebarSyncTimer) {
          clearTimeout(window.kbShortsSidebarSyncTimer);
        }
      } catch {}
      window.kbShortsPendingSidebarNodeId = targetId;
      window.kbShortsSidebarSyncTimer = setTimeout(async () => {
        try {
          if ((window.kbViewMode || "") !== "shorts") return;
          const pendingId = String(
            window.kbShortsPendingSidebarNodeId || "",
          ).trim();
          if (!pendingId || pendingId !== targetId) return;
          if (window.kbShortsSidebarHydratedId === pendingId) return;
          if (typeof enterEditById === "function") {
            await enterEditById(pendingId);
            window.kbShortsSidebarHydratedId = pendingId;
          }
        } catch (err) {
          console.warn("shorts sidebar sync failed", err);
        }
      }, 220);
    };

    const setActiveShortsIndex = (index) => {
      if (index < 0 || index >= cardCount) return;
      if (index === activeShortsIndex) return;
      activeShortsIndex = index;
      updateNavButtons(index);
      updateShortsProgress(index, videoElements[index]);

      videoElements.forEach((videoEl, videoIndex) => {
        const card = cardElements[videoIndex];
        if (card) {
          card.classList.toggle("is-active", videoIndex === index);
          card.classList.toggle(
            "is-paused",
            videoIndex !== index || videoEl.paused,
          );
        }
        if (videoIndex !== index) {
          videoEl.pause();
        } else {
          videoEl.muted = window.kbShortsMuted !== false;
          videoEl.play().catch(() => {});
        }
      });
      updateMuteButtonState();

      const targetId = videoItems[index].id;
      if (targetId) {
        try {
          const currentDbSuffix = (() => {
            try {
              const db =
                typeof window.getCurrentDbParam === "function"
                  ? window.getCurrentDbParam()
                  : new URL(window.location.href).searchParams.get("db") || "";
              return db ? `_${db}` : "";
            } catch {
              return "";
            }
          })();
          if (window.localStorage) {
            localStorage.setItem(
              `kbShortsCurrentNode${currentDbSuffix}`,
              targetId,
            );
          }
        } catch (err) {
          console.warn("persist shorts current node failed", err);
        }
        if (
          window.kbViewMode === "shorts" &&
          typeof syncHashForView === "function"
        ) {
          syncHashForView("shorts", {
            replace: true,
            nodeId: targetId,
            includeNode: true,
          });
        }
        if (window.kbSelectedRowId !== targetId) {
          try {
            setTableSelection(targetId, false, {
              skipDetailRefresh: true,
              skipSidebarSync: true,
            });
          } catch (err) {
            console.warn("shorts auto-select failed", err);
          }
        }
        scheduleShortsSidebarSync(targetId);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const videoEl = entry.target;
          if (!(videoEl instanceof HTMLVideoElement)) return;
          const index = videoToIndexMap.get(videoEl);
          if (entry.intersectionRatio >= 0.55 && typeof index === "number") {
            setActiveShortsIndex(index);
          } else if (entry.intersectionRatio < 0.55) {
            videoEl.pause();
            const hiddenCard = cardElements[videoToIndexMap.get(videoEl)];
            if (hiddenCard) hiddenCard.classList.add("is-paused");
          }
        });
      },
      { threshold: [0.55] },
    );
    window.kbShortsObserver = observer;

    videoItems.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "shorts-card is-paused is-portrait";
      card.dataset.index = String(idx);

      const stage = document.createElement("div");
      stage.className = "shorts-stage";

      const videoEl = document.createElement("video");
      videoEl.muted = window.kbShortsMuted !== false;
      videoEl.loop = true;
      videoEl.playsInline = true;
      videoEl.setAttribute("playsinline", "");
      videoEl.setAttribute("webkit-playsinline", "");
      videoEl.setAttribute("controlsList", "nodownload");
      videoEl.style.cursor = "pointer";
      videoEl.preload = "metadata";
      const resolvedUrl = (() => {
        try {
          return new URL(item.video, window.location.origin).toString();
        } catch {
          return item.video;
        }
      })();
      const src = document.createElement("source");
      src.src = resolvedUrl;
      const extMatch = resolvedUrl.split("?")[0].match(/\.([a-z0-9]+)$/i);
      if (extMatch) {
        src.type = `video/${extMatch[1].toLowerCase()}`;
      }
      videoEl.appendChild(src);
      if (item.image) {
        try {
          videoEl.poster = new URL(
            item.image,
            window.location.origin,
          ).toString();
        } catch {
          videoEl.poster = item.image;
        }
      }
      videoEl.addEventListener("click", (event) => {
        event.preventDefault();
        if (videoEl.paused) {
          videoEl.play().catch(() => {});
          card.classList.remove("is-paused");
        } else {
          videoEl.pause();
          card.classList.add("is-paused");
        }
      });
      videoEl.addEventListener("play", () => {
        card.classList.remove("is-paused");
      });
      videoEl.addEventListener("pause", () => {
        card.classList.add("is-paused");
      });
      videoEl.addEventListener("loadedmetadata", () => {
        try {
          const width = Number(videoEl.videoWidth || 0);
          const height = Number(videoEl.videoHeight || 0);
          if (!width || !height) return;
          const ratio = width / height;
          card.classList.remove("is-portrait", "is-landscape", "is-square");
          if (ratio >= 1.15) {
            card.classList.add("is-landscape");
          } else if (ratio >= 0.9) {
            card.classList.add("is-square");
          } else {
            card.classList.add("is-portrait");
          }
        } catch (err) {
          console.warn("shorts video metadata parse failed", err);
        }
      });

      const playIndicator = document.createElement("div");
      playIndicator.className = "shorts-video-play";
      playIndicator.innerHTML = '<i class="fa-solid fa-play"></i>';

      const muteBadge = document.createElement("div");
      muteBadge.className = "shorts-video-badge";
      muteBadge.innerHTML =
        '<i class="fa-solid fa-volume-xmark"></i><span>静音播放</span>';

      stage.appendChild(videoEl);
      stage.appendChild(playIndicator);
      stage.appendChild(muteBadge);
      card.appendChild(stage);

      const meta = document.createElement("div");
      meta.className = "shorts-card-meta";

      const metaMain = document.createElement("div");
      metaMain.className = "shorts-card-meta-main";

      const topLine = document.createElement("div");
      topLine.className = "shorts-card-meta-topline";
      const chip = document.createElement("span");
      chip.className = "shorts-card-chip";
      chip.textContent = item.classLabel || "未分类";
      topLine.appendChild(chip);
      metaMain.appendChild(topLine);

      const title = document.createElement("div");
      title.className = "shorts-card-title";
      title.textContent = item.label || item.id || "未命名节点";
      metaMain.appendChild(title);

      const label = document.createElement("div");
      label.className = "shorts-card-label";
      label.textContent = item.id ? `节点 ID: ${item.id}` : "知识库节点视频";
      metaMain.appendChild(label);

      const actions = document.createElement("div");
      actions.className = "shorts-card-actions";

      const detailBtn = document.createElement("button");
      detailBtn.type = "button";
      detailBtn.textContent = "查看节点";
      detailBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!item.id) return;
        navigateToDetailPage(item.id);
      });
      actions.appendChild(detailBtn);

      const locateBtn = document.createElement("button");
      locateBtn.type = "button";
      locateBtn.textContent = "在表格中定位";
      locateBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!item.id) return;
        try {
          setTableSelection(item.id, true);
        } catch (err) {
          console.warn("shorts locate failed", err);
        }
      });
      actions.appendChild(locateBtn);

      meta.appendChild(metaMain);
      meta.appendChild(actions);
      card.appendChild(meta);

      const sideActions = document.createElement("div");
      sideActions.className = "shorts-side-actions";

      const muteWrap = document.createElement("div");
      muteWrap.className = "shorts-side-action";
      const muteBtn = document.createElement("button");
      muteBtn.type = "button";
      muteBtn.className = "shorts-action-btn";
      muteBtn.dataset.shortsAction = "mute";
      muteWrap.appendChild(muteBtn);
      const muteText = document.createElement("div");
      muteText.className = "shorts-action-label";
      muteText.textContent = "声音";
      muteWrap.appendChild(muteText);

      const detailWrap = document.createElement("div");
      detailWrap.className = "shorts-side-action";
      const detailIconBtn = document.createElement("button");
      detailIconBtn.type = "button";
      detailIconBtn.className = "shorts-action-btn";
      detailIconBtn.dataset.shortsAction = "detail";
      detailIconBtn.innerHTML =
        '<i class="fa-solid fa-up-right-from-square"></i>';
      detailWrap.appendChild(detailIconBtn);
      const detailText = document.createElement("div");
      detailText.className = "shorts-action-label";
      detailText.textContent = "详情";
      detailWrap.appendChild(detailText);

      sideActions.appendChild(muteWrap);
      sideActions.appendChild(detailWrap);
      card.appendChild(sideActions);

      observer.observe(videoEl);
      videoToIndexMap.set(videoEl, idx);
      videoElements.push(videoEl);
      cardElements.push(card);
      shortsList.appendChild(card);
    });

    const shouldLoadMoreShorts = (index) => {
      return index >= cardCount - 2 && !shortsLoadingMore;
    };

    const getCurrentCardIndex = () => {
      const center = shortsList.scrollTop + shortsList.clientHeight / 2;
      let bestIndex = 0;
      let bestDistance = Infinity;
      cardElements.forEach((card, idx) => {
        const top = card.offsetTop;
        const distance = Math.abs(top - center + card.clientHeight / 2);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = idx;
        }
      });
      return bestIndex;
    };

    const scrollToCard = (index) => {
      if (index < 0 || index >= cardCount) return;
      wheelLock = true;
      const targetCard = cardElements[index];
      if (targetCard) {
        shortsList.scrollTo({
          top: targetCard.offsetTop,
          behavior: "smooth",
        });
      }
      setActiveShortsIndex(index);
      setTimeout(() => {
        wheelLock = false;
      }, scrollDuration);
    };

    const isListScrolledToBottom = () => {
      return (
        shortsList.scrollTop + shortsList.clientHeight >=
        shortsList.scrollHeight - 12
      );
    };

    const maybeLoadMoreShorts = (index) => {
      if (shortsLoadingMore) return;
      if (!shouldLoadMoreShorts(index) && !isListScrolledToBottom()) return;
      window.kbShortsPendingScrollIndex = index + 1;
      loadMoreShortsPage().catch(() => {
        setShortsStatus("");
      });
    };

    let isInitializingShorts = true;

    const handleShortsScroll = () => {
      if (isInitializingShorts) return;
      const newIndex = getCurrentCardIndex();
      setActiveShortsIndex(newIndex);
      if (shortsScrollEndTimer) {
        clearTimeout(shortsScrollEndTimer);
      }
      shortsScrollEndTimer = setTimeout(() => {
        maybeLoadMoreShorts(newIndex);
      }, 110);
    };

    const handleShortsControlClick = async (event) => {
      const actionButton = event.target.closest(".shorts-action-btn");
      if (actionButton) {
        event.preventDefault();
        const action = actionButton.dataset.shortsAction || "";
        const parentCard = actionButton.closest(".shorts-card");
        const cardIndex = Number(parentCard?.dataset.index || -1);
        const currentItem = cardIndex >= 0 ? videoItems[cardIndex] : null;
        if (action === "mute") {
          window.kbShortsMuted = !(window.kbShortsMuted !== false);
          videoElements.forEach((videoEl) => {
            videoEl.muted = window.kbShortsMuted !== false;
          });
          updateMuteButtonState();
          return;
        }
        if (action === "detail" && currentItem?.id) {
          navigateToDetailPage(currentItem.id);
          return;
        }
      }

      const target = event.target.closest(".shorts-arrow-btn");
      if (!target) return;
      const isPrev = target.id === "shortsPrevBtn";
      const isNext = target.id === "shortsNextBtn";
      if (!isPrev && !isNext) return;
      event.preventDefault();
      const currentIndex = getCurrentCardIndex();
      if (isPrev) {
        const prevIndex = Math.max(currentIndex - 1, 0);
        if (prevIndex !== currentIndex) {
          scrollToCard(prevIndex);
        }
        return;
      }
      if (currentIndex >= cardCount - 1) {
        if (shouldLoadMoreShorts(currentIndex) || isListScrolledToBottom()) {
          window.kbShortsPendingScrollIndex = currentIndex + 1;
          await loadMoreShortsPage();
        }
        return;
      }
      const nextIndex = currentIndex + 1;
      if (nextIndex !== currentIndex) {
        scrollToCard(nextIndex);
      }
    };

    const handleShortsKeydown = async (event) => {
      if (window.kbViewMode !== "shorts") return;
      const tagName = event.target?.tagName || "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tagName)) return;
      const currentIndex = getCurrentCardIndex();
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        if (currentIndex >= cardCount - 1) {
          if (shouldLoadMoreShorts(currentIndex) || isListScrolledToBottom()) {
            window.kbShortsPendingScrollIndex = currentIndex + 1;
            await loadMoreShortsPage();
          }
          return;
        }
        scrollToCard(Math.min(currentIndex + 1, cardCount - 1));
        return;
      }
      if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        scrollToCard(Math.max(currentIndex - 1, 0));
        return;
      }
      if (
        event.key === "ArrowLeft" ||
        event.key.toLowerCase() === "j" ||
        event.key === ","
      ) {
        event.preventDefault();
        const activeVideo = videoElements[currentIndex];
        if (!activeVideo) return;
        const newTime = Math.max(0, activeVideo.currentTime - 10);
        activeVideo.currentTime = newTime;
        updateShortsProgress(currentIndex, activeVideo);
        return;
      }
      if (
        event.key === "ArrowRight" ||
        event.key.toLowerCase() === "l" ||
        event.key === "."
      ) {
        event.preventDefault();
        const activeVideo = videoElements[currentIndex];
        if (!activeVideo) return;
        const duration = activeVideo.duration || 0;
        const newTime = Math.min(duration, activeVideo.currentTime + 10);
        activeVideo.currentTime = newTime;
        updateShortsProgress(currentIndex, activeVideo);
        return;
      }
      if (event.key === " " || event.key.toLowerCase() === "k") {
        event.preventDefault();
        const activeVideo = videoElements[currentIndex];
        if (!activeVideo) return;
        if (activeVideo.paused) {
          activeVideo.play().catch(() => {});
        } else {
          activeVideo.pause();
        }
        return;
      }
      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        window.kbShortsMuted = !(window.kbShortsMuted !== false);
        videoElements.forEach((videoEl) => {
          videoEl.muted = window.kbShortsMuted !== false;
        });
        updateMuteButtonState();
      }
    };

    let wheelGestureActive = false;
    let wheelGestureTimer = null;
    const DISCRETE_WHEEL_LOCK_MS = Math.max(scrollDuration, 500);

    const handleShortsWheel = async (event) => {
      if (wheelLock) {
        event.preventDefault();
        return;
      }
      if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      if (Math.abs(event.deltaY) < 10) return;
      event.preventDefault();
      if (wheelGestureActive) {
        if (wheelGestureTimer) {
          clearTimeout(wheelGestureTimer);
        }
        wheelGestureTimer = window.setTimeout(() => {
          wheelGestureActive = false;
          wheelGestureTimer = null;
        }, DISCRETE_WHEEL_LOCK_MS);
        return;
      }

      wheelGestureActive = true;
      if (wheelGestureTimer) {
        clearTimeout(wheelGestureTimer);
      }
      wheelGestureTimer = window.setTimeout(() => {
        wheelGestureActive = false;
        wheelGestureTimer = null;
      }, DISCRETE_WHEEL_LOCK_MS);

      const currentIndex = getCurrentCardIndex();
      const direction = event.deltaY > 0 ? 1 : -1;
      if (direction > 0) {
        if (currentIndex >= cardCount - 1) {
          if (shouldLoadMoreShorts(currentIndex) || isListScrolledToBottom()) {
            window.kbShortsPendingScrollIndex = currentIndex + 1;
            await loadMoreShortsPage();
          }
          return;
        }
        const nextIndex = currentIndex + 1;
        scrollToCard(nextIndex);
        if (currentIndex >= cardCount - 2) {
          window.kbShortsPendingScrollIndex = currentIndex + 1;
          loadMoreShortsPage().catch(() => {});
        }
        return;
      }

      const prevIndex = Math.max(currentIndex - 1, 0);
      if (prevIndex !== currentIndex) {
        scrollToCard(prevIndex);
      }
    };

    window.kbShortsHandlers = {
      scroll: handleShortsScroll,
      wheel: handleShortsWheel,
      click: handleShortsControlClick,
      keydown: handleShortsKeydown,
    };

    shortsPanel.addEventListener("click", window.kbShortsHandlers.click);
    shortsList.addEventListener("scroll", window.kbShortsHandlers.scroll, {
      passive: true,
    });
    shortsList.addEventListener("wheel", window.kbShortsHandlers.wheel, {
      passive: false,
    });
    document.addEventListener("keydown", window.kbShortsHandlers.keydown);

    let initialNodeId = window.kbSelectedRowId || "";
    try {
      if (!initialNodeId && window.localStorage) {
        const currentDbSuffix = (() => {
          try {
            const db =
              typeof window.getCurrentDbParam === "function"
                ? window.getCurrentDbParam()
                : new URL(window.location.href).searchParams.get("db") || "";
            return db ? `_${db}` : "";
          } catch {
            return "";
          }
        })();
        const cachedShortsNode = localStorage.getItem(
          `kbShortsCurrentNode${currentDbSuffix}`,
        );
        if (cachedShortsNode) {
          initialNodeId = cachedShortsNode;
        }
      }
    } catch (err) {
      console.warn("load persisted shorts node failed", err);
    }

    const normalizeNodeId = (value) => {
      if (!value) return "";
      return String(value)
        .trim()
        .replace(/^entity\//, "");
    };
    const initialNormalizedId = normalizeNodeId(initialNodeId);
    let initialShortsIndex = videoItems.findIndex((item) => {
      const itemId = normalizeNodeId(item.id);
      return (
        itemId &&
        (itemId === initialNormalizedId ||
          initialNormalizedId.endsWith(itemId) ||
          itemId.endsWith(initialNormalizedId))
      );
    });
    if (initialShortsIndex < 0) initialShortsIndex = 0;

    const pendingAnchorKey = String(
      window.kbShortsPendingAnchorKey || "",
    ).trim();
    if (pendingAnchorKey) {
      const anchoredIndex = videoItems.findIndex(
        (item) => String(item.replayKey || "").trim() === pendingAnchorKey,
      );
      if (anchoredIndex >= 0) {
        initialShortsIndex = anchoredIndex;
      }
      window.kbShortsPendingAnchorKey = "";
    }

    const pendingIndex = Number(window.kbShortsPendingScrollIndex || -1);
    if (pendingIndex >= 0 && pendingIndex < videoItems.length) {
      initialShortsIndex = pendingIndex;
    }
    if (window.kbShortsPendingScrollIndex) {
      window.kbShortsPendingScrollIndex = null;
    }

    if (window.kbShortsForceFirst) {
      initialShortsIndex = 0;
      window.kbShortsForceFirst = false;
    }

    const originalScrollBehavior = shortsList.style.scrollBehavior;
    shortsList.style.visibility = "hidden";
    shortsList.style.scrollBehavior = "auto";

    updateNavButtons(initialShortsIndex);
    updateShortsProgress(initialShortsIndex);
    setActiveShortsIndex(initialShortsIndex);
    if (cardElements[initialShortsIndex]) {
      shortsList.scrollTop = cardElements[initialShortsIndex].offsetTop;
    }

    shortsList.style.visibility = "";
    shortsList.style.scrollBehavior = originalScrollBehavior;
    isInitializingShorts = false;
    handleShortsScroll();
    updateMuteButtonState();
  };

  async function renderGalleryList() {
    const galleryPanel = document.getElementById("galleryPanel");
    const galleryList = document.getElementById("galleryList");
    const galleryCount = document.getElementById("galleryCount");
    const galleryControls = document.getElementById("galleryControls");
    const galleryPrevBtn = document.getElementById("galleryPrevBtn");
    const galleryNextBtn = document.getElementById("galleryNextBtn");
    const galleryStatus = document.getElementById("galleryStatus");
    const galleryProgressLabel = document.getElementById(
      "galleryProgressLabel",
    );
    const galleryProgressBar = document.getElementById("galleryProgressBar");
    if (!galleryPanel || !galleryList) return;

    if (window.kbGalleryHandlers?.scroll) {
      galleryList.removeEventListener(
        "scroll",
        window.kbGalleryHandlers.scroll,
      );
    }
    if (window.kbGalleryHandlers?.wheel) {
      galleryList.removeEventListener("wheel", window.kbGalleryHandlers.wheel);
    }
    if (window.kbGalleryHandlers?.click) {
      galleryPanel.removeEventListener("click", window.kbGalleryHandlers.click);
    }
    if (window.kbGalleryHandlers?.keydown) {
      document.removeEventListener("keydown", window.kbGalleryHandlers.keydown);
    }
    if (window.kbGallerySidebarSyncTimer) {
      try {
        clearTimeout(window.kbGallerySidebarSyncTimer);
      } catch {}
      window.kbGallerySidebarSyncTimer = null;
    }

    let rawList = Array.isArray(window.kbGalleryNodes)
      ? window.kbGalleryNodes
      : [];
    const galleryPageSize = 12;
    const currentDbSuffix = (() => {
      try {
        const db =
          typeof window.getCurrentDbParam === "function"
            ? window.getCurrentDbParam()
            : new URL(window.location.href).searchParams.get("db") || "";
        return db ? `_${db}` : "";
      } catch {
        return "";
      }
    })();
    const galleryCacheKey = `kbGalleryRandomCache${currentDbSuffix}`;
    const galleryCacheLimit = 48;
    const galleryCacheByteLimit = 180000;
    const galleryStatusDelay = 180;
    const galleryLoadCooldown = 700;
    let galleryTotalNodes = Number(window.kbTableTotalNodes || 0) || 0;
    const galleryLoadState = window.kbGalleryLoadState || {
      inFlight: false,
      lastLoadedAt: 0,
      statusTimer: null,
    };
    window.kbGalleryLoadState = galleryLoadState;
    let galleryLoadingMore = galleryLoadState.inFlight === true;
    let galleryCacheDisabled = window.kbGalleryCacheDisabled === true;

    const setGalleryStatus = (message) => {
      if (!galleryStatus) return;
      const statusText = galleryStatus.querySelector(".shorts-status-text");
      if (message) {
        if (statusText) statusText.textContent = message;
        galleryStatus.classList.add("active");
      } else {
        galleryStatus.classList.remove("active");
      }
    };

    const clearGalleryStatusTimer = () => {
      try {
        if (galleryLoadState.statusTimer) {
          clearTimeout(galleryLoadState.statusTimer);
        }
      } catch {}
      galleryLoadState.statusTimer = null;
    };

    const getGalleryCacheSnapshot = (items) => {
      const normalizedItems = Array.isArray(items) ? items : [];
      const slicedItems = normalizedItems
        .slice(-galleryCacheLimit)
        .map((item) => ({
          id: item?.id || item?._id || "",
          label_zh: item?.label_zh || item?.label || "",
          classLabel: item?.classLabel || item?.type || "",
          image: item?.image || item?.avatar || "",
        }));
      let snapshot = slicedItems;
      try {
        while (snapshot.length > 12) {
          const serialized = JSON.stringify(snapshot);
          if (serialized.length <= galleryCacheByteLimit) break;
          snapshot = snapshot.slice(Math.ceil(snapshot.length * 0.75));
        }
      } catch {
        snapshot = slicedItems.slice(-12);
      }
      return snapshot;
    };

    const saveGalleryCache = (items) => {
      if (galleryCacheDisabled) return;
      try {
        if (window.localStorage) {
          const snapshot = getGalleryCacheSnapshot(items);
          localStorage.setItem(galleryCacheKey, JSON.stringify(snapshot));
        }
      } catch (err) {
        galleryCacheDisabled = true;
        window.kbGalleryCacheDisabled = true;
        try {
          if (window.localStorage) localStorage.removeItem(galleryCacheKey);
        } catch {}
        console.warn("save gallery cache skipped after quota hit", err);
      }
    };

    const loadGalleryCache = () => {
      if (!window.localStorage) return [];
      try {
        const cached = localStorage.getItem(galleryCacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return getGalleryCacheSnapshot(parsed);
        }
      } catch (err) {
        console.warn("load gallery cache failed", err);
      }
      return [];
    };

    const fetchGalleryRandomBatch = async (excludeIds = []) => {
      const url = appendCurrentDbToUrl(
        new URL("/api/kb/gallery_random", window.location.origin),
      );
      url.searchParams.set("limit", String(galleryPageSize));
      if (excludeIds && excludeIds.length) {
        url.searchParams.set("exclude_ids", excludeIds.join(","));
      }
      const currentDbSuffix = (() => {
        try {
          const db =
            typeof window.getCurrentDbParam === "function"
              ? window.getCurrentDbParam()
              : new URL(window.location.href).searchParams.get("db") || "";
          return db ? `_${db}` : "";
        } catch {
          return "";
        }
      })();
      const currentId =
        String(window.kbGalleryPendingSidebarNodeId || "").trim() ||
        String(window.kbSelectedRowId || "").trim() ||
        String(
          localStorage.getItem(`kbGalleryCurrentNode${currentDbSuffix}`) || "",
        ).trim();
      if (currentId) url.searchParams.set("current_id", currentId);
      const recentItems = rawList.slice(-18);
      const recentIds = recentItems
        .map((item) => String(item.id || "").trim())
        .filter(Boolean);
      if (recentIds.length) {
        url.searchParams.set("recent_ids", recentIds.join(","));
      }
      const recentClasses = recentItems
        .map((item) => String(item.classLabel || "").trim())
        .filter(Boolean)
        .slice(-12);
      if (recentClasses.length) {
        url.searchParams.set("recent_classes", recentClasses.join(","));
      }
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      galleryTotalNodes = Number(data.total || galleryTotalNodes || 0);
      return Array.isArray(data.nodes) ? data.nodes : [];
    };

    const normalizeGalleryNodes = (nodes) =>
      nodes.map((item) => ({
        label: item.label || item.label_zh || item.name || "",
        label_zh: item.label_zh || item.label || item.name || "",
        id: item.id || item._id || "",
        classLabel: item.classLabel || item.type || "",
        image:
          item.image || item.avatar || item.icon || item.img || item.logo || "",
      }));

    const appendGalleryNodes = async (nodes, options = {}) => {
      const allowDuplicates = options.allowDuplicates === true;
      const tableList = normalizeGalleryNodes(nodes);
      const existingIds = new Set(rawList.map((item) => item.id));
      const newItems = allowDuplicates
        ? tableList
            .filter((item) => item.id && item.image)
            .map((item, index) => ({
              ...item,
              __galleryReplayKey: `${item.id || "image"}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
            }))
        : tableList.filter(
            (item) => item.id && item.image && !existingIds.has(item.id),
          );
      if (!newItems.length) return false;
      window.kbGalleryPendingAnchorKey =
        newItems[0]?.__galleryReplayKey || newItems[0]?.id || "";
      window.kbGalleryPendingScrollIndex = rawList.length;
      rawList = rawList.concat(newItems);
      window.kbGalleryNodes = rawList;
      saveGalleryCache(rawList);
      await renderGalleryList();
      return true;
    };

    const loadMoreGalleryPage = async (retryCount = 0) => {
      if (galleryLoadingMore) return;
      galleryLoadingMore = true;
      galleryLoadState.inFlight = true;
      clearGalleryStatusTimer();
      galleryLoadState.statusTimer = setTimeout(() => {
        if (galleryLoadState.inFlight) {
          setGalleryStatus("正在加载更多图片...");
        }
      }, galleryStatusDelay);
      setGalleryStatus("");
      setGalleryStatus("正在加载更多图片...");
      try {
        const excludeIds = rawList.map((item) => item.id).filter(Boolean);
        const canUseFreshOnly =
          !galleryTotalNodes || excludeIds.length < galleryTotalNodes;
        const nodes = await fetchGalleryRandomBatch(
          canUseFreshOnly ? excludeIds : [],
        );
        const appended = await appendGalleryNodes(nodes, {
          allowDuplicates: !canUseFreshOnly,
        });
        if (!appended && retryCount < 2) {
          if (canUseFreshOnly) {
            const replayNodes = await fetchGalleryRandomBatch([]);
            const replayAppended = await appendGalleryNodes(replayNodes, {
              allowDuplicates: true,
            });
            if (replayAppended) return;
          }
          return await loadMoreGalleryPage(retryCount + 1);
        }
      } catch (err) {
        console.warn("loadMoreGalleryPage failed", err);
      } finally {
        galleryLoadingMore = false;
        galleryLoadState.inFlight = false;
        galleryLoadState.lastLoadedAt = Date.now();
        clearGalleryStatusTimer();
        setGalleryStatus("");
      }
    };

    const cachedGallery = loadGalleryCache();
    if (cachedGallery.length) {
      rawList = cachedGallery;
      window.kbGalleryNodes = rawList;
    }

    if (!rawList.length) {
      try {
        const nodes = await fetchGalleryRandomBatch();
        rawList = normalizeGalleryNodes(nodes);
        window.kbGalleryNodes = rawList;
        saveGalleryCache(rawList);
      } catch (err) {
        console.warn("load initial gallery batch failed", err);
      }
    }

    const imageItems = rawList
      .map((item) => ({
        id: item._id || item.id || "",
        label: item.label_zh || item.label || "",
        classLabel: item.classLabel || item.type || "",
        image: item.image || "",
        replayKey: item.__galleryReplayKey || "",
      }))
      .filter((item) => item.image && item.image.trim());

    const count = imageItems.length;
    if (galleryCount) {
      galleryCount.textContent = count
        ? `共 ${count} 张图片`
        : "暂无可展示图片";
    }
    if (galleryControls) {
      galleryControls.style.display = count ? "inline-flex" : "none";
    }

    const formatProgress = (index, total) => {
      if (!total) return "00 / 00";
      return `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    };

    if (galleryProgressLabel) {
      galleryProgressLabel.textContent = count
        ? formatProgress(0, count)
        : "00 / 00";
    }
    if (galleryProgressBar) {
      galleryProgressBar.style.width = count ? `${100 / count}%` : "0%";
    }

    galleryList.innerHTML = "";
    if (!count) {
      const empty = document.createElement("div");
      empty.className = "shorts-empty";
      empty.textContent =
        "当前还没有可展示的图片，先在节点中上传图片后再来看看。";
      galleryList.appendChild(empty);
      return;
    }

    const cardElements = [];
    let activeGalleryIndex = -1;
    let wheelLock = false;
    let galleryScrollEndTimer = null;
    const scrollDuration = 360;
    const DISCRETE_WHEEL_LOCK_MS = Math.max(scrollDuration, 300);
    let wheelGestureActive = false;
    let wheelGestureTimer = null;
    const GALLERY_WHEEL_DELTA_THRESHOLD = 4;
    const cardCount = imageItems.length;

    const updateGalleryProgress = (index) => {
      if (galleryProgressLabel) {
        galleryProgressLabel.textContent = formatProgress(index, cardCount);
      }
      if (galleryProgressBar) {
        const progress = cardCount ? ((index + 1) / cardCount) * 100 : 0;
        galleryProgressBar.style.width = `${progress}%`;
      }
    };

    const updateNavButtons = (index) => {
      if (!galleryPrevBtn || !galleryNextBtn) return;
      const canPrev = index > 0;
      const canNext =
        index < cardCount - 1 ||
        galleryTotalNodes === 0 ||
        rawList.length < galleryTotalNodes;
      galleryPrevBtn.disabled = !canPrev;
      galleryNextBtn.disabled = !canNext;
      galleryPrevBtn.classList.toggle("hidden", !canPrev);
      galleryNextBtn.classList.toggle("hidden", !canNext);
    };

    const scheduleGallerySidebarSync = (targetId) => {
      if (!targetId) return;
      try {
        if (window.kbGallerySidebarSyncTimer) {
          clearTimeout(window.kbGallerySidebarSyncTimer);
        }
      } catch {}
      window.kbGalleryPendingSidebarNodeId = targetId;
      window.kbGallerySidebarSyncTimer = setTimeout(async () => {
        try {
          if ((window.kbViewMode || "") !== "gallery") return;
          const pendingId = String(
            window.kbGalleryPendingSidebarNodeId || "",
          ).trim();
          if (!pendingId || pendingId !== targetId) return;
          if (window.kbGallerySidebarHydratedId === pendingId) return;
          if (typeof enterEditById === "function") {
            await enterEditById(pendingId);
            window.kbGallerySidebarHydratedId = pendingId;
          }
        } catch (err) {
          console.warn("gallery sidebar sync failed", err);
        }
      }, 220);
    };

    const setActiveGalleryIndex = (index) => {
      if (index < 0 || index >= cardCount) return;
      if (index === activeGalleryIndex) return;
      activeGalleryIndex = index;
      updateNavButtons(index);
      updateGalleryProgress(index);
      cardElements.forEach((card, cardIndex) => {
        card.classList.toggle("is-active", cardIndex === index);
      });
      const targetId = imageItems[index].id;
      if (targetId) {
        try {
          const currentDbSuffix = (() => {
            try {
              const db =
                typeof window.getCurrentDbParam === "function"
                  ? window.getCurrentDbParam()
                  : new URL(window.location.href).searchParams.get("db") || "";
              return db ? `_${db}` : "";
            } catch {
              return "";
            }
          })();
          if (window.localStorage) {
            localStorage.setItem(
              `kbGalleryCurrentNode${currentDbSuffix}`,
              targetId,
            );
          }
        } catch (err) {
          console.warn("persist gallery current node failed", err);
        }
        if (
          window.kbViewMode === "gallery" &&
          typeof syncHashForView === "function"
        ) {
          syncHashForView("gallery", {
            replace: true,
            nodeId: targetId,
            includeNode: true,
          });
        }
        if (window.kbSelectedRowId !== targetId) {
          try {
            setTableSelection(targetId, false, {
              skipDetailRefresh: true,
              skipSidebarSync: true,
            });
          } catch (err) {
            console.warn("gallery auto-select failed", err);
          }
        }
        scheduleGallerySidebarSync(targetId);
      }
    };

    imageItems.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "shorts-card is-portrait";
      card.dataset.index = String(idx);

      const stage = document.createElement("div");
      stage.className = "shorts-stage";

      const imageEl = document.createElement("img");
      imageEl.className = "gallery-media";
      imageEl.alt = item.label || item.id || "图库图片";
      try {
        imageEl.src = new URL(item.image, window.location.origin).toString();
      } catch {
        imageEl.src = item.image;
      }
      imageEl.addEventListener("load", () => {
        try {
          const width = Number(imageEl.naturalWidth || 0);
          const height = Number(imageEl.naturalHeight || 0);
          if (!width || !height) return;
          const ratio = width / height;
          card.classList.remove("is-portrait", "is-landscape", "is-square");
          if (ratio >= 1.15) {
            card.classList.add("is-landscape");
          } else if (ratio >= 0.9) {
            card.classList.add("is-square");
          } else {
            card.classList.add("is-portrait");
          }
        } catch (err) {
          console.warn("gallery image load parse failed", err);
        }
      });

      stage.appendChild(imageEl);
      card.appendChild(stage);

      const meta = document.createElement("div");
      meta.className = "shorts-card-meta";
      const metaMain = document.createElement("div");
      metaMain.className = "shorts-card-meta-main";

      const topLine = document.createElement("div");
      topLine.className = "shorts-card-meta-topline";
      const chip = document.createElement("span");
      chip.className = "shorts-card-chip";
      chip.textContent = item.classLabel || "未分类";
      topLine.appendChild(chip);
      metaMain.appendChild(topLine);

      const title = document.createElement("div");
      title.className = "shorts-card-title";
      title.textContent = item.label || item.id || "未命名节点";
      metaMain.appendChild(title);

      const label = document.createElement("div");
      label.className = "shorts-card-label";
      label.textContent = item.id ? `节点 ID: ${item.id}` : "知识库图片";
      metaMain.appendChild(label);

      const actions = document.createElement("div");
      actions.className = "shorts-card-actions";
      const detailBtn = document.createElement("button");
      detailBtn.type = "button";
      detailBtn.textContent = "查看节点";
      detailBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!item.id) return;
        navigateToDetailPage(item.id);
      });
      actions.appendChild(detailBtn);

      const locateBtn = document.createElement("button");
      locateBtn.type = "button";
      locateBtn.textContent = "在表格中定位";
      locateBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!item.id) return;
        try {
          setTableSelection(item.id, true);
        } catch (err) {
          console.warn("gallery locate failed", err);
        }
      });
      actions.appendChild(locateBtn);

      meta.appendChild(metaMain);
      meta.appendChild(actions);
      card.appendChild(meta);

      const sideActions = document.createElement("div");
      sideActions.className = "shorts-side-actions";
      const detailWrap = document.createElement("div");
      detailWrap.className = "shorts-side-action";
      const detailIconBtn = document.createElement("button");
      detailIconBtn.type = "button";
      detailIconBtn.className = "shorts-action-btn";
      detailIconBtn.dataset.galleryAction = "detail";
      detailIconBtn.innerHTML =
        '<i class="fa-solid fa-up-right-from-square"></i>';
      detailWrap.appendChild(detailIconBtn);
      const detailText = document.createElement("div");
      detailText.className = "shorts-action-label";
      detailText.textContent = "详情";
      detailWrap.appendChild(detailText);
      sideActions.appendChild(detailWrap);
      card.appendChild(sideActions);

      const nodeNameBadge = document.createElement("div");
      nodeNameBadge.className = "shorts-card-node-name";
      nodeNameBadge.textContent = item.label || item.id || "未知节点";
      card.appendChild(nodeNameBadge);

      cardElements.push(card);
      galleryList.appendChild(card);
    });

    const shouldLoadMoreGallery = (index) => {
      return index >= cardCount - 2 && !galleryLoadingMore;
    };

    const getCurrentCardIndex = () => {
      const center = galleryList.scrollTop + galleryList.clientHeight / 2;
      let bestIndex = 0;
      let bestDistance = Infinity;
      cardElements.forEach((card, idx) => {
        const top = card.offsetTop;
        const distance = Math.abs(top - center + card.clientHeight / 2);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = idx;
        }
      });
      return bestIndex;
    };

    const scrollToCard = (index) => {
      if (index < 0 || index >= cardCount) return;
      wheelLock = true;
      const targetCard = cardElements[index];
      if (targetCard) {
        galleryList.scrollTo({ top: targetCard.offsetTop, behavior: "smooth" });
      }
      setActiveGalleryIndex(index);
      setTimeout(() => {
        wheelLock = false;
      }, scrollDuration);
    };

    const isListScrolledToBottom = () => {
      return (
        galleryList.scrollTop + galleryList.clientHeight >=
        galleryList.scrollHeight - 12
      );
    };

    const maybeLoadMoreGallery = (index) => {
      if (galleryLoadingMore) return;
      if (
        Date.now() - Number(galleryLoadState.lastLoadedAt || 0) <
        galleryLoadCooldown
      ) {
        return;
      }
      if (!shouldLoadMoreGallery(index) && !isListScrolledToBottom()) return;
      window.kbGalleryPendingScrollIndex = index + 1;
      loadMoreGalleryPage().catch(() => {
        galleryLoadState.inFlight = false;
        clearGalleryStatusTimer();
        setGalleryStatus("");
      });
    };

    let isInitializingGallery = true;
    const handleGalleryScroll = () => {
      if (isInitializingGallery) return;
      const newIndex = getCurrentCardIndex();
      setActiveGalleryIndex(newIndex);
      if (galleryScrollEndTimer) {
        clearTimeout(galleryScrollEndTimer);
      }
      galleryScrollEndTimer = setTimeout(() => {
        maybeLoadMoreGallery(newIndex);
      }, 110);
    };

    const handleGalleryControlClick = async (event) => {
      const actionButton = event.target.closest(
        "[data-gallery-action='detail']",
      );
      if (actionButton) {
        event.preventDefault();
        const parentCard = actionButton.closest(".shorts-card");
        const cardIndex = Number(parentCard?.dataset.index || -1);
        const currentItem = cardIndex >= 0 ? imageItems[cardIndex] : null;
        if (currentItem?.id) {
          navigateToDetailPage(currentItem.id);
        }
        return;
      }

      const target = event.target.closest(".shorts-arrow-btn");
      if (!target) return;
      const isPrev = target.id === "galleryPrevBtn";
      const isNext = target.id === "galleryNextBtn";
      if (!isPrev && !isNext) return;
      event.preventDefault();
      const currentIndex = getCurrentCardIndex();
      if (isPrev) {
        const prevIndex = Math.max(currentIndex - 1, 0);
        if (prevIndex !== currentIndex) scrollToCard(prevIndex);
        return;
      }
      if (currentIndex >= cardCount - 1) {
        if (shouldLoadMoreGallery(currentIndex) || isListScrolledToBottom()) {
          window.kbGalleryPendingScrollIndex = currentIndex + 1;
          await loadMoreGalleryPage();
        }
        return;
      }
      const nextIndex = currentIndex + 1;
      if (nextIndex !== currentIndex) scrollToCard(nextIndex);
    };

    const handleGalleryKeydown = async (event) => {
      if (window.kbViewMode !== "gallery") return;
      const tagName = event.target?.tagName || "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tagName)) return;
      const currentIndex = getCurrentCardIndex();
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        if (currentIndex >= cardCount - 1) {
          if (shouldLoadMoreGallery(currentIndex) || isListScrolledToBottom()) {
            window.kbGalleryPendingScrollIndex = currentIndex + 1;
            await loadMoreGalleryPage();
          }
          return;
        }
        scrollToCard(Math.min(currentIndex + 1, cardCount - 1));
        return;
      }
      if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        scrollToCard(Math.max(currentIndex - 1, 0));
      }
    };

    const handleGalleryWheel = async (event) => {
      if (wheelLock) {
        event.preventDefault();
        return;
      }
      const deltaY = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      if (Math.abs(deltaY) < Math.abs(event.deltaX)) return;
      if (Math.abs(deltaY) < GALLERY_WHEEL_DELTA_THRESHOLD) return;
      event.preventDefault();
      if (wheelGestureActive) {
        if (wheelGestureTimer) {
          clearTimeout(wheelGestureTimer);
        }
        wheelGestureTimer = window.setTimeout(() => {
          wheelGestureActive = false;
          wheelGestureTimer = null;
        }, DISCRETE_WHEEL_LOCK_MS);
        return;
      }

      wheelGestureActive = true;
      if (wheelGestureTimer) {
        clearTimeout(wheelGestureTimer);
      }
      wheelGestureTimer = window.setTimeout(() => {
        wheelGestureActive = false;
        wheelGestureTimer = null;
      }, DISCRETE_WHEEL_LOCK_MS);

      const currentIndex = getCurrentCardIndex();
      if (event.deltaY > 0) {
        if (currentIndex >= cardCount - 1) {
          if (shouldLoadMoreGallery(currentIndex) || isListScrolledToBottom()) {
            window.kbGalleryPendingScrollIndex = currentIndex + 1;
            await loadMoreGalleryPage();
          }
          return;
        }
        scrollToCard(currentIndex + 1);
        if (currentIndex >= cardCount - 2) {
          window.kbGalleryPendingScrollIndex = currentIndex + 1;
          loadMoreGalleryPage().catch(() => {});
        }
        return;
      }
      const prevIndex = Math.max(currentIndex - 1, 0);
      if (prevIndex !== currentIndex) scrollToCard(prevIndex);
    };

    window.kbGalleryHandlers = {
      scroll: handleGalleryScroll,
      wheel: handleGalleryWheel,
      click: handleGalleryControlClick,
      keydown: handleGalleryKeydown,
    };

    galleryPanel.addEventListener("click", window.kbGalleryHandlers.click);
    galleryList.addEventListener("scroll", window.kbGalleryHandlers.scroll, {
      passive: true,
    });
    galleryList.addEventListener("wheel", window.kbGalleryHandlers.wheel, {
      passive: false,
    });
    document.addEventListener("keydown", window.kbGalleryHandlers.keydown);

    let initialNodeId = window.kbSelectedRowId || "";
    try {
      if (!initialNodeId && window.localStorage) {
        const currentDbSuffix = (() => {
          try {
            const db =
              typeof window.getCurrentDbParam === "function"
                ? window.getCurrentDbParam()
                : new URL(window.location.href).searchParams.get("db") || "";
            return db ? `_${db}` : "";
          } catch {
            return "";
          }
        })();
        const cachedGalleryNode = localStorage.getItem(
          `kbGalleryCurrentNode${currentDbSuffix}`,
        );
        if (cachedGalleryNode) initialNodeId = cachedGalleryNode;
      }
    } catch (err) {
      console.warn("load persisted gallery node failed", err);
    }

    const normalizeNodeId = (value) => {
      if (!value) return "";
      return String(value)
        .trim()
        .replace(/^entity\//, "");
    };
    const initialNormalizedId = normalizeNodeId(initialNodeId);
    let initialGalleryIndex = imageItems.findIndex((item) => {
      const itemId = normalizeNodeId(item.id);
      return (
        itemId &&
        (itemId === initialNormalizedId ||
          initialNormalizedId.endsWith(itemId) ||
          itemId.endsWith(initialNormalizedId))
      );
    });
    if (initialGalleryIndex < 0) initialGalleryIndex = 0;

    const pendingAnchorKey = String(
      window.kbGalleryPendingAnchorKey || "",
    ).trim();
    if (pendingAnchorKey) {
      const anchoredIndex = imageItems.findIndex(
        (item) => String(item.replayKey || "").trim() === pendingAnchorKey,
      );
      if (anchoredIndex >= 0) initialGalleryIndex = anchoredIndex;
      window.kbGalleryPendingAnchorKey = "";
    }

    const pendingIndex = Number(window.kbGalleryPendingScrollIndex || -1);
    if (pendingIndex >= 0 && pendingIndex < imageItems.length) {
      initialGalleryIndex = pendingIndex;
    }
    if (window.kbGalleryPendingScrollIndex) {
      window.kbGalleryPendingScrollIndex = null;
    }
    if (window.kbGalleryForceFirst) {
      initialGalleryIndex = 0;
      window.kbGalleryForceFirst = false;
    }

    const originalScrollBehavior = galleryList.style.scrollBehavior;
    galleryList.style.visibility = "hidden";
    galleryList.style.scrollBehavior = "auto";
    updateNavButtons(initialGalleryIndex);
    updateGalleryProgress(initialGalleryIndex);
    setActiveGalleryIndex(initialGalleryIndex);
    if (cardElements[initialGalleryIndex]) {
      galleryList.scrollTop = cardElements[initialGalleryIndex].offsetTop;
    }
    galleryList.style.visibility = "";
    galleryList.style.scrollBehavior = originalScrollBehavior;
    isInitializingGallery = false;
    handleGalleryScroll();
  }

  async function deleteSelectedRows() {
    const ids = Array.from(window.kbSelectedRowIds || []);
    if (!ids.length) return;
    if (
      !confirm(
        `确定删除选中 ${ids.length} 个节点及其所有关系？此操作不可恢复。`,
      )
    ) {
      return;
    }

    let okCount = 0;
    for (const id of ids) {
      try {
        const resp = await fetch("/api/kb/nodes?id=" + encodeURIComponent(id), {
          method: "DELETE",
        });
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const data = await resp.json();
        if (data && data.ok) okCount++;
        else console.warn("删除失败", id);
      } catch (e) {
        console.error("删除失败", id, e);
      }
    }

    alert(`删除完成：成功 ${okCount} / 总计 ${ids.length}`);
    window.kbSelectedRowIds = new Set();
    window.kbSelectedRowId = "";
    window.kbLastAnchorRowId = "";
    if (typeof loadGraph === "function") {
      await loadGraph();
    }
    if (typeof loadTablePage === "function") {
      await loadTablePage({ resetPage: true });
    }
  }

  function bindDeleteButton() {
    if (!btnDeleteSelected) return;
    btnDeleteSelected.addEventListener("click", deleteSelectedRows);
    ensureTableSelectedButtonsState();
  }

  function bindSelectAll() {
    const chkSelectAll = document.getElementById("chkSelectAll");
    if (!chkSelectAll) return;
    chkSelectAll.addEventListener("change", () => {
      if (!tblNodes) return;
      const checkboxes = tblNodes.querySelectorAll("tbody .row-checkbox");
      if (chkSelectAll.checked) {
        // 全选
        window.kbSelectedRowIds = new Set();
        checkboxes.forEach((chk) => {
          const rid = chk.getAttribute("data-id") || "";
          if (rid) {
            window.kbSelectedRowIds.add(rid);
            chk.checked = true;
          }
        });
      } else {
        // 取消全选
        window.kbSelectedRowIds = new Set();
        checkboxes.forEach((chk) => {
          chk.checked = false;
        });
      }
      updateSelectedRowStyles();
      ensureTableSelectedButtonsState();
    });
  }

  async function clearAllNodes() {
    if (!confirm("确定清空所有节点及其属性和关系？此操作不可恢复！")) return;
    try {
      const url = new URL("/api/kb/nodes/clear", window.location.origin);
      if (typeof window.appendCurrentDbParam === "function") {
        const scopedUrl = window.appendCurrentDbParam(url);
        if (scopedUrl instanceof URL) url.search = scopedUrl.search;
      }
      const resp = await fetch(url, { method: "DELETE" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      alert("已清空 " + (data.deleted || 0) + " 个节点");
      window.kbSelectedRowIds = new Set();
      window.kbSelectedRowId = "";
      window.kbLastAnchorRowId = "";
      if (typeof loadGraph === "function") await loadGraph();
      if (typeof loadTablePage === "function")
        await loadTablePage({ resetPage: true });
    } catch (e) {
      alert("清空节点失败: " + (e.message || e));
    }
  }

  async function clearAllRelations() {
    if (!confirm("确定清空所有关系？此操作不可恢复！")) return;
    try {
      const url = new URL("/api/kb/relations/clear", window.location.origin);
      if (typeof window.appendCurrentDbParam === "function") {
        const scopedUrl = window.appendCurrentDbParam(url);
        if (scopedUrl instanceof URL) url.search = scopedUrl.search;
      }
      const resp = await fetch(url, { method: "DELETE" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      alert("已清空 " + (data.deleted || 0) + " 条关系");
      if (typeof loadGraph === "function") await loadGraph();
      if (typeof loadTablePage === "function")
        await loadTablePage({ resetPage: false });
    } catch (e) {
      alert("清空关系失败: " + (e.message || e));
    }
  }

  function bindClearButtons() {
    const btnClearAllNodes = document.getElementById("btnClearAllNodes");
    const btnClearAllRelations = document.getElementById(
      "btnClearAllRelations",
    );
    if (btnClearAllNodes)
      btnClearAllNodes.addEventListener("click", clearAllNodes);
    if (btnClearAllRelations)
      btnClearAllRelations.addEventListener("click", clearAllRelations);
  }

  window.ensureTableSelectedButtonsState = ensureTableSelectedButtonsState;
  window.updateSelectedRowStyles = updateSelectedRowStyles;
  window.syncCheckboxStates = syncCheckboxStates;
  window.setTableSelection = setTableSelection;
  window.toggleCtrlSelection = toggleCtrlSelection;
  window.rangeSelectTo = rangeSelectTo;
  window.getTableRows = getTableRows;
  window.focusRowElement = focusRowElement;
  window.scrollRowIntoView = scrollRowIntoView;
  window.moveTableSelection = moveTableSelection;
  window.openSelectedNodeDetail = openSelectedNodeDetail;
  window.positionTooltip = positionTooltip;
  window.renderTableList = renderTableList;
  window.renderShortsList = renderShortsList;
  window.renderGalleryList = renderGalleryList;

  if (window.kbViewMode === "shorts") {
    try {
      renderShortsList();
    } catch (err) {
      console.warn("shorts page rehydrate failed", err);
    }
  }
  if (window.kbViewMode === "gallery") {
    try {
      renderGalleryList();
    } catch (err) {
      console.warn("gallery page rehydrate failed", err);
    }
  }

  bindDeleteButton();
  bindSelectAll();
  bindClearButtons();
})();
