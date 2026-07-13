function __kbInitTableSelection() {
  const shared = window.kbApp || {};
  const state = shared.state || {};
  const dom = shared.dom || {};
  const byId = dom.byId || ((id) => document.getElementById(id));
  const btnDeleteSelected = byId("btnDeleteSelected");
  const tblNodes = byId("tblNodes");
  let tableListDelegatedBound = false;
  let tableListTooltip = null;
  let tableListHoverRow = null;
  let tableListTooltipRaf = 0;
  let tableListTooltipPoint = null;
  let tableMediaObserver = null;
  let tableListScrollHost = null;
  let tableListScrollHandler = null;
  let videoContextMenuEl = null;
  let videoContextMenuActionEl = null;
  let videoContextMenuAction = null;
  let tableGridLayoutRaf = 0;
  const TABLE_GRID_MEDIA_ROOT_MARGIN = "360px 0px";

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

  function hideInlineHashTags(text) {
    const src = (text || "").toString();
    const stripped = src.replace(
      /(^|[\s\n])#[^\s#@，,。.!！？；;：:）)\]}>》」』】]+/g,
      (full, lead) => lead || "",
    );
    return stripped
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function normalizeEntityIdLike(value) {
    return String(value || "")
      .trim()
      .replace(/^entity\//, "");
  }

  function getNodeVideoEntryKey(item) {
    const explicitKey = String(
      item?.__videoEntryKey || item?.__shortsReplayKey || "",
    ).trim();
    if (explicitKey) return explicitKey;
    const id = String(item?.id || item?._id || "").trim();
    const video = String(item?.video || "").trim();
    if (id && video) return `id:${id}|video:${video}`;
    if (video) return `video:${video}`;
    if (id) return `id:${id}`;
    return "";
  }

  function normalizeNodeVideoEntries(nodes) {
    return (Array.isArray(nodes) ? nodes : []).flatMap((item) => {
      const videos = Array.isArray(item?.videos)
        ? item.videos.map((entry) => String(entry || "").trim()).filter(Boolean)
        : [];
      const singleVideo = String(item?.video || "").trim();
      const videoList = videos.length
        ? videos
        : singleVideo
          ? [singleVideo]
          : [];
      if (!videoList.length) return [];
      const coverList = Array.isArray(item?.covers)
        ? item.covers.map((entry) => String(entry || "").trim())
        : [];
      const fallbackCover = String(item?.cover || "").trim();
      const labelZh = item?.label_zh || item?.label || item?.name || "";
      const label = item?.label || item?.label_zh || item?.name || "";
      const id = item?.id || item?._id || "";
      const _id = item?._id || item?.id || "";
      const link = item?.link || "";
      const classLabel = item?.classLabel || item?.type || item?.class || "";
      const image = item?.image || item?.avatar || "";
      return videoList.map((video, index) => {
        const poster =
          coverList[index] || (videoList.length === 1 ? fallbackCover : "");
        const entryKey = `${String(id || _id || "node").trim() || "node"}::${index}::${video}`;
        return {
          label_zh: labelZh,
          label,
          id,
          _id,
          link,
          classLabel,
          video,
          cover: poster,
          covers: coverList,
          image,
          __videoEntryKey: entryKey,
          __shortsReplayKey: entryKey,
        };
      });
    });
  }

  function getRouteNodeIdFromUrl() {
    try {
      const hash = String(window.location.hash || "")
        .replace(/^#/, "")
        .trim();
      if (hash) {
        if (hash.includes("=")) {
          const hashParams = new URLSearchParams(hash);
          const fromHash = String(hashParams.get("node") || "").trim();
          if (fromHash) return fromHash;
        }
      }
    } catch {}
    try {
      const url = new URL(window.location.href);
      const fromQuery = String(url.searchParams.get("node") || "").trim();
      if (fromQuery) return fromQuery;
    } catch {}
    return "";
  }

  function navigateToDetailPage(nodeId) {
    if (!nodeId) return;
    try {
      setTableSelection("", false);
    } catch {}
    window.location.href = buildDetailPageUrl(nodeId);
  }

  function getListItemSelector() {
    return ".entity-list-item";
  }

  function getListItems() {
    try {
      if (!tblNodes) return [];
      return Array.from(tblNodes.querySelectorAll(getListItemSelector()));
    } catch {
      return [];
    }
  }

  function getTableNodeById(nodeId) {
    const id = String(nodeId || "").trim();
    if (!id) return null;
    const nodeMap = window.kbTableNodeMap;
    if (nodeMap && typeof nodeMap.get === "function") {
      const mapped = nodeMap.get(id);
      if (mapped) return mapped;
    }
    const list = Array.isArray(window.kbTableNodes) ? window.kbTableNodes : [];
    for (const item of list) {
      const itemId = String(item?._id || item?.id || "").trim();
      if (itemId === id) return item;
    }
    return null;
  }

  function applyTableGridMasonryLayout() {
    if (!tblNodes) return;
    if (window.kbTableLayoutMode === "grid") return;
    tblNodes.style.removeProperty("--table-grid-row-height");
    tblNodes.style.removeProperty("--table-grid-gap");
    getListItems().forEach((item) => {
      item.style.removeProperty("grid-row-end");
    });
  }

  function scheduleTableGridMasonryLayout() {
    if (tableGridLayoutRaf) {
      try {
        cancelAnimationFrame(tableGridLayoutRaf);
      } catch {}
    }
    tableGridLayoutRaf = requestAnimationFrame(() => {
      tableGridLayoutRaf = 0;
      applyTableGridMasonryLayout();
    });
  }

  function updateSelectedRowStyles() {
    try {
      if (!tblNodes) return;
      const rows = getListItems();
      const selectedId = String(window.kbSelectedRowId || "").trim();
      const selectedSet =
        window.kbSelectedRowIds &&
        typeof window.kbSelectedRowIds.forEach === "function"
          ? new Set(
              Array.from(window.kbSelectedRowIds)
                .map((v) => String(v || "").trim())
                .filter(Boolean),
            )
          : new Set();
      const normalizedSelectedId = normalizeEntityIdLike(selectedId);
      rows.forEach((tr) => {
        const rid = tr.getAttribute("data-id") || "";
        const normalizedRid = normalizeEntityIdLike(rid);
        const inSet =
          selectedSet.has(rid) ||
          (normalizedRid && selectedSet.has(normalizedRid)) ||
          (rid && selectedSet.has(`entity/${rid}`));
        const selected =
          inSet ||
          rid === selectedId ||
          (normalizedRid && normalizedRid === normalizedSelectedId);
        tr.classList.toggle("selected", selected);
      });
    } catch {}
  }

  function syncCheckboxStates() {
    try {
      if (!tblNodes) return;
      const checkboxes = tblNodes.querySelectorAll(".row-checkbox");
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
    const skipGraphFocus = opts.skipGraphFocus === true;
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
      window.kbTableSidebarHydratedId = "";
    }
    updateSelectedRowStyles();
    syncCheckboxStates();
    ensureTableSelectedButtonsState();
    if (!id && autoEdit && !skipSidebarSync) {
      try {
        if (typeof window.resetFormToAdd === "function") {
          window.resetFormToAdd();
        }
      } catch (e) {
        console.warn("reset form after deselect failed", e);
      }
    }
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
      if (!skipGraphFocus && window.kbViewMode === "vis" && id) {
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
        if (!autoEdit && typeof window.loadAttributes === "function") {
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
      const rows = getListItems();
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
    return getListItems();
  }

  function getTableListScrollContainer() {
    if (!tblNodes) return null;
    try {
      const wrap = tblNodes.closest(".tbl-wrap");
      return wrap || tblNodes;
    } catch {
      return tblNodes;
    }
  }

  function rememberTableListScrollPosition() {
    try {
      const scrollContainer = getTableListScrollContainer();
      const top = Number(scrollContainer?.scrollTop || 0);
      if (Number.isFinite(top)) {
        window.kbTableListScrollTop = Math.max(0, top);
      }
    } catch {}
  }

  function ensureTableListScrollTracking() {
    const scrollContainer = getTableListScrollContainer();
    if (!scrollContainer) return;

    if (
      tableListScrollHost &&
      tableListScrollHost !== scrollContainer &&
      tableListScrollHandler
    ) {
      try {
        tableListScrollHost.removeEventListener(
          "scroll",
          tableListScrollHandler,
        );
      } catch {}
      tableListScrollHost = null;
    }

    if (tableListScrollHost === scrollContainer) return;

    tableListScrollHandler = () => {
      rememberTableListScrollPosition();
    };
    scrollContainer.addEventListener("scroll", tableListScrollHandler, {
      passive: true,
    });
    tableListScrollHost = scrollContainer;
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
      const link = target.querySelector(".table-feed-name");
      if (link && link.href) {
        href = link.href;
      }
    }
    if (!href) {
      const label = target
        ? target.querySelector(".table-feed-name")?.textContent || ""
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

  function normalizeStringList(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean);
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => String(item || "").trim())
            .filter(Boolean);
        }
      } catch {}
      return trimmed
        .split(/[\n,，;；、|]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  }

  function toNonNegativeInt(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.floor(num));
  }

  function getNodeEngagementState(node) {
    const topLevelEngagement =
      node && typeof node.engagement === "object" ? node.engagement : null;
    const socialEngagement =
      node &&
      node.social &&
      typeof node.social === "object" &&
      node.social.engagement &&
      typeof node.social.engagement === "object"
        ? node.social.engagement
        : null;
    const source = topLevelEngagement || socialEngagement || {};
    const topLevelComments = normalizeStringList(node?.comments);
    const socialComments = normalizeStringList(node?.social?.comments);
    const commentsCount = Math.max(
      toNonNegativeInt(source.comments),
      topLevelComments.length,
      socialComments.length,
    );
    return {
      likes: toNonNegativeInt(source.likes),
      comments: commentsCount,
      shares: toNonNegativeInt(source.shares),
      commentViews: toNonNegativeInt(source.commentViews),
    };
  }

  function applyNodeEngagementState(node, engagement) {
    if (!node || !engagement || typeof engagement !== "object") return;
    const normalized = {
      likes: toNonNegativeInt(engagement.likes),
      comments: toNonNegativeInt(engagement.comments),
      shares: toNonNegativeInt(engagement.shares),
      commentViews: toNonNegativeInt(engagement.commentViews),
    };
    node.engagement = normalized;
    if (!node.social || typeof node.social !== "object") {
      node.social = {};
    }
    node.social.engagement = normalized;
  }

  function updateFooterEngagementCounts(footer, engagement) {
    if (!footer) return;
    const likeCount = footer.querySelector('[data-action="like"] span');
    const commentCount = footer.querySelector('[data-action="comment"] span');
    const shareCount = footer.querySelector('[data-action="share"] span');
    if (likeCount)
      likeCount.textContent = String(toNonNegativeInt(engagement.likes));
    if (commentCount)
      commentCount.textContent = String(toNonNegativeInt(engagement.comments));
    if (shareCount)
      shareCount.textContent = String(toNonNegativeInt(engagement.shares));
  }

  async function requestNodeEngagement(nodeId, action) {
    const url = appendCurrentDbToUrl(
      new URL("/api/kb/nodes/engagement", window.location.origin),
    );
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: nodeId, action }),
    });
    if (!resp.ok) {
      let detail = "";
      try {
        const data = await resp.json();
        detail = data?.error || data?.detail || "";
      } catch {}
      throw new Error(`HTTP ${resp.status}${detail ? `: ${detail}` : ""}`);
    }
    return await resp.json();
  }

  function resolveNodeComments(node, apiComments) {
    const preferred = Array.isArray(apiComments)
      ? apiComments
      : normalizeStringList(node?.comments);
    if (preferred.length) return preferred;
    const socialComments = normalizeStringList(node?.social?.comments);
    if (socialComments.length) return socialComments;
    return [];
  }

  async function handleEngagementAction(node, action, footer) {
    const nodeId = String(node?._id || node?.id || "").trim();
    if (!nodeId) return;
    const resp = await requestNodeEngagement(nodeId, action);
    const engagement = {
      ...getNodeEngagementState(node),
      ...(resp?.engagement && typeof resp.engagement === "object"
        ? resp.engagement
        : {}),
    };
    applyNodeEngagementState(node, engagement);
    updateFooterEngagementCounts(footer, engagement);
  }

  async function handleCommentView(node, footer) {
    const nodeId = String(node?._id || node?.id || "").trim();
    if (!nodeId) return;
    const resp = await requestNodeEngagement(nodeId, "comment_view");
    const engagement = {
      ...getNodeEngagementState(node),
      ...(resp?.engagement && typeof resp.engagement === "object"
        ? resp.engagement
        : {}),
    };
    applyNodeEngagementState(node, engagement);
    updateFooterEngagementCounts(footer, engagement);

    const comments = resolveNodeComments(node, resp?.comments);
    const title = String(
      node?.label_zh || node?.label || node?.name || "该节点",
    ).trim();
    if (!comments.length) {
      alert(`【${title}】暂无评论\n当前仅支持评论查看（不可发布）`);
      return;
    }
    const preview = comments
      .slice(0, 8)
      .map((item, idx) => `${idx + 1}. ${String(item || "").trim()}`)
      .join("\n");
    const more =
      comments.length > 8 ? `\n... 还有 ${comments.length - 8} 条` : "";
    alert(`【${title}】评论（只读）\n${preview}${more}`);
  }

  // Collect images from relation attributes and node image-like fields for content media.
  function collectNodeImages(node) {
    const attrImages = normalizeStringList(node?._attr_images);
    const nodeImages = normalizeStringList(node?.images);
    const merged = [...attrImages, ...nodeImages]
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    return Array.from(new Set(merged)).reverse();
  }

  function collectNodeVideos(node) {
    const merged = [
      ...normalizeStringList(node?.videos),
      ...normalizeStringList(node?.video),
    ]
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    return Array.from(new Set(merged));
  }

  function collectNodeCovers(node) {
    const merged = [
      ...(Array.isArray(node?.covers)
        ? node.covers
        : normalizeStringList(node?.covers)),
      ...(Array.isArray(node?.cover)
        ? node.cover
        : normalizeStringList(node?.cover)),
    ].map((item) => String(item || "").trim());
    return merged;
  }

  function isAnimatedImageVideoUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) return false;
    return (
      /^data:video\//i.test(raw) ||
      /\.(mov|mp4|webm|ogg|m4v)(\?|#|$)/i.test(raw) ||
      /\/node-videos\//i.test(raw)
    );
  }

  function resolveMediaUrl(url) {
    try {
      return new URL(
        String(url || "").trim(),
        window.location.origin,
      ).toString();
    } catch {
      return String(url || "").trim();
    }
  }

  function formatRelativeTime(rawValue) {
    if (!rawValue) return "";
    const date = new Date(rawValue);
    if (Number.isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMinutes < 1) return "刚刚";
    if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} 小时前`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} 天前`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} 个月前`;
    const diffYears = Math.floor(diffMonths / 12);
    return `${diffYears} 年前`;
  }

  function openVideoLightbox(
    videoUrl,
    startTime,
    muted,
    videoList,
    startIndex,
  ) {
    window.kbVideoLightboxOpen = true;
    try {
      document.querySelectorAll(".table-feed-video").forEach((v) => {
        if (!v.paused) v.pause();
      });
    } catch {}

    const mediaList = Array.isArray(videoList)
      ? videoList.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const playableListRaw = mediaList.length
      ? mediaList
      : [String(videoUrl || "").trim()].filter(Boolean);
    const playableList = playableListRaw.map((item) => resolveMediaUrl(item));
    if (!playableList.length) {
      window.kbVideoLightboxOpen = false;
      return;
    }

    const initialIndex = Number.isFinite(startIndex)
      ? Math.max(0, Math.min(playableList.length - 1, Number(startIndex)))
      : Math.max(
          0,
          playableList.findIndex(
            (item) => item === resolveMediaUrl(String(videoUrl || "").trim()),
          ),
        );

    const overlay = document.createElement("div");
    overlay.className = "kb-lightbox-overlay kb-video-lightbox";

    const sourceUrl = playableList[initialIndex] || playableList[0] || "";
    const sourceTypeMatch = sourceUrl.split("?")[0].match(/\.([a-z0-9]+)$/i);
    const sourceType = sourceTypeMatch
      ? `video/${sourceTypeMatch[1].toLowerCase()}`
      : "";
    const video =
      typeof window.kbCreateVideoPlayer === "function"
        ? window.kbCreateVideoPlayer({
            src: sourceUrl,
            type: sourceType,
            autoplay: true,
            muted: muted === true,
            loop: true,
            preload: "auto",
            playsInline: true,
            controls: true,
            streamType: "on-demand",
            logLevel: "warn",
            className: "kb-lightbox-video kb-video-player",
          })
        : document.createElement("video");
    if (video.tagName === "VIDEO") {
      video.className = "kb-lightbox-video";
      video.controls = true;
      video.playsInline = true;
      video.muted = muted === true;
      video.loop = true;
      video.autoplay = true;
      video.preload = "auto";
      video.src = sourceUrl;
    }

    const counter = document.createElement("div");
    counter.className = "kb-lightbox-counter";

    let currentIndex = initialIndex;
    let player = null;

    const playCurrentVideo = () => {
      if (player && typeof player.play === "function") {
        return player.play();
      }
      return video.play();
    };

    const setVideoByIndex = (idx, options = {}) => {
      const { keepTime = false } = options;
      if (!playableList.length) return;
      currentIndex =
        ((idx % playableList.length) + playableList.length) %
        playableList.length;
      const nextSrc = playableList[currentIndex];
      if (video.src !== nextSrc) {
        video.src = nextSrc;
      }
      const nextTime =
        keepTime && Number.isFinite(startTime) && startTime > 0 ? startTime : 0;
      counter.textContent =
        playableList.length > 1
          ? `${currentIndex + 1} / ${playableList.length}`
          : "";
      try {
        video.currentTime = nextTime;
      } catch {}
      const playback = playCurrentVideo();
      if (playback && typeof playback.catch === "function") {
        playback.catch(() => {});
      }
    };

    overlay.appendChild(video);
    overlay.appendChild(counter);

    const closeBtn = document.createElement("button");
    closeBtn.className = "kb-lightbox-close";
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    const close = () => {
      try {
        video.pause();
      } catch {}
      try {
        if (typeof window.kbDestroyVideoPlayer === "function") {
          window.kbDestroyVideoPlayer(video);
        }
      } catch {}
      overlay.remove();
      window.kbVideoLightboxOpen = false;
      document.removeEventListener("keydown", onKey);
    };
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      close();
    });
    overlay.appendChild(closeBtn);

    if (playableList.length > 1) {
      const prev = document.createElement("button");
      prev.className = "kb-lightbox-btn kb-lightbox-prev";
      prev.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
      prev.addEventListener("click", (e) => {
        e.stopPropagation();
        setVideoByIndex(currentIndex - 1);
      });
      overlay.appendChild(prev);

      const next = document.createElement("button");
      next.className = "kb-lightbox-btn kb-lightbox-next";
      next.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
      next.addEventListener("click", (e) => {
        e.stopPropagation();
        setVideoByIndex(currentIndex + 1);
      });
      overlay.appendChild(next);
    }

    const onKey = (e) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key === "ArrowRight" && playableList.length > 1) {
        e.preventDefault();
        setVideoByIndex(currentIndex + 1);
        return;
      }
      if (e.key === "ArrowLeft" && playableList.length > 1) {
        e.preventDefault();
        setVideoByIndex(currentIndex - 1);
      }
    };
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    player = video;
    Promise.resolve(
      typeof window.kbEnsureVidstackReady === "function"
        ? window.kbEnsureVidstackReady()
        : true,
    ).finally(() => {
      setVideoByIndex(initialIndex, { keepTime: true });
    });
  }

  function scheduleTableSidebarSync(targetId) {
    const pendingId = String(targetId || "").trim();
    if (!pendingId) return;
    try {
      if (window.kbTableSidebarSyncTimer) {
        clearTimeout(window.kbTableSidebarSyncTimer);
      }
    } catch {}
    window.kbTablePendingSidebarNodeId = pendingId;
    window.kbTableSidebarSyncTimer = setTimeout(async () => {
      try {
        if ((window.kbViewMode || "table") !== "table") return;
        const stablePendingId = String(
          window.kbTablePendingSidebarNodeId || "",
        ).trim();
        if (!stablePendingId || stablePendingId !== pendingId) return;
        const currentFormId = String(
          document.getElementById("fId")?.value || "",
        ).trim();
        const normalizedPendingId = normalizeEntityIdLike(stablePendingId);
        const normalizedFormId = normalizeEntityIdLike(currentFormId);
        const normalizedHydratedId = normalizeEntityIdLike(
          window.kbTableSidebarHydratedId || "",
        );
        if (
          normalizedHydratedId === normalizedPendingId &&
          normalizedFormId === normalizedPendingId
        ) {
          return;
        }
        if (typeof enterEditById === "function") {
          await enterEditById(stablePendingId, { skipGraphFocus: true });
          window.kbTableSidebarHydratedId = stablePendingId;
          window.kbSelectionHydrated = true;
        }
      } catch (err) {
        console.warn("table sidebar sync failed", err);
      }
    }, 80);
  }

  function buildPreviewVideoElement(node, videoUrls, posterSource) {
    const mediaList = Array.isArray(videoUrls)
      ? videoUrls.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const strip = document.createElement("div");
    strip.className = "table-feed-video-strip";
    if (!mediaList.length) return strip;

    const videoElements = [];
    let activeIndex = -1;

    const pauseAllInStrip = () => {
      videoElements.forEach((v) => {
        if (!v.paused) v.pause();
      });
    };

    const playByIndex = (idx, options = {}) => {
      const { resetTime = false } = options;
      if (!videoElements.length) return;
      const nextIndex =
        ((idx % videoElements.length) + videoElements.length) %
        videoElements.length;
      const target = videoElements[nextIndex];
      if (!target) return;
      activeIndex = nextIndex;
      videoElements.forEach((v, i) => {
        if (i !== nextIndex && !v.paused) v.pause();
      });
      if (resetTime) target.currentTime = 0;
      target.play().catch(() => {});
      try {
        target.closest(".table-feed-video-item-wrap")?.scrollIntoView({
          behavior: "smooth",
          inline: "nearest",
          block: "nearest",
        });
      } catch {}
    };

    strip.__playCurrentOrFirst = () => {
      if (activeIndex >= 0 && videoElements[activeIndex]) {
        playByIndex(activeIndex);
      } else {
        playByIndex(0);
      }
    };
    strip.__pauseAll = pauseAllInStrip;

    const posterList = Array.isArray(posterSource)
      ? posterSource.map((item) => String(item || "").trim())
      : String(posterSource || "").trim()
        ? [String(posterSource || "").trim()]
        : [];

    mediaList.forEach((videoUrl, index) => {
      const itemWrap = document.createElement("div");
      itemWrap.className = "table-feed-video-item-wrap";

      const video = document.createElement("video");
      video.className = "table-feed-video";
      if (index === 0) video.classList.add("table-feed-video-observe");
      video.src = videoUrl;
      video.controls = false;
      // 列表场景优先滚动流畅度，按需加载媒体元数据
      video.preload = "none";
      video.playsInline = true;
      video.muted = false;
      video.loop = false;
      const posterUrl = posterList[index] || "";
      if (posterUrl) video.poster = posterUrl;

      const badge = document.createElement("span");
      badge.className = "table-feed-video-badge";
      badge.textContent = `${index + 1}/${mediaList.length}`;

      const muteBtn = document.createElement("button");
      muteBtn.type = "button";
      muteBtn.className = "table-feed-mute-btn";
      muteBtn.title = "静音/取消静音";
      muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
      muteBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        video.muted = !video.muted;
        muteBtn.innerHTML = video.muted
          ? '<i class="fa-solid fa-volume-xmark"></i>'
          : '<i class="fa-solid fa-volume-high"></i>';
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "table-feed-img-delete-btn";
      delBtn.title = "删除视频";
      delBtn.textContent = "×";
      delBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await deleteNodeVideo(node, videoUrl);
        } catch (err) {
          alert("删除视频失败: " + (err?.message || err));
        }
      });

      itemWrap.tabIndex = 0;
      itemWrap.setAttribute(
        "aria-label",
        `视频 ${index + 1}/${mediaList.length}，点击播放/暂停，双击放大`,
      );

      let clickTimer = null;
      itemWrap.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (clickTimer) return;
        clickTimer = setTimeout(() => {
          clickTimer = null;
          if (video.paused) {
            document.querySelectorAll(".table-feed-video").forEach((v) => {
              if (v !== video && !v.paused) v.pause();
            });
            activeIndex = index;
            video.play().catch(() => {});
          } else {
            video.pause();
          }
          itemWrap.focus();
        }, 220);
      });

      itemWrap.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
        }
        openVideoLightbox(
          videoUrl,
          video.currentTime,
          video.muted,
          mediaList,
          index,
        );
      });

      itemWrap.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          e.stopPropagation();
          video.currentTime = Math.min(
            video.duration || 0,
            video.currentTime + 5,
          );
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          e.stopPropagation();
          video.currentTime = Math.max(0, video.currentTime - 5);
        } else if (e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          if (video.paused) {
            activeIndex = index;
            playByIndex(index);
          } else {
            video.pause();
          }
        }
      });

      video.addEventListener("play", () => {
        activeIndex = index;
        videoElements.forEach((other, i) => {
          if (i !== index && !other.paused) other.pause();
        });
      });

      video.addEventListener("ended", () => {
        playByIndex(index + 1, { resetTime: true });
      });

      video.addEventListener("contextmenu", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nodeId = String(node?._id || node?.id || "").trim();
        showVideoContextMenu(e.clientX, e.clientY, async () => {
          await setVideoFrameAsNodeCover(nodeId, video, node);
          if (typeof window.setStatus === "function") {
            window.setStatus(false, "已将当前帧设为封面");
          }
        });
      });

      itemWrap.appendChild(video);
      itemWrap.appendChild(badge);
      itemWrap.appendChild(muteBtn);
      itemWrap.appendChild(delBtn);
      strip.appendChild(itemWrap);
      videoElements.push(video);
    });

    return strip;
  }

  function openImageLightbox(imageList, startIndex) {
    let current = startIndex || 0;

    const overlay = document.createElement("div");
    overlay.className = "kb-lightbox-overlay";

    let mediaEl = null;
    let mediaPlayer = null;

    const counter = document.createElement("div");
    counter.className = "kb-lightbox-counter";

    const setImage = (idx) => {
      current = (idx + imageList.length) % imageList.length;
      const mediaUrl = resolveMediaUrl(imageList[current]);
      const isVideo = isAnimatedImageVideoUrl(mediaUrl);
      const existingLiveTag = overlay.querySelector(".kb-lightbox-live-badge");
      if (existingLiveTag) existingLiveTag.remove();
      if (mediaEl) {
        try {
          if (typeof mediaEl.pause === "function") mediaEl.pause();
        } catch {}
        try {
          if (mediaPlayer && typeof window.kbDestroyVideoPlayer === "function") {
            window.kbDestroyVideoPlayer(mediaEl);
          }
        } catch {}
        mediaPlayer = null;
        mediaEl.remove();
      }
      if (isVideo) {
        const sourceTypeMatch = mediaUrl.split("?")[0].match(/\.([a-z0-9]+)$/i);
        const sourceType = sourceTypeMatch
          ? `video/${sourceTypeMatch[1].toLowerCase()}`
          : "";
        mediaEl =
          typeof window.kbCreateVideoPlayer === "function"
            ? window.kbCreateVideoPlayer({
                src: mediaUrl,
                type: sourceType,
                autoplay: true,
                muted: true,
                loop: true,
                preload: "auto",
                playsInline: true,
                controls: true,
                streamType: "on-demand",
                logLevel: "warn",
                className: "kb-lightbox-video kb-live-media kb-video-player",
              })
            : document.createElement("video");
        if (mediaEl.tagName === "VIDEO") {
          mediaEl.className = "kb-lightbox-video kb-live-media";
          mediaEl.src = mediaUrl;
          mediaEl.autoplay = true;
          mediaEl.loop = true;
          mediaEl.muted = true;
          mediaEl.playsInline = true;
          mediaEl.controls = true;
        }
        const liveTag = document.createElement("span");
        liveTag.className = "kb-live-badge kb-lightbox-live-badge";
        liveTag.textContent = "LIVE";
        overlay.appendChild(liveTag);
      } else {
        const img = document.createElement("img");
        img.className = "kb-lightbox-img";
        img.src = mediaUrl;
        mediaEl = img;
      }
      overlay.appendChild(mediaEl);
      if (isVideo) {
        mediaPlayer = mediaEl;
        Promise.resolve(
          typeof window.kbEnsureVidstackReady === "function"
            ? window.kbEnsureVidstackReady()
            : true,
        ).finally(() => {
          try {
            if (mediaPlayer && typeof mediaPlayer.play === "function") {
              const playback = mediaPlayer.play();
              if (playback && typeof playback.catch === "function") {
                playback.catch(() => {});
              }
            }
          } catch {}
        });
      }
      counter.textContent =
        imageList.length > 1 ? `${current + 1} / ${imageList.length}` : "";
    };

    const close = () => {
      try {
        if (mediaEl && typeof mediaEl.pause === "function") mediaEl.pause();
      } catch {}
      try {
        if (mediaEl && mediaPlayer && typeof window.kbDestroyVideoPlayer === "function") {
          window.kbDestroyVideoPlayer(mediaEl);
        }
      } catch {}
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    };

    const onKey = (e) => {
      if (e.key === "Escape") {
        close();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setImage(current + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setImage(current - 1);
      }
    };

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    if (imageList.length > 1) {
      const prev = document.createElement("button");
      prev.className = "kb-lightbox-btn kb-lightbox-prev";
      prev.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
      prev.addEventListener("click", (e) => {
        e.stopPropagation();
        setImage(current - 1);
      });

      const next = document.createElement("button");
      next.className = "kb-lightbox-btn kb-lightbox-next";
      next.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
      next.addEventListener("click", (e) => {
        e.stopPropagation();
        setImage(current + 1);
      });

      overlay.appendChild(prev);
      overlay.appendChild(next);
    }

    const closeBtn = document.createElement("button");
    closeBtn.className = "kb-lightbox-close";
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      close();
    });

    overlay.appendChild(counter);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onKey);
    setImage(current);
  }

  async function deleteNodeImage(node, imageUrl) {
    const nodeId = String(node?._id || node?.id || "").trim();
    if (!nodeId) return;
    const currentImages = (
      Array.isArray(node.images) ? node.images : []
    ).filter((v) => String(v || "").trim() && v !== imageUrl);
    const url = appendCurrentDbToUrl(
      new URL("/api/kb/nodes/update", window.location.origin),
    );
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: nodeId, images: currentImages }),
    });
    if (!resp.ok) {
      let detail = "";
      try {
        const d = await resp.json();
        detail = d?.error || d?.detail || "";
      } catch {}
      throw new Error(`HTTP ${resp.status}${detail ? `: ${detail}` : ""}`);
    }
    node.images = currentImages;
    node.image = currentImages[0] || "";
    const normalizeId = (v) =>
      String(v || "")
        .trim()
        .replace(/^entity\//, "");
    const updateList = (list) => {
      if (!Array.isArray(list)) return;
      const item = list.find(
        (it) => normalizeId(it?._id || it?.id) === normalizeId(nodeId),
      );
      if (!item) return;
      item.images = currentImages;
      item.image = currentImages[0] || "";
    };
    updateList(window.kbTableNodes);
    updateList(window.kbShortsNodes);
    if (typeof window.renderTableList === "function") window.renderTableList();
  }

  async function deleteNodeVideo(node, videoUrl) {
    const nodeId = String(node?._id || node?.id || "").trim();
    if (!nodeId) return;

    const currentVideos = normalizeStringList(node?.videos).filter(
      (v) => String(v || "").trim() && v !== videoUrl,
    );

    const url = appendCurrentDbToUrl(
      new URL("/api/kb/nodes/update", window.location.origin),
    );
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: nodeId, videos: currentVideos }),
    });
    if (!resp.ok) {
      let detail = "";
      try {
        const d = await resp.json();
        detail = d?.error || d?.detail || "";
      } catch {}
      throw new Error(`HTTP ${resp.status}${detail ? `: ${detail}` : ""}`);
    }

    node.videos = currentVideos;
    node.video = currentVideos[0] || "";
    const normalizeId = (v) =>
      String(v || "")
        .trim()
        .replace(/^entity\//, "");
    const updateList = (list) => {
      if (!Array.isArray(list)) return;
      const item = list.find(
        (it) => normalizeId(it?._id || it?.id) === normalizeId(nodeId),
      );
      if (!item) return;
      item.videos = currentVideos;
      item.video = currentVideos[0] || "";
    };
    updateList(window.kbTableNodes);
    updateList(window.kbShortsNodes);
    if (typeof window.renderTableList === "function") window.renderTableList();
  }

  function captureVideoFrameDataUrl(videoEl) {
    if (!(videoEl instanceof HTMLVideoElement)) {
      throw new Error("视频元素无效");
    }
    const width = Number(videoEl.videoWidth || 0);
    const height = Number(videoEl.videoHeight || 0);
    if (!width || !height) {
      throw new Error("视频尚未加载到可截帧状态");
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("无法创建封面画布");
    }
    ctx.drawImage(videoEl, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.82);
  }

  function ensureArrayLength(array, length, fill = "") {
    const next = Array.isArray(array) ? [...array] : [];
    while (next.length < length) {
      next.push(fill);
    }
    return next;
  }

  function applyCoverToNodeRecord(node, coverData, targetVideoUrl) {
    if (!node || !coverData) return;

    const currentVideos = normalizeStringList(node?.videos);
    let nextCovers = normalizeStringList(node?.covers);
    const normalizedTargetVideoUrl = String(targetVideoUrl || "").trim();
    const normalizedTargetVideoKey =
      normalizedTargetVideoUrl && resolveMediaUrl(normalizedTargetVideoUrl);

    if (normalizedTargetVideoUrl && currentVideos.length > 0) {
      const targetIndex = currentVideos.findIndex((item) => {
        const normalizedItem = resolveMediaUrl(String(item || "").trim());
        return normalizedItem === normalizedTargetVideoKey;
      });
      if (targetIndex >= 0) {
        nextCovers = nextCovers.filter((item) => item !== coverData);
        nextCovers = ensureArrayLength(nextCovers, currentVideos.length, "");
        nextCovers[targetIndex] = coverData;
        node.covers = nextCovers;
        node.cover = nextCovers[0] || "";
        return;
      }
    }

    nextCovers = [
      coverData,
      ...nextCovers.filter((item) => item !== coverData),
    ];
    node.covers = nextCovers;
    node.cover = nextCovers[0] || "";
  }

  async function setVideoFrameAsNodeCover(nodeId, videoEl, nodeRef) {
    const rawId = String(nodeId || "").trim();
    if (!rawId) throw new Error("缺少节点ID");
    const coverData = captureVideoFrameDataUrl(videoEl);
    const normalizedId = rawId.replace(/^entity\//, "");

    const currentNode =
      nodeRef ||
      getTableNodeById(normalizedId) ||
      getTableNodeById(rawId) ||
      null;
    const existingVideos = normalizeStringList(currentNode?.videos);
    const existingCovers = normalizeStringList(currentNode?.covers);
    const videoUrl = String(videoEl.currentSrc || videoEl.src || "").trim();
    const normalizedVideoUrl = videoUrl ? resolveMediaUrl(videoUrl) : "";
    let nextCovers = [];

    if (normalizedVideoUrl) {
      const targetIndex = existingVideos.findIndex((item) => {
        const normalizedItem = resolveMediaUrl(String(item || "").trim());
        return normalizedItem === normalizedVideoUrl;
      });
      if (targetIndex >= 0) {
        nextCovers = ensureArrayLength(
          existingCovers,
          existingVideos.length,
          "",
        );
        nextCovers[targetIndex] = coverData;
      } else {
        nextCovers = [
          coverData,
          ...existingCovers.filter((item) => item !== coverData),
        ];
      }
    } else {
      nextCovers = [
        coverData,
        ...existingCovers.filter((item) => item !== coverData),
      ];
    }

    const url = appendCurrentDbToUrl(
      new URL("/api/kb/nodes/update", window.location.origin),
    );
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: normalizedId, covers: nextCovers }),
    });
    let responseNode = null;
    if (!resp.ok) {
      let detail = "";
      try {
        const d = await resp.json();
        detail = d?.error || d?.detail || "";
      } catch {}
      throw new Error(`HTTP ${resp.status}${detail ? `: ${detail}` : ""}`);
    } else {
      try {
        const data = await resp.json();
        if (data && data.ok === false) {
          throw new Error(String(data.error || data.detail || "保存失败"));
        }
        responseNode =
          data?.node && typeof data.node === "object" ? data.node : null;
      } catch (err) {
        if (String(err?.message || "").trim()) {
          throw err;
        }
      }
    }

    if (responseNode) {
      Object.assign(currentNode || {}, responseNode);
    } else {
      applyCoverToNodeRecord(currentNode, coverData, videoUrl);
    }

    const normalizeId = (v) =>
      String(v || "")
        .trim()
        .replace(/^entity\//, "");
    const updateList = (list) => {
      if (!Array.isArray(list)) return;
      const item = list.find(
        (it) => normalizeId(it?._id || it?.id) === normalizeId(normalizedId),
      );
      if (!item) return;
      if (responseNode) {
        Object.assign(item, responseNode);
      } else {
        applyCoverToNodeRecord(item, coverData, videoUrl);
      }
    };
    updateList(window.kbTableNodes);
    updateList(window.kbShortsNodes);

    try {
      videoEl.poster = coverData;
    } catch {}
  }

  function hideVideoContextMenu(event) {
    if (!videoContextMenuEl) return;
    if (
      event &&
      event.target instanceof Node &&
      videoContextMenuEl.contains(event.target)
    ) {
      return;
    }
    videoContextMenuEl.style.display = "none";
    videoContextMenuAction = null;
  }

  function ensureVideoContextMenu() {
    if (videoContextMenuEl && videoContextMenuActionEl) {
      return videoContextMenuEl;
    }

    const menu = document.createElement("div");
    menu.className = "kb-video-context-menu";
    menu.style.display = "none";

    const actionBtn = document.createElement("button");
    actionBtn.type = "button";
    actionBtn.className = "kb-video-context-menu-item";
    actionBtn.innerHTML =
      '<i class="fa-regular fa-image"></i><span>设为封面</span>';
    actionBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const action = videoContextMenuAction;
      hideVideoContextMenu();
      if (typeof action !== "function") return;
      try {
        await action();
      } catch (err) {
        alert("设置封面失败: " + (err?.message || err));
      }
    });

    menu.appendChild(actionBtn);
    menu.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    document.body.appendChild(menu);

    videoContextMenuEl = menu;
    videoContextMenuActionEl = actionBtn;

    document.addEventListener("click", hideVideoContextMenu);
    document.addEventListener("scroll", hideVideoContextMenu, true);
    window.addEventListener("resize", hideVideoContextMenu, { passive: true });

    return menu;
  }

  function showVideoContextMenu(x, y, action) {
    const menu = ensureVideoContextMenu();
    videoContextMenuAction = typeof action === "function" ? action : null;
    menu.style.display = "block";
    menu.style.left = "0px";
    menu.style.top = "0px";

    const menuWidth = Number(menu.offsetWidth || 180);
    const menuHeight = Number(menu.offsetHeight || 44);
    const maxLeft = Math.max(0, window.innerWidth - menuWidth - 8);
    const maxTop = Math.max(0, window.innerHeight - menuHeight - 8);
    const left = Math.max(8, Math.min(Number(x || 0), maxLeft));
    const top = Math.max(8, Math.min(Number(y || 0), maxTop));

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function buildImageStripElement(node, imageList) {
    const strip = document.createElement("div");
    strip.className = "table-feed-img-strip";
    imageList.forEach((imageUrl, index) => {
      const mediaUrl = resolveMediaUrl(imageUrl);
      const isVideoMedia = isAnimatedImageVideoUrl(mediaUrl);
      const wrap = document.createElement("div");
      wrap.className = "table-feed-img-strip-item-wrap";

      const item = document.createElement("button");
      item.type = "button";
      item.className = "table-feed-img-strip-item";
      item.title = "放大查看";
      item.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openImageLightbox(imageList, index);
      });
      if (isVideoMedia) {
        const video = document.createElement("video");
        video.classList.add("kb-live-media");
        video.autoplay = false;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.controls = false;
        video.preload = "metadata";
        video.src = mediaUrl;
        item.appendChild(video);

        const liveTag = document.createElement("span");
        liveTag.className = "kb-live-badge";
        liveTag.textContent = "LIVE";
        wrap.appendChild(liveTag);
      } else {
        const img = document.createElement("img");
        img.alt =
          node?.label_zh || node?.label || node?.name || `图片 ${index + 1}`;
        img.loading = "lazy";
        img.src = mediaUrl;
        item.appendChild(img);
      }

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "table-feed-img-delete-btn";
      delBtn.title = "删除图片";
      delBtn.textContent = "×";
      delBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await deleteNodeImage(node, imageUrl);
        } catch (err) {
          alert("删除图片失败: " + (err?.message || err));
        }
      });

      wrap.appendChild(item);
      wrap.appendChild(delBtn);
      strip.appendChild(wrap);
    });
    return strip;
  }

  function buildMixedMediaStripElement(node, imageList, videoList, coverList) {
    const imageSources = Array.isArray(imageList)
      ? imageList.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const videoSources = Array.isArray(videoList)
      ? videoList.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const posterList = Array.isArray(coverList)
      ? coverList.map((item) => String(item || "").trim())
      : [];
    const mediaItems = [
      ...videoSources.map((src, index) => ({
        src,
        type: "video",
        index,
        poster: posterList[index] || "",
      })),
      ...imageSources.map((src, index) => ({ src, type: "image", index })),
    ];

    const grid = document.createElement("div");
    grid.className = "table-feed-media-collage";
    grid.dataset.count = String(Math.min(mediaItems.length, 4));
    if (mediaItems.some((item) => item.type === "video")) {
      grid.classList.add("has-video");
    }
    if (mediaItems.length > 1) {
      grid.classList.add("is-scroll-strip");
    }
    if (mediaItems.length === 1 && mediaItems[0]?.type === "video") {
      grid.classList.add("single-video");
    }
    if (!mediaItems.length) return grid;

    const visibleItems = mediaItems.length > 1 ? mediaItems : mediaItems.slice(0, 4);
    const hiddenCount =
      mediaItems.length > 1 ? 0 : Math.max(0, mediaItems.length - visibleItems.length);

    visibleItems.forEach((item, visibleIndex) => {
      const cell = document.createElement("div");
      cell.className = `table-feed-media-collage-item is-${item.type}`;

      if (item.type === "video") {
        const video = document.createElement("video");
        video.className = "table-feed-video";
        if (visibleIndex === 0) video.classList.add("table-feed-video-observe");
        video.src = resolveMediaUrl(item.src);
        video.controls = false;
        video.preload = mediaItems.length === 1 ? "metadata" : "none";
        video.playsInline = true;
        video.muted = true;
        video.loop = true;
        if (item.poster) video.poster = resolveMediaUrl(item.poster);
        const applyVideoRatio = () => {
          const width = Number(video.videoWidth || 0);
          const height = Number(video.videoHeight || 0);
          if (!width || !height) return;
          if (mediaItems.length === 1) {
            cell.style.aspectRatio = `${width} / ${height}`;
            grid.style.aspectRatio = `${width} / ${height}`;
            cell.style.width = "fit-content";
          }
        };
        video.addEventListener("loadedmetadata", applyVideoRatio, {
          once: true,
        });
        if (video.readyState >= 1) applyVideoRatio();

        const playBadge = document.createElement("button");
        playBadge.type = "button";
        playBadge.className = "table-feed-media-play-badge is-position-pending";
        playBadge.title = "播放视频";
        playBadge.setAttribute("aria-label", "播放视频");
        playBadge.innerHTML = '<i class="fa-solid fa-play"></i>';

        const syncVideoPlayBadgePosition = () => {
          if (mediaItems.length > 1) {
            playBadge.style.left = "50%";
            playBadge.style.top = "50%";
            playBadge.classList.remove("is-position-pending");
            return;
          }
          const box = cell.getBoundingClientRect();
          const width = Number(video.videoWidth || 0);
          const height = Number(video.videoHeight || 0);
          if (!box.width || !box.height || !width || !height) return;
          const mediaRatio = width / height;
          const boxRatio = box.width / box.height;
          let renderedWidth = box.width;
          let renderedHeight = box.height;
          if (boxRatio > mediaRatio) {
            renderedWidth = box.height * mediaRatio;
          } else {
            renderedHeight = box.width / mediaRatio;
          }
          playBadge.style.left = `${renderedWidth / 2}px`;
          playBadge.style.top = `${
            (box.height - renderedHeight) / 2 + renderedHeight / 2
          }px`;
          playBadge.classList.remove("is-position-pending");
        };
        video.addEventListener("loadedmetadata", syncVideoPlayBadgePosition);
        video.addEventListener("loadeddata", syncVideoPlayBadgePosition);
        if (mediaItems.length === 1) {
          window.addEventListener("resize", syncVideoPlayBadgePosition, {
            passive: true,
          });
          if (typeof ResizeObserver === "function") {
            const observer = new ResizeObserver(syncVideoPlayBadgePosition);
            observer.observe(cell);
          }
        }
        requestAnimationFrame(syncVideoPlayBadgePosition);

        const syncPlayBadge = () => {
          const isPaused = video.paused || video.ended;
          playBadge.title = isPaused ? "播放视频" : "暂停视频";
          playBadge.setAttribute("aria-label", isPaused ? "播放视频" : "暂停视频");
          playBadge.innerHTML = isPaused
            ? '<i class="fa-solid fa-play"></i>'
            : '<i class="fa-solid fa-pause"></i>';
          playBadge.classList.toggle("is-playing", !isPaused);
        };

        const toggleVideoPlayback = () => {
          document.querySelectorAll(".table-feed-video").forEach((v) => {
            if (v !== video && !v.paused) v.pause();
          });
          if (video.paused || video.ended) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
          syncPlayBadge();
        };
        video.addEventListener("play", syncPlayBadge);
        video.addEventListener("pause", syncPlayBadge);
        video.addEventListener("ended", syncPlayBadge);
        playBadge.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleVideoPlayback();
        });

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "table-feed-img-delete-btn";
        delBtn.title = "删除视频";
        delBtn.textContent = "×";
        delBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            await deleteNodeVideo(node, item.src);
          } catch (err) {
            alert("删除视频失败: " + (err?.message || err));
          }
        });

        let clickTimer = null;
        cell.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (clickTimer) return;
          clickTimer = setTimeout(() => {
            clickTimer = null;
            toggleVideoPlayback();
          }, 220);
        });
        cell.addEventListener("dblclick", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
          }
          openVideoLightbox(
            item.src,
            video.currentTime,
            false,
            videoSources,
            item.index,
          );
        });

        cell.appendChild(video);
        cell.appendChild(playBadge);
        cell.appendChild(delBtn);
      } else {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "table-feed-media-image-btn";
        button.title = "放大查看";
        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openImageLightbox(imageSources, item.index);
        });
        const img = document.createElement("img");
        const imageUrl = resolveMediaUrl(item.src);
        img.alt =
          node?.label_zh || node?.label || node?.name || `图片 ${item.index + 1}`;
        img.loading = "lazy";
        img.decoding = "async";
        img.src = imageUrl;
        const applyImageRatio = () => {
          const width = Number(img.naturalWidth || 0);
          const height = Number(img.naturalHeight || 0);
          if (!width || !height) return;
          const ratio = width / height;
          if (ratio > 0.34 && ratio < 3.2) {
            cell.style.aspectRatio = `${width} / ${height}`;
            if (mediaItems.length === 1) {
              grid.style.aspectRatio = `${width} / ${height}`;
            }
          }
        };
        img.addEventListener("load", applyImageRatio, { once: true });
        if (img.complete) applyImageRatio();
        button.appendChild(img);

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "table-feed-img-delete-btn";
        delBtn.title = "删除图片";
        delBtn.textContent = "×";
        delBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            await deleteNodeImage(node, item.src);
          } catch (err) {
            alert("删除图片失败: " + (err?.message || err));
          }
        });

        cell.appendChild(button);
        cell.appendChild(delBtn);
      }

      if (hiddenCount > 0 && visibleIndex === visibleItems.length - 1) {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "table-feed-media-more";
        more.textContent = `+${hiddenCount}`;
        more.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (item.type === "video") {
            openVideoLightbox(item.src, 0, false, videoSources, item.index);
          } else {
            openImageLightbox(imageSources, item.index);
          }
        });
        cell.appendChild(more);
      }

      grid.appendChild(cell);
    });

    return grid;
  }

  function buildGridMediaElement(node, imageList, videoList, coverList) {
    const element = document.createElement("div");
    element.className = "table-feed-grid-media";

    const imageSources = [];
    const videoSources = [];
    if (Array.isArray(imageList)) {
      imageList.forEach((item) => {
        const src = String(item || "").trim();
        if (!src) return;
        if (isAnimatedImageVideoUrl(src)) {
          videoSources.push(src);
        } else {
          imageSources.push(src);
        }
      });
    }
    if (Array.isArray(videoList)) {
      videoList.forEach((item) => {
        const src = String(item || "").trim();
        if (!src) return;
        videoSources.push(src);
      });
    }

    const mediaItems = [
      ...imageSources.map((src, idx) => ({ src, type: "image", index: idx })),
      ...videoSources.map((src, idx) => ({ src, type: "video", index: idx })),
    ];

    if (!mediaItems.length) return element;

    const normalizedCoverList = Array.isArray(coverList)
      ? coverList.map((item) => String(item || "").trim())
      : [];

    const mediaView = document.createElement("div");
    mediaView.className = "table-feed-grid-media-view";
    element.appendChild(mediaView);

    const track = document.createElement("div");
    track.className = "table-feed-carousel-track";
    mediaView.appendChild(track);

    const badge = document.createElement("span");
    badge.className = "table-feed-video-badge";
    element.appendChild(badge);

    const controls = document.createElement("div");
    controls.className = "table-feed-carousel-controls";
    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "table-feed-carousel-btn";
    prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "table-feed-carousel-btn";
    nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    controls.appendChild(prevBtn);
    controls.appendChild(nextBtn);
    element.appendChild(controls);

    const loadGridSlideMedia = (slide) => {
      if (!slide || slide.dataset.mediaLoaded === "1") return;
      try {
        const img = slide.querySelector("img[data-src]");
        if (img) {
          const markLoaded = () => img.classList.add("is-loaded");
          img.addEventListener("load", markLoaded, { once: true });
          img.addEventListener("error", markLoaded, { once: true });
          img.src = img.dataset.src || "";
          img.removeAttribute("data-src");
          if (img.complete) markLoaded();
        }
        const video = slide.querySelector("video[data-src]");
        if (video) {
          video.src = video.dataset.src || "";
          video.removeAttribute("data-src");
        }
      } catch {}
      slide.dataset.mediaLoaded = "1";
    };

    const loadGridSlideAt = (index) => {
      const slides = track.children;
      const current = slides[index];
      if (current) loadGridSlideMedia(current);
      const next = slides[index + 1];
      if (next) loadGridSlideMedia(next);
    };

    const createMediaSlide = (item, mediaIndex) => {
      const slide = document.createElement("div");
      slide.className = "table-feed-carousel-slide";
      slide.dataset.mediaLoaded = "0";
      slide.style.minWidth = "100%";
      slide.style.flex = "0 0 100%";
      slide.style.position = "relative";

      if (item.type === "video") {
        const coverUrl = String(normalizedCoverList[item.index] || "").trim();
        const wrap = document.createElement("div");
        wrap.className = "table-feed-video-wrap";
        wrap.style.width = "100%";
        const video = document.createElement("video");
        video.className = "table-feed-video";
        video.dataset.src = resolveMediaUrl(item.src);
        video.preload = mediaIndex === 0 ? "auto" : "metadata";
        video.playsInline = true;
        video.muted = true;
        video.loop = true;
        video.controls = false;
        if (coverUrl) {
          video.poster = resolveMediaUrl(coverUrl);
        }
        wrap.appendChild(video);
        wrap.addEventListener("mouseenter", () => {
          try {
            if (video.dataset.src && !video.src) {
              video.src = video.dataset.src;
              video.removeAttribute("data-src");
            }
            video.preload = "auto";
            video.load();
          } catch {}
        });
        let openTimer = null;
        wrap.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (openTimer) clearTimeout(openTimer);
          openTimer = setTimeout(() => {
            openTimer = null;
            const row = wrap.closest(".entity-list-item.table-feed-row");
            const rid = String(row?.getAttribute("data-id") || "").trim();
            if (row && rid) performTableRowSelection(row, rid, e);
          }, 220);
        });
        wrap.addEventListener("dblclick", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (openTimer) {
            clearTimeout(openTimer);
            openTimer = null;
          }
          openVideoLightbox(item.src, 0, false, videoSources, item.index);
        });
        slide.appendChild(wrap);
      } else {
        const imageUrl = resolveMediaUrl(item.src);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "table-feed-grid-image-btn";
        button.title = "查看图片";
        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openImageLightbox(imageSources, item.index);
        });
        const img = document.createElement("img");
        img.dataset.src = imageUrl;
        img.alt = node?.label_zh || node?.label || node?.name || "图片";
        img.loading = "eager";
        img.decoding = "async";
        img.fetchPriority = mediaIndex === 0 ? "auto" : "low";
        button.appendChild(img);
        slide.appendChild(button);
      }

      return slide;
    };

    mediaItems.forEach((item, index) => {
      track.appendChild(createMediaSlide(item, index));
    });

    let currentIndex = 0;

    const updateControls = () => {
      badge.textContent = `${currentIndex + 1}/${mediaItems.length}`;
      prevBtn.disabled = currentIndex <= 0;
      nextBtn.disabled = currentIndex >= mediaItems.length - 1;
      controls.style.display = mediaItems.length > 1 ? "flex" : "none";
      track.style.transform = `translateX(-${currentIndex * 100}%)`;
      loadGridSlideAt(currentIndex);
    };

    prevBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (currentIndex > 0) {
        currentIndex -= 1;
        updateControls();
      }
    });

    nextBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (currentIndex < mediaItems.length - 1) {
        currentIndex += 1;
        updateControls();
      }
    });

    updateControls();
    return element;
  }

  function ensureTableListTooltip() {
    if (tableListTooltip) return tableListTooltip;
    let tip = document.querySelector(".kb-tooltip");
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "kb-tooltip";
      document.body.appendChild(tip);
    }
    tableListTooltip = tip;
    return tip;
  }

  function hideTableListTooltip() {
    if (!tableListTooltip) return;
    tableListTooltip.style.display = "none";
    tableListHoverRow = null;
    tableListTooltipPoint = null;
    if (tableListTooltipRaf) {
      cancelAnimationFrame(tableListTooltipRaf);
      tableListTooltipRaf = 0;
    }
  }

  async function handleTableFeedAction(action, row, node, footer) {
    if (!action || !row) return;
    const rid = String(row.getAttribute("data-id") || "").trim();
    if (!rid) return;

    if (action === "like") {
      if (!node) return;
      try {
        await handleEngagementAction(node, "like", footer);
      } catch (err) {
        alert("点赞失败: " + (err?.message || err));
      }
      return;
    }

    if (action === "share") {
      if (!node) return;
      try {
        await handleEngagementAction(node, "share", footer);
      } catch (err) {
        alert("转发计数失败: " + (err?.message || err));
      }
      return;
    }

    if (action === "comment") {
      if (!node) return;
      try {
        await handleCommentView(node, footer);
      } catch (err) {
        alert("评论查看失败: " + (err?.message || err));
      }
      return;
    }

    if (action === "delete") {
      const nodeLabel = String(
        node?.label_zh ||
          node?.label ||
          node?.name ||
          node?._id ||
          node?.id ||
          rid,
      ).trim();
      if (
        !confirm(
          `确定删除实体「${nodeLabel}」及其所有关联关系？此操作不可恢复。`,
        )
      ) {
        return;
      }
      try {
        const delUrl = new URL("/api/kb/nodes", window.location.origin);
        delUrl.searchParams.set("id", rid);
        if (typeof window.appendCurrentDbParam === "function") {
          const scopedUrl = window.appendCurrentDbParam(delUrl);
          if (scopedUrl instanceof URL) delUrl.search = scopedUrl.search;
        }
        const resp = await fetch(delUrl.toString(), { method: "DELETE" });
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        if (Array.isArray(window.kbTableNodes)) {
          window.kbTableNodes = window.kbTableNodes.filter((x) => {
            const xid = String(x?._id || x?.id || "").trim();
            return xid !== rid;
          });
        }
        try {
          if (
            window.kbTableNodeMap &&
            typeof window.kbTableNodeMap.delete === "function"
          ) {
            window.kbTableNodeMap.delete(rid);
          }
        } catch {}
        row.remove();
        if (typeof window.loadGraph === "function") {
          window.loadGraph().catch(() => {});
        }
      } catch (err) {
        alert("删除失败: " + (err?.message || err));
      }
      return;
    }

    if (action === "view") {
      if (typeof setViewMode === "function") {
        setViewMode("vis", { targetNodeId: rid });
      }
    }
  }

  function performTableRowSelection(row, rid, event) {
    if (!row || !rid) return;
    if (event?.shiftKey && window.kbLastAnchorRowId) {
      rangeSelectTo(rid);
    } else if (event?.ctrlKey || event?.metaKey) {
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
    focusRowElement(row);
  }

  function bindTableListDelegatedEvents() {
    if (!tblNodes || tableListDelegatedBound) return;
    tableListDelegatedBound = true;

    tblNodes.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const row = target.closest(".entity-list-item.table-feed-row");
      if (!row || !tblNodes.contains(row)) return;
      const rid = String(row.getAttribute("data-id") || "").trim();
      if (!rid) return;
      const node = getTableNodeById(rid);

      const mediaTag = target.closest(".node-media-tag[data-node-action]");
      if (mediaTag && row.contains(mediaTag)) {
        e.preventDefault();
        e.stopPropagation();
        if (!node) return;
        const mediaAction = String(
          mediaTag.getAttribute("data-node-action") || "",
        ).trim();
        if (mediaAction === "gallery" || mediaAction === "shorts") {
          openMediaViewForNode(mediaAction, node);
        }
        return;
      }

      const actionBtn = target.closest(".table-feed-action-btn[data-action]");
      if (actionBtn && row.contains(actionBtn)) {
        e.preventDefault();
        e.stopPropagation();
        const action = String(
          actionBtn.getAttribute("data-action") || "",
        ).trim();
        const footer = actionBtn.closest(".table-feed-footer");
        void handleTableFeedAction(action, row, node, footer);
        return;
      }

      if (target.closest("a") || target.closest("button")) {
        return;
      }

      performTableRowSelection(row, rid, e);
    });

    tblNodes.addEventListener("dblclick", async (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("button") || target.closest("a")) return;
      const row = target.closest(".entity-list-item.table-feed-row");
      if (!row || !tblNodes.contains(row)) return;
      const rid = String(row.getAttribute("data-id") || "").trim();
      if (!rid) return;
      setTableSelection(rid);
      if (typeof setViewMode === "function") {
        setViewMode("detail", { targetNodeId: rid });
      }
    });

    tblNodes.addEventListener("mouseover", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(".node-media-tag") ||
        target.closest(".table-feed-media-slot") ||
        target.closest(".table-feed-video") ||
        target.closest("video")
      ) {
        hideTableListTooltip();
        return;
      }
      const row = target.closest(".entity-list-item.table-feed-row");
      if (!row || !tblNodes.contains(row)) return;
      const desc = String(row.getAttribute("data-desc") || "").trim();
      if (!desc) return;
      const tip = ensureTableListTooltip();
      tip.textContent = desc.length > 180 ? desc.slice(0, 180) + "…" : desc;
      tip.style.display = "block";
      tableListHoverRow = row;
      tableListTooltipPoint = { x: e.clientX, y: e.clientY };
      positionTooltip(e, tip);
    });

    tblNodes.addEventListener("mousemove", (e) => {
      // tooltip 不再跟随鼠标持续重排，减少滚动抖动和主线程压力。
      return;
    });

    tblNodes.addEventListener("mouseout", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const row = target.closest(".entity-list-item.table-feed-row");
      if (!row || row !== tableListHoverRow) return;
      const related = e.relatedTarget;
      if (related instanceof Element && row.contains(related)) return;
      hideTableListTooltip();
    });
  }

  function hydrateTableMediaSlot(slot) {
    if (!slot || slot.dataset.hydrated === "1") return;
    if (window.kbTableLayoutMode === "table") return;
    const nodeId = String(slot.dataset.nodeId || "").trim();
    if (!nodeId) {
      slot.dataset.hydrated = "1";
      return;
    }
    const node = getTableNodeById(nodeId);
    if (!node) {
      slot.dataset.hydrated = "1";
      return;
    }
    const imageList = collectNodeImages(node);
    const videoList = collectNodeVideos(node);
    const coverList = collectNodeCovers(node);
    const hasVideo = videoList.length > 0;
    const hasImage = imageList.length > 0;

    let mediaEl = null;
    if (hasVideo || hasImage) {
      mediaEl =
        window.kbTableLayoutMode === "grid"
          ? buildGridMediaElement(node, imageList, videoList, coverList)
          : buildMixedMediaStripElement(node, imageList, videoList, coverList);
    }

    slot.replaceChildren();
    if (mediaEl) {
      slot.appendChild(mediaEl);
      if (window.kbTableLayoutMode !== "grid") {
        const relayout = () => scheduleTableGridMasonryLayout();
        try {
          mediaEl.querySelectorAll("img").forEach((img) => {
            if (img.complete) return;
            img.addEventListener("load", relayout, { once: true });
            img.addEventListener("error", relayout, { once: true });
          });
          mediaEl.querySelectorAll("video").forEach((video) => {
            video.addEventListener("loadedmetadata", relayout, { once: true });
          });
        } catch {}
      }
      try {
        const observedVideo = mediaEl.querySelector(
          ".table-feed-video-observe",
        );
        if (observedVideo && window._kbVideoObserver) {
          window._kbVideoObserver.observe(observedVideo);
        }
      } catch {}
    }
    slot.dataset.hydrated = "1";
    scheduleTableGridMasonryLayout();
  }

  function setupTableMediaLazyRender() {
    if (!tblNodes) return;
    if (tableMediaObserver) {
      try {
        tableMediaObserver.disconnect();
      } catch {}
      tableMediaObserver = null;
    }

    const slots = Array.from(
      tblNodes.querySelectorAll(".table-feed-media-slot[data-hydrated='0']"),
    );
    if (!slots.length) return;

    // 首屏少量媒体同步渲染，避免用户看到空白占位。
    const eagerCount = 2;
    slots.slice(0, eagerCount).forEach((slot) => hydrateTableMediaSlot(slot));

    const pending = slots.filter((slot) => slot.dataset.hydrated !== "1");
    if (!pending.length) return;

    tableMediaObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const slot = entry.target;
          observer.unobserve(slot);
          hydrateTableMediaSlot(slot);
        });
      },
      {
        root: getTableListScrollContainer(),
        rootMargin: TABLE_GRID_MEDIA_ROOT_MARGIN,
        threshold: 0.01,
      },
    );

    pending.forEach((slot) => tableMediaObserver.observe(slot));
  }

  window.addEventListener("resize", () => {
    scheduleTableGridMasonryLayout();
  });

  function renderTableList(options = {}) {
    if (!tblNodes) return;
    hideTableListTooltip();

    const isGridLayout = window.kbTableLayoutMode === "grid";
    const isTableLayout = window.kbTableLayoutMode === "table";
    const appendInfinite =
      options && options.append === true && (isGridLayout || !isTableLayout);

    if (isGridLayout) {
      tblNodes.classList.add("grid-layout");
    } else {
      tblNodes.classList.remove("grid-layout");
    }
    tblNodes.classList.toggle("table-layout", isTableLayout);

    ensureTableListScrollTracking();
    rememberTableListScrollPosition();

    const scrollContainer = getTableListScrollContainer();
    const previousScrollTop = Math.max(
      0,
      Number(scrollContainer?.scrollTop || 0),
      Number(tblNodes?.scrollTop || 0),
      Number(window.kbTableListScrollTop || 0),
    );

    const rawList = Array.isArray(window.kbTableNodes)
      ? window.kbTableNodes
      : [];

    const keyword =
      typeof tblSearch !== "undefined" && tblSearch
        ? (tblSearch.value || "").trim().toLowerCase()
        : "";

    const filteredList = rawList.filter((n) => {
      if (!n || typeof n !== "object") return false;

      if (isTableLayout) {
        const displayName = String(
          n.label_zh || n.label || n.name || "",
        ).trim();
        if (!displayName) return false;
      }

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

    const tableNodeMap = new Map();
    const frag = document.createDocumentFragment();
    const existingRenderedIds = appendInfinite
      ? new Set(
          Array.from(tblNodes.querySelectorAll(".entity-list-item[data-id]"))
            .map((item) => String(item.getAttribute("data-id") || "").trim())
            .filter(Boolean),
        )
      : new Set();

    filteredList.forEach((n) => {
      const nodeId = String(n?._id || n?.id || "").trim();
      if (nodeId) {
        tableNodeMap.set(nodeId, n);
      }
      if (appendInfinite && nodeId && existingRenderedIds.has(nodeId)) {
        return;
      }
      const imageList = collectNodeImages(n);
      const videoList = collectNodeVideos(n);
      const hasImage = imageList.length > 0;
      const hasVideo = videoList.length > 0;
      const _nameFirst = (n.label_zh || n.label || n.name || "").trim();
      const _descFull = (n.desc_zh || n.description || "").trim();
      // 如果 description 包含多行（即 composer 多行输入保存后），以 description 为主展示名称
      const labelSource =
        _descFull && _descFull !== _nameFirst ? _descFull : _nameFirst;
      const cleanedLabel =
        hideInlineHashTags(labelSource) ||
        hideInlineHashTags(_nameFirst) ||
        labelSource;
      const labelLines = cleanedLabel
        .split(/\r?\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
      const label = (labelLines[0] || cleanedLabel || "").trim();
      const desc = labelLines.slice(1).join(" ").trim();
      const tags = normalizeStringList(n.tags);
      const aliases = normalizeStringList(n.aliases_zh || n.aliases);
      const typeLabel = (
        n.typeLabel ||
        n.classLabel ||
        n.type ||
        "未分类"
      ).trim();
      const relativeTime = formatRelativeTime(n.updated_at || n.created_at);

      const tr = document.createElement("article");
      tr.className = "entity-list-item table-feed-row";
      tr.classList.add(hasImage || hasVideo ? "has-media" : "no-media");
      tr.tabIndex = -1;
      tr.setAttribute("data-id", nodeId);
      tr.setAttribute("role", "listitem");

      if (desc) tr.setAttribute("data-desc", desc);

      const itemLayout = document.createElement("div");
      itemLayout.className = "entity-list-item-layout";

      const tdName = document.createElement("div");
      tdName.className = "table-feed-main-cell";
      const card = document.createElement("article");
      card.className = "table-feed-card";

      const header = document.createElement("div");
      header.className = "table-feed-header";

      const avatar = document.createElement("div");
      avatar.className = "table-feed-avatar";
      avatar.title = label || nodeId || "实体";
      avatar.setAttribute("aria-label", "选中实体");
      const avatarImage = imageList[0] ? resolveMediaUrl(imageList[0]) : "";
      if (avatarImage && !isAnimatedImageVideoUrl(avatarImage)) {
        const avatarImg = document.createElement("img");
        avatarImg.src = avatarImage;
        avatarImg.alt = label || "实体";
        avatarImg.loading = "lazy";
        avatarImg.decoding = "async";
        avatar.appendChild(avatarImg);
      } else {
        avatar.textContent = (label || nodeId || "?").trim().charAt(0) || "?";
      }
      header.appendChild(avatar);

      const meta = document.createElement("div");
      meta.className = "table-feed-meta";

      const nameLink = document.createElement("span");
      nameLink.textContent = label;
      nameLink.className = "table-feed-name";

      const metaTop = document.createElement("div");
      metaTop.className = "table-feed-meta-top";
      metaTop.appendChild(nameLink);

      meta.appendChild(metaTop);

      const metaSub = document.createElement("div");
      metaSub.className = "table-feed-subline";

      if (!isGridLayout) {
        const typeChip = document.createElement("span");
        typeChip.className = "table-feed-type-chip";
        typeChip.textContent = typeLabel || "未分类";
        metaSub.appendChild(typeChip);
      }

      if (aliases.length) {
        const aliasText = document.createElement("span");
        aliasText.className = "table-feed-aliases";
        aliasText.textContent = aliases
          .slice(0, 2)
          .map((item) => `@${item}`)
          .join(" ");
        metaSub.appendChild(aliasText);
      }

      meta.appendChild(metaSub);

      if (desc) {
        const collapsedInfo = document.createElement("div");
        collapsedInfo.className = "table-feed-collapsed-info";
        collapsedInfo.textContent = desc;
        meta.appendChild(collapsedInfo);
      }

      header.appendChild(meta);

      const headerAside = document.createElement("div");
      headerAside.className = "table-feed-header-aside";

      if (relativeTime) {
        const timeText = document.createElement("span");
        timeText.className = "table-feed-time";
        timeText.textContent = relativeTime;
        headerAside.appendChild(timeText);
      }

      const actions = document.createElement("div");
      actions.className = "table-feed-top-actions";
      if (n.link) {
        try {
          const externalLink = document.createElement("a");
          externalLink.className = "table-feed-external-link";
          externalLink.href = n.link;
          externalLink.target = "_blank";
          externalLink.rel = "noreferrer noopener";
          externalLink.title = "外部链接";
          externalLink.setAttribute("aria-label", "打开外部链接");
          externalLink.innerHTML =
            '<i class="fa-solid fa-up-right-from-square" aria-hidden="true"></i>';
          actions.appendChild(externalLink);
        } catch {}
      }

      if (actions.childElementCount > 0) {
        headerAside.appendChild(actions);
      }

      if (headerAside.childElementCount > 0) {
        header.appendChild(headerAside);
      }
      card.appendChild(header);

      if (tags.length) {
        const tagList = document.createElement("div");
        tagList.className = "table-feed-tag-list";
        tags.slice(0, 5).forEach((tag) => {
          const chip = document.createElement("span");
          chip.className = "table-feed-tag-chip";
          chip.textContent = `#${tag}`;
          tagList.appendChild(chip);
        });
        card.appendChild(tagList);
      }

      if (!isTableLayout && (hasVideo || hasImage)) {
        const mediaSlot = document.createElement("div");
        mediaSlot.className = "table-feed-media-slot";
        mediaSlot.dataset.nodeId = nodeId;
        mediaSlot.dataset.hydrated = "0";
        card.appendChild(mediaSlot);
      }

      const engagement = getNodeEngagementState(n);
      const footer = document.createElement("div");
      footer.className = "table-feed-footer";
      footer.innerHTML = `
        <button type="button" class="table-feed-action-btn" data-action="like"><i class="fa-regular fa-heart"></i><span>${engagement.likes}</span></button>
        <button type="button" class="table-feed-action-btn" data-action="comment"><i class="fa-regular fa-comment"></i><span>${engagement.comments}</span></button>
        <button type="button" class="table-feed-action-btn" data-action="share"><i class="fa-solid fa-retweet"></i><span>${engagement.shares}</span></button>
        <button type="button" class="table-feed-action-btn table-feed-action-danger" data-action="delete" title="删除实体"><i class="fa-regular fa-trash-can"></i></button>
        <button type="button" class="table-feed-action-btn table-feed-action-primary" data-action="view"><i class="fa-regular fa-paper-plane"></i><span>查看</span></button>
      `;
      card.appendChild(footer);

      tdName.appendChild(card);
      itemLayout.appendChild(tdName);

      const tdType = document.createElement("div");
      tdType.className = "table-feed-side-cell";
      tdType.innerHTML = `<span class="table-feed-side-chip">${typeLabel || "未分类"}</span>`;
      itemLayout.appendChild(tdType);
      tr.appendChild(itemLayout);

      frag.appendChild(tr);
    });

    if (appendInfinite) {
      tblNodes.appendChild(frag);
    } else {
      tblNodes.replaceChildren(frag);
    }
    try {
      const target = scrollContainer || tblNodes;
      const maxScrollTop = Math.max(
        0,
        Number(target.scrollHeight || 0) - Number(target.clientHeight || 0),
      );
      if (!appendInfinite) {
        target.scrollTop = Math.min(previousScrollTop, maxScrollTop);
      }
      window.kbTableListScrollTop = Number(target.scrollTop || 0);
    } catch {}
    window.kbTableNodeMap = tableNodeMap;

    try {
      const selectedId = String(window.kbSelectedRowId || "").trim();
      const normalizedSelectedId = normalizeEntityIdLike(selectedId);
      const routeNodeId = String(getRouteNodeIdFromUrl() || "").trim();
      const normalizedRouteNodeId = normalizeEntityIdLike(routeNodeId);
      const resolveMatchedId = (targetNormalizedId) => {
        if (!targetNormalizedId || !tableNodeMap || !tableNodeMap.size)
          return "";
        for (const key of tableNodeMap.keys()) {
          if (normalizeEntityIdLike(key) === targetNormalizedId) return key;
        }
        return "";
      };
      const matchedSelectedId = resolveMatchedId(normalizedSelectedId);
      const matchedRouteId = resolveMatchedId(normalizedRouteNodeId);
      const nextSelectedId = matchedSelectedId || matchedRouteId || "";
      if (nextSelectedId && nextSelectedId !== selectedId) {
        window.kbSelectedRowId = nextSelectedId;
        window.kbSelectedRowIds = new Set([nextSelectedId]);
        window.kbLastAnchorRowId = nextSelectedId;
        window.kbSelectedNodeId = nextSelectedId;
        window.kbCurrentNodeId = nextSelectedId;
      }
    } catch {}

    bindTableListDelegatedEvents();

    // Auto-play videos when scrolled into view, pause when scrolled out
    // Only one video plays at a time
    if (window._kbVideoObserver) {
      try {
        window._kbVideoObserver.disconnect();
      } catch {}
    }
    // 列表滚动场景关闭自动播放，避免滚动时频繁触发 play/pause 造成卡顿。
    window._kbVideoObserver = null;

    setupTableMediaLazyRender();
    scheduleTableGridMasonryLayout();

    // Keyboard seek: ArrowRight +5s, ArrowLeft -5s — bound directly on each video element
    if (window._kbVideoKeyHandler) {
      document.removeEventListener("keydown", window._kbVideoKeyHandler);
      window._kbVideoKeyHandler = null;
    }

    try {
      const rows = getListItems();
      const has = rows.some(
        (tr) => (tr.getAttribute("data-id") || "") === window.kbSelectedRowId,
      );
      const findSelectedRow = () => {
        const selectedId = String(window.kbSelectedRowId || "").trim();
        const normalizedSelectedId = normalizeEntityIdLike(selectedId);
        if (!selectedId && !normalizedSelectedId) return null;
        return (
          rows.find((tr) => {
            const rid = String(tr.getAttribute("data-id") || "").trim();
            if (!rid) return false;
            if (rid === selectedId) return true;
            return normalizeEntityIdLike(rid) === normalizedSelectedId;
          }) || null
        );
      };
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
        // Disable auto locate after each render to keep scrolling smooth.
        const selectedRow = findSelectedRow();
        const selectedRowId = String(
          selectedRow?.getAttribute("data-id") || window.kbSelectedRowId || "",
        ).trim();
        if (isTableViewActive && selectedRowId) {
          scheduleTableSidebarSync(selectedRowId);
        }
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

    const normalizeShortsNodes = (nodes) => normalizeNodeVideoEntries(nodes);

    const appendShortsNodes = async (nodes) => {
      const tableList = normalizeShortsNodes(nodes);
      const existingKeys = new Set(
        rawList.map((item) => getNodeVideoEntryKey(item)).filter(Boolean),
      );
      const newItems = tableList.filter(
        (item) =>
          item.video &&
          item.video.trim() &&
          !existingKeys.has(getNodeVideoEntryKey(item)),
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
      rawList = normalizeShortsNodes(window.kbTableNodes);
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
            rawList = normalizeShortsNodes(window.kbTableNodes);
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
        cover: String(item.cover || "").trim(),
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
      const posterSource = String(item.cover || "").trim();
      if (posterSource) {
        try {
          const resolvedImage = new URL(
            posterSource,
            window.location.origin,
          ).toString();
          videoEl.poster = resolvedImage;
        } catch {
          videoEl.poster = posterSource;
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

      videoEl.addEventListener("contextmenu", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        showVideoContextMenu(event.clientX, event.clientY, async () => {
          await setVideoFrameAsNodeCover(item.id, videoEl);
          if (typeof window.setStatus === "function") {
            window.setStatus(false, "已将当前帧设为封面");
          }
        });
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
      return getNodeVideoEntryKey(item);
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
      dedupeShortsNodes(normalizeNodeVideoEntries(nodes));

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
          label: item.label || item.label_zh || "",
          label_zh: item.label_zh || item.label || "",
          classLabel: item.classLabel || item.type || "",
          video: item.video || "",
          cover: String(item.cover || "").trim(),
          image: item.image || "",
          replayKey:
            item.__shortsReplayKey || item.__videoEntryKey || "",
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
      rawList = normalizeShortsNodes(cachedShorts);
      window.kbShortsNodes = rawList;
    } else if (
      Array.isArray(window.kbTableNodes) &&
      window.kbTableNodes.length
    ) {
      rawList = normalizeShortsNodes(window.kbTableNodes);
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
            rawList = normalizeShortsNodes(window.kbTableNodes);
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
        cover: String(item.cover || "").trim(),
        image: item.image || "",
        replayKey: item.__shortsReplayKey || item.__videoEntryKey || "",
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
      const posterSource = String(item.cover || "").trim();
      if (posterSource) {
        try {
          videoEl.poster = new URL(
            posterSource,
            window.location.origin,
          ).toString();
        } catch {
          videoEl.poster = posterSource;
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

      videoEl.addEventListener("contextmenu", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        showVideoContextMenu(event.clientX, event.clientY, async () => {
          await setVideoFrameAsNodeCover(item.id, videoEl);
          if (typeof window.setStatus === "function") {
            window.setStatus(false, "已将当前帧设为封面");
          }
        });
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
      const posterSource = String(item.cover || "").trim();
      if (posterSource) {
        try {
          videoEl.poster = new URL(
            posterSource,
            window.location.origin,
          ).toString();
        } catch {
          videoEl.poster = posterSource;
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

      videoEl.addEventListener("contextmenu", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        showVideoContextMenu(event.clientX, event.clientY, async () => {
          await setVideoFrameAsNodeCover(item.id, videoEl);
          if (typeof window.setStatus === "function") {
            window.setStatus(false, "已将当前帧设为封面");
          }
        });
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

    alert(`删除完成：${okCount}/${ids.length}`);
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
}

__kbInitTableSelection();
