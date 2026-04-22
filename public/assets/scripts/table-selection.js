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
      var fId = window.fId || document.getElementById("fId");
      if (fId && typeof fId === "object") fId.value = id || "";
      if (id && typeof window.loadAttributes === "function") {
        window.loadAttributes(id);
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
      window.open(href, "noopener");
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

  function renderTableList() {
    if (!tblNodes) return;

    const tbody = tblNodes.querySelector("tbody");
    if (!tbody) return;

    const rawList = Array.isArray(window.kbTableNodes)
      ? window.kbTableNodes
      : [];
    const frag = document.createDocumentFragment();

    rawList.forEach((n) => {
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

      const tdIdx = document.createElement("td");
      tdIdx.textContent = String(n.id);
      tr.appendChild(tdIdx);

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
          setTableSelection(rid, false);
          if (typeof setViewMode === "function") {
            setViewMode("detail", { targetNodeId: rid });
          }
        } catch {}
      });

      nameWrapper.appendChild(nameLink);
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

      const tdClass = document.createElement("td");
      const classification = n.classLabel || n.type || "";
      tdClass.textContent = classification;
      tdClass.style.textAlign = "right";
      if (classification) tdClass.title = classification;
      tr.appendChild(tdClass);

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
          setTableSelection(rid, true);
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

    let rawList = Array.isArray(window.kbTableNodes) ? window.kbTableNodes : [];
    if (!rawList.length) {
      try {
        if (window.localStorage) {
          const cached = localStorage.getItem("kbTableNodesCache");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length) {
              rawList = parsed;
            }
          }
        }
      } catch (err) {
        console.warn("load cached kbTableNodes failed", err);
      }
    }
    if (!rawList.length && typeof loadTablePage === "function") {
      try {
        await loadTablePage();
        rawList = Array.isArray(window.kbTableNodes) ? window.kbTableNodes : [];
      } catch {}
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
          if (window.localStorage) {
            localStorage.setItem("kbShortsCurrentNode", targetId);
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
        const params = new URLSearchParams();
        if (item.id) params.set("id", item.id);
        const url =
          "/kb/detail" + (params.toString() ? "?" + params.toString() : "");
        window.location.href = url;
      });
      actions.appendChild(detailBtn);
      meta.appendChild(actions);
      card.appendChild(meta);
      shortsList.appendChild(card);
    });

    let wheelLock = false;
    const scrollDuration = 400;
    const cardCount = cardElements.length;

    const getCurrentCardIndex = () => {
      const center = shortsList.scrollTop + shortsList.clientHeight / 2;
      let bestIndex = 0;
      let bestDistance = Infinity;
      cardElements.forEach((card, idx) => {
        const rect = card.getBoundingClientRect();
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

    const updateNavButtons = (index) => {
      if (!shortsPrevBtn || !shortsNextBtn) return;
      const hasPrev = index > 0;
      const hasNext = index < cardCount - 1;
      shortsPrevBtn.disabled = !hasPrev;
      shortsNextBtn.disabled = !hasNext;
      shortsPrevBtn.classList.toggle("hidden", !hasPrev);
      shortsNextBtn.classList.toggle("hidden", !hasNext);
    };

    let isInitializingShorts = true;
    const handleShortsScroll = () => {
      if (isInitializingShorts) return;
      const newIndex = getCurrentCardIndex();
      updateNavButtons(newIndex);
      setActiveShortsIndex(newIndex);
    };

    const handleShortsControlClick = (event) => {
      const target = event.target.closest(".shorts-arrow-btn");
      if (!target) return;
      const isPrev = target.id === "shortsPrevBtn";
      const isNext = target.id === "shortsNextBtn";
      if (!isPrev && !isNext) return;
      event.preventDefault();
      const currentIndex = getCurrentCardIndex();
      const nextIndex = isPrev
        ? Math.max(0, currentIndex - 1)
        : Math.min(cardCount - 1, currentIndex + 1);
      if (nextIndex !== currentIndex) {
        scrollToCard(nextIndex);
      }
    };

    if (shortsPanel && !shortsPanel.dataset.shortsControlsBound) {
      shortsPanel.dataset.shortsControlsBound = "1";
      shortsPanel.addEventListener("click", handleShortsControlClick);
    }

    shortsList.addEventListener("scroll", handleShortsScroll, {
      passive: true,
    });

    shortsList.addEventListener(
      "wheel",
      (event) => {
        if (wheelLock) {
          event.preventDefault();
          return;
        }
        if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
        const currentIndex = getCurrentCardIndex();
        const nextIndex =
          event.deltaY > 0 ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex !== currentIndex) {
          event.preventDefault();
          scrollToCard(nextIndex);
        }
      },
      { passive: false },
    );

    let initialNodeId = window.kbSelectedRowId || "";
    try {
      if (!initialNodeId && window.localStorage) {
        const cachedShortsNode = localStorage.getItem("kbShortsCurrentNode");
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

  function bindShortsButton() {
    const btnShortsMode = document.getElementById("btnShortsMode");
    if (!btnShortsMode) return;
    btnShortsMode.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof setViewMode === "function") {
        setViewMode("shorts");
      }
    });
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

  if (window.kbViewMode === "shorts") {
    try {
      renderShortsList();
    } catch (err) {
      console.warn("shorts page rehydrate failed", err);
    }
  }

  bindDeleteButton();
  bindShortsButton();
  bindSelectAll();
  bindClearButtons();
})();
