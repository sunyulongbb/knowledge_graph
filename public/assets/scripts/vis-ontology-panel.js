// 关联视图左侧的本体树面板：把本体分类拖到画布，即可在该位置新建该类型节点。
const PANEL_ID = "visOntologyPanel";
const TREE_HOST_ID = "visOntologyTree";
const STATUS_ID = "visOntologyPanelStatus";
const TOGGLE_ID = "cy_btnOntologyPanel";
const RECOMMEND_PANEL_ID = "visRecommendPanel";
const RECOMMEND_LIST_ID = "visRecommendList";
const RECOMMEND_STATUS_ID = "visRecommendStatus";
const RECOMMEND_HINT_ID = "visRecommendHint";
const RECOMMEND_TOGGLE_ID = "cy_btnRecommendPanel";
const RECOMMEND_COLLAPSE_STORAGE_KEY = "kb-vis-recommend-panel-collapsed";
const RECOMMEND_LIMIT = 12;
const DEFAULT_RECOMMEND_HINT =
  "点击左侧本体树上的分类，这里会列出该类型的知识；拖到画布即可加入关系图。";
const GRAPH_HOST_ID = "cy";
const GRAPH_WRAP_ID = "cywrap";
const GRAPH_BODY_SELECTOR = ".vis-panel .vis-graph-body";
const COLLAPSE_STORAGE_KEY = "kb-vis-ontology-panel-collapsed";
const DEFAULT_NODE_COLOR = "#94a3b8";
const STATUS_CLEAR_DELAY = 4000;
const DRAG_THRESHOLD = 4;
const DRAG_CHIP_OFFSET = 12;

let controller = null;
let treeState = "idle";
let pointerDrag = null;
let dragChip = null;
let dragWindowBound = false;
let popover = null;
let popoverCleanup = null;
let statusTimer = null;
let recommendStatusTimer = null;
let recommendRequestSeq = 0;
let recommendTypeId = "";
let recommendTypeLabel = "";
let recommendMode = "type";
let searchQuery = "";
const recommendCache = new Map();
const recommendNodesById = new Map();

/* ── 纯函数（供单测直接引用） ─────────────────────────────── */

/**
 * 屏幕坐标 → 图模型坐标。cytoscape 的映射为 rendered = model * zoom + pan。
 */
export function graphPointFromClient(containerRect, viewport, clientX, clientY) {
  const rect = containerRect || {};
  const zoom = Number(viewport?.zoom) > 0 ? Number(viewport.zoom) : 1;
  const panX = Number(viewport?.panX) || 0;
  const panY = Number(viewport?.panY) || 0;
  return {
    x: (Number(clientX || 0) - Number(rect.left || 0) - panX) / zoom,
    y: (Number(clientY || 0) - Number(rect.top || 0) - panY) / zoom,
  };
}

/**
 * 把浮层约束在画布范围内，返回相对画布的 left/top。
 */
export function clampPopoverPosition(anchor, size, bounds, margin = 8) {
  const limitLeft = Math.max(margin, Number(bounds?.width || 0) - Number(size?.width || 0) - margin);
  const limitTop = Math.max(margin, Number(bounds?.height || 0) - Number(size?.height || 0) - margin);
  return {
    left: Math.max(margin, Math.min(Number(anchor?.x) || 0, limitLeft)),
    top: Math.max(margin, Math.min(Number(anchor?.y) || 0, limitTop)),
  };
}

/**
 * 校验颜色，只接受十六进制，避免把任意字符串写进内联样式。
 */
export function normalizeOntologyColor(value, fallback = DEFAULT_NODE_COLOR) {
  const raw = String(value || "").trim();
  return /^#[0-9a-f]{3,8}$/i.test(raw) ? raw : fallback;
}

/**
 * 接口返回的节点 → cytoscape 元素描述，缺少 id 时返回 null。
 */
export function ontologyNodeCyElement(nodeData, fallbackLabel = "") {
  const data = nodeData || {};
  const idRaw = data._id ?? data.id ?? "";
  const id = String(idRaw ?? "").trim();
  if (!id) return null;
  const label =
    String(data.label || data.label_zh || data.name || fallbackLabel || "").trim() || id;
  const images = Array.isArray(data.images) ? data.images : [];
  return {
    group: "nodes",
    data: {
      id,
      label,
      label_zh: data.label_zh || "",
      color: normalizeOntologyColor(data.color),
      type: data.type || data.classLabel || "实体",
      typeId: data.typeId || "",
      classId: data.classId,
      classLabel: data.classLabel,
      description: data.description || "",
      image: images[0] || "",
      link: data.link || "",
      pdf: data.pdf || "",
    },
  };
}

/**
 * 底栏计数文案 +1，兼容「全部 (12)」与「节点 12 · 边 8」两种格式。
 */
export function incrementGraphCount(text, labels = []) {
  let result = String(text || "");
  for (const label of labels) {
    const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(`${escaped}\\s*\\((\\d+)\\)`),
      (_, count) => `${label} (${Number(count) + 1})`,
    );
    result = result.replace(
      new RegExp(`${escaped}\\s+(\\d+)`),
      (_, count) => `${label} ${Number(count) + 1}`,
    );
  }
  return result;
}

/* ── DOM 辅助 ───────────────────────────────────────────── */

function byId(id) {
  return document.getElementById(id);
}

function setPanelStatus(text, variant = "") {
  const el = byId(STATUS_ID);
  if (!el) return;
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
  el.textContent = text || "";
  el.classList.toggle("is-error", variant === "error");
  el.classList.toggle("is-success", variant === "success");
  if (text) {
    statusTimer = setTimeout(() => {
      statusTimer = null;
      el.textContent = "";
      el.classList.remove("is-error", "is-success");
    }, STATUS_CLEAR_DELAY);
  }
}

function notify(text, variant) {
  setPanelStatus(text, variant);
}

/* ── 面板折叠 ───────────────────────────────────────────── */

function readCollapsedState() {
  try {
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function persistCollapsedState(collapsed) {
  try {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(collapsed));
  } catch {}
}

function resizeGraphAfterLayoutChange() {
  window.requestAnimationFrame(() => {
    try {
      window.kbCy?.resize();
    } catch {}
  });
}

function setCollapsed(collapsed) {
  const panel = byId(PANEL_ID);
  const toggle = byId(TOGGLE_ID);
  if (!panel) return;
  panel.classList.toggle("is-collapsed", collapsed);
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.title = collapsed ? "展开本体面板" : "收起本体面板";
    const icon = toggle.querySelector("i");
    if (icon) {
      icon.classList.toggle("fa-chevron-left", !collapsed);
      icon.classList.toggle("fa-chevron-right", collapsed);
    }
  }
  if (!collapsed && treeState === "idle") void ensureTree();
  resizeGraphAfterLayoutChange();
}

function bindPanelToggle() {
  const panel = byId(PANEL_ID);
  const toggle = byId(TOGGLE_ID);
  if (!panel || panel.dataset.toggleBound === "true") return;
  panel.dataset.toggleBound = "true";
  toggle?.addEventListener("click", () => {
    const collapsed = !panel.classList.contains("is-collapsed");
    setCollapsed(collapsed);
    persistCollapsedState(collapsed);
  });
  panel.addEventListener("click", (event) => {
    if (!panel.classList.contains("is-collapsed")) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button")) return;
    setCollapsed(false);
    persistCollapsedState(false);
  });
}

/* ── 本体树 ─────────────────────────────────────────────── */

async function loadTreeModule() {
  const ready = window.kbOntologyTreeModuleReady;
  if (ready && typeof ready.then === "function") return await ready;
  return await import("/assets/generated/ontology-tree.js");
}

function buildController(module, host) {
  return new module.OntologyTreeController(host, {
    showAllButton: false,
    enableDrag: false,
    enableContextMenu: false,
    disableReadonlyItems: false,
    toggleSelection: false,
    storageKey: "kb:ontology-tree-state:vis-panel",
    nodeIcon: "folder",
    defaultExpandAll: true,
    expandOnFirstRender: true,
    // 点击分类 → 右侧知识推荐列出该类型的知识
    onSelect: (id) => void loadRecommendations(id),
    onEdit: () => {},
    onAddChild: () => {},
    onDelete: () => {},
    onReload: () => void refreshTree(),
  });
}

async function ensureTree() {
  const host = byId(TREE_HOST_ID);
  if (!host || controller || treeState === "loading") return;
  treeState = "loading";
  // 每次重建都用独立的内层宿主，旧实例延迟销毁时不会清空新树
  const inner = document.createElement("div");
  inner.className = "vis-ontology-tree__host";
  inner.innerHTML = '<div class="ontology-tree-state" role="status">加载本体中…</div>';
  host.replaceChildren(inner);
  try {
    const module = await loadTreeModule();
    if (!inner.isConnected) {
      treeState = "idle";
      return;
    }
    controller = buildController(module, inner);
    const data = await module.loadOntologyTree();
    if (!controller) {
      treeState = "idle";
      return;
    }
    controller.update(Array.isArray(data?.items) ? data.items : [], "");
    treeState = "ready";
    bindTreeDrag(inner);
  } catch (error) {
    treeState = "error";
    try {
      controller?.destroy();
    } catch {}
    controller = null;
    host.replaceChildren();
    const failure = document.createElement("div");
    failure.className = "ontology-tree-state ontology-tree-state--error";
    failure.setAttribute("role", "alert");
    failure.textContent = "本体加载失败";
    host.appendChild(failure);
  }
}

function refreshTree() {
  const host = byId(TREE_HOST_ID);
  if (!host) return;
  treeState = "idle";
  const previous = controller;
  controller = null;
  host.replaceChildren();
  if (previous) {
    // DHTMLX 会排队重绘，销毁要等当前绘制结束，否则重绘会读到已移除的节点。
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try {
        previous.destroy();
      } catch {}
    }));
  }
  return ensureTree();
}

/* ── 知识推荐面板（右侧） ───────────────────────────────── */

function readRecommendCollapsedState() {
  try {
    return window.localStorage.getItem(RECOMMEND_COLLAPSE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function persistRecommendCollapsedState(collapsed) {
  try {
    window.localStorage.setItem(RECOMMEND_COLLAPSE_STORAGE_KEY, String(collapsed));
  } catch {}
}

function setRecommendCollapsed(collapsed) {
  const panel = byId(RECOMMEND_PANEL_ID);
  const toggle = byId(RECOMMEND_TOGGLE_ID);
  if (!panel) return;
  panel.classList.toggle("is-collapsed", collapsed);
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.title = collapsed ? "展开知识推荐" : "收起知识推荐";
    const icon = toggle.querySelector("i");
    if (icon) {
      icon.classList.toggle("fa-chevron-right", !collapsed);
      icon.classList.toggle("fa-chevron-left", collapsed);
    }
  }
  resizeGraphAfterLayoutChange();
}

function setRecommendStatus(text, variant = "") {
  const el = byId(RECOMMEND_STATUS_ID);
  if (!el) return;
  if (recommendStatusTimer) {
    clearTimeout(recommendStatusTimer);
    recommendStatusTimer = null;
  }
  el.textContent = text || "";
  el.classList.toggle("is-error", variant === "error");
  el.classList.toggle("is-success", variant === "success");
  if (text) {
    recommendStatusTimer = setTimeout(() => {
      recommendStatusTimer = null;
      el.textContent = "";
      el.classList.remove("is-error", "is-success");
    }, STATUS_CLEAR_DELAY);
  }
}

function bindRecommendPanel() {
  const panel = byId(RECOMMEND_PANEL_ID);
  const toggle = byId(RECOMMEND_TOGGLE_ID);
  if (!panel || panel.dataset.toggleBound === "true") return;
  panel.dataset.toggleBound = "true";
  toggle?.addEventListener("click", () => {
    const collapsed = !panel.classList.contains("is-collapsed");
    setRecommendCollapsed(collapsed);
    persistRecommendCollapsedState(collapsed);
  });
  panel.addEventListener("click", (event) => {
    if (!panel.classList.contains("is-collapsed")) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button")) return;
    setRecommendCollapsed(false);
    persistRecommendCollapsedState(false);
  });
}

function recommendEndpoint(typeId) {
  const url = new URL("/api/kb/entity_search", window.location.origin);
  const append = window.appendCurrentDbParam;
  if (typeof append === "function") {
    const scoped = append(url);
    if (scoped instanceof URL) url.search = scoped.search;
  }
  url.searchParams.set("type", typeId);
  url.searchParams.set("limit", String(RECOMMEND_LIMIT));
  url.searchParams.set("offset", "0");
  url.searchParams.set("order", "modified_desc");
  // 只按本体类型筛选，未分类的知识一样推荐
  return url;
}

function renderRecommendState(html, variant = "") {
  const list = byId(RECOMMEND_LIST_ID);
  if (!list) return;
  list.replaceChildren();
  const state = document.createElement("div");
  state.className = variant ? `ontology-tree-state ${variant}` : "ontology-tree-state";
  state.textContent = html;
  list.appendChild(state);
}

const RECOMMEND_THUMB_PLACEHOLDER = "fa-solid fa-circle-nodes";

function recommendNodeId(node) {
  return String(node?._id ?? node?.id ?? "").trim();
}

function recommendNodeImage(node) {
  const candidates = [node?.image, node?.images, node?._attr_images];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const found = candidate.map((item) => String(item || "").trim()).find(Boolean);
      if (found) return found;
      continue;
    }
    const value = String(candidate || "").trim();
    if (value) return value;
  }
  return "";
}

function buildRecommendCard(node) {
  const id = recommendNodeId(node);
  const label = String(node?.name || node?.label || node?.label_zh || id).trim();
  const typeLabel = String(node?.classLabel || node?.typeLabel || node?.type || "").trim();
  const description = String(node?.description || "").replace(/\s+/g, " ").trim();
  const color = normalizeOntologyColor(node?.color);
  const image = recommendNodeImage(node);

  const card = document.createElement("div");
  card.className = "vis-recommend-card";
  card.setAttribute("role", "button");
  card.tabIndex = 0;
  card.dataset.recommendNodeId = id;
  card.dataset.recommendNodeLabel = label;
  card.style.setProperty("--recommend-node-color", color);
  card.title = "拖到画布加入关系图（或按回车）";
  recommendNodesById.set(id, node);

  const thumb = document.createElement("div");
  thumb.className = "vis-recommend-card__thumb";
  if (image) {
    const img = document.createElement("img");
    img.src = image;
    img.alt = "";
    img.loading = "lazy";
    thumb.appendChild(img);
  } else {
    const icon = document.createElement("i");
    icon.className = RECOMMEND_THUMB_PLACEHOLDER;
    icon.setAttribute("aria-hidden", "true");
    thumb.appendChild(icon);
  }

  const body = document.createElement("div");
  body.className = "vis-recommend-card__body";
  const name = document.createElement("span");
  name.className = "vis-recommend-card__name";
  name.textContent = label || id;
  body.appendChild(name);
  if (typeLabel) {
    const meta = document.createElement("span");
    meta.className = "vis-recommend-card__meta";
    const dot = document.createElement("span");
    dot.className = "vis-recommend-card__dot";
    const type = document.createElement("span");
    type.className = "vis-recommend-card__type";
    type.textContent = typeLabel;
    meta.append(dot, type);
    body.appendChild(meta);
  }
  if (description) {
    const desc = document.createElement("span");
    desc.className = "vis-recommend-card__desc";
    desc.textContent = description;
    body.appendChild(desc);
  }

  card.append(thumb, body);
  return card;
}

function renderRecommendations(list) {
  const host = byId(RECOMMEND_LIST_ID);
  if (!host) return;
  host.replaceChildren();
  if (!list.length) {
    renderRecommendState("该类型下暂时没有知识。");
    return;
  }
  const fragment = document.createDocumentFragment();
  list.forEach((node) => {
    if (!recommendNodeId(node)) return;
    fragment.appendChild(buildRecommendCard(node));
  });
  host.appendChild(fragment);
}

function ontologyLabelFor(ontologyId) {
  const labelEl = document.querySelector(
    `.vis-ontology-tree [data-tree-node-id="${CSS.escape ? CSS.escape(ontologyId) : ontologyId}"]`,
  );
  return String(labelEl?.textContent || "").trim() || ontologyId;
}

/** 推荐模式：按本体类型推荐 / 展示搜索结果，两者共用同一个列表。 */
function applyRecommendHint() {
  const hint = byId(RECOMMEND_HINT_ID);
  if (!hint) return;
  if (recommendMode === "search") {
    hint.textContent = `搜索「${searchQuery}」的结果，拖到画布即可加入关系图。`;
    return;
  }
  hint.textContent = recommendTypeId
    ? `「${recommendTypeLabel}」的推荐知识，拖到画布即可加入关系图。`
    : DEFAULT_RECOMMEND_HINT;
}

/** 搜索结果直接复用推荐列表展示，清空搜索时回到本体类型推荐。 */
function applySearchResults(detail) {
  const nodes = Array.isArray(detail?.nodes) ? detail.nodes : [];
  const query = String(detail?.query || "").trim();
  if (!query) {
    exitSearchMode();
    return;
  }
  recommendMode = "search";
  searchQuery = query;
  applyRecommendHint();
  if (!nodes.length) {
    renderRecommendState(`没有找到与「${query}」匹配的知识。`);
    setRecommendStatus(`搜索「${query}」没有匹配的知识`);
    return;
  }
  renderRecommendations(nodes);
  setRecommendStatus(`搜索「${query}」找到 ${nodes.length} 条知识`);
}

function exitSearchMode() {
  if (recommendMode !== "search") return;
  recommendMode = "type";
  searchQuery = "";
  applyRecommendHint();
  if (!recommendTypeId) {
    renderRecommendState("点击左侧本体树上的分类，查看该类型的知识。");
    setRecommendStatus("");
    return;
  }
  const cached = recommendCache.get(recommendTypeId);
  if (cached) renderRecommendations(cached);
  else void loadRecommendations(recommendTypeId);
}

async function loadRecommendations(ontologyId) {
  const list = byId(RECOMMEND_LIST_ID);
  if (!list) return;
  recommendMode = "type";
  searchQuery = "";
  recommendTypeId = ontologyId;
  recommendTypeLabel = ontologyId ? ontologyLabelFor(ontologyId) : "";
  applyRecommendHint();
  const seq = ++recommendRequestSeq;
  if (!ontologyId) {
    renderRecommendState("点击左侧本体树上的分类，查看该类型的知识。");
    setRecommendStatus("");
    return;
  }
  const cached = recommendCache.get(ontologyId);
  if (cached) {
    renderRecommendations(cached);
    setRecommendStatus(
      cached.length ? `已推荐 ${cached.length} 条「${recommendTypeLabel}」知识` : "该类型下暂时没有知识",
    );
    return;
  }
  renderRecommendState("正在推荐知识…");
  try {
    const response = await fetch(recommendEndpoint(ontologyId));
    if (seq !== recommendRequestSeq) return;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (seq !== recommendRequestSeq) return;
    const nodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
    recommendCache.set(ontologyId, nodes);
    renderRecommendations(nodes);
    setRecommendStatus(
      nodes.length ? `已推荐 ${nodes.length} 条「${recommendTypeLabel}」知识` : "该类型下暂时没有知识",
    );
  } catch (error) {
    if (seq !== recommendRequestSeq) return;
    renderRecommendState("知识推荐加载失败", "ontology-tree-state--error");
    setRecommendStatus(`知识推荐加载失败：${error?.message || error}`, "error");
  }
}

/* ── 拖拽：树/推荐卡片 → 画布 ────────────────────────────── */

function readIconColor(scopeEl) {
  const icon = scopeEl?.querySelector?.(".ontology-node-folder, .ontology-node-dot");
  return icon
    ? normalizeOntologyColor(getComputedStyle(icon).getPropertyValue("--ontology-node-color"))
    : DEFAULT_NODE_COLOR;
}

function readDragPayload(labelEl) {
  const id = String(labelEl?.dataset?.treeNodeId || "").trim();
  if (!id) return null;
  const label = String(labelEl.textContent || "").trim();
  const sibling = labelEl.previousElementSibling;
  const icon =
    sibling && sibling.matches?.(".ontology-node-folder, .ontology-node-dot")
      ? sibling
      : labelEl.parentElement?.querySelector?.(".ontology-node-folder, .ontology-node-dot");
  const color = icon
    ? normalizeOntologyColor(getComputedStyle(icon).getPropertyValue("--ontology-node-color"))
    : DEFAULT_NODE_COLOR;
  return { id, label, color };
}

/**
 * 树行里的任意元素（图标、文字、行本身）都能解析出本体分类，
 * 用户不必精确按在文字上。
 */
export function resolveTreePayload(target) {
  if (!target || typeof target.closest !== "function") return null;
  const labelEl = target.closest("[data-tree-node-id]");
  if (labelEl) return readDragPayload(labelEl);
  const row = target.closest("li[data-dhx-id]");
  if (!row || typeof row.getAttribute !== "function") return null;
  const id = String(row.getAttribute("data-dhx-id") || "").trim();
  if (!id) return null;
  const rowLabel = row.querySelector?.(".ontology-node-label");
  return {
    id,
    label: String(rowLabel?.textContent || "").trim(),
    color: readIconColor(row),
  };
}

function buildDragChip(payload) {
  const chip = document.createElement("div");
  chip.className = "vis-ontology-drag-chip";
  Object.assign(chip.style, {
    position: "fixed",
    top: "-200px",
    left: "-200px",
    padding: "4px 10px",
    borderRadius: "999px",
    border: "1px solid #cbd5f5",
    background: "#ffffff",
    color: "#0f172a",
    font: "12px/1.4 system-ui, sans-serif",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    boxShadow: "0 6px 18px rgba(15,23,42,.18)",
    pointerEvents: "none",
    zIndex: "20000",
  });
  const dot = document.createElement("span");
  dot.style.cssText = `width:10px;height:10px;border-radius:3px;background:${payload.color};`;
  const label = document.createElement("span");
  label.textContent = payload.label || payload.id;
  chip.append(dot, label);
  document.body.appendChild(chip);
  return chip;
}

/**
 * 推荐卡片 / 搜索结果 → 拖拽负载，都带节点 id、名称与类型。
 */
export function resolveRecommendPayload(target) {
  if (!target || typeof target.closest !== "function") return null;
  const card = target.closest("[data-recommend-node-id]");
  if (!card || typeof card.getAttribute !== "function") return null;
  const id = String(card.getAttribute("data-recommend-node-id") || "").trim();
  if (!id) return null;
  const label = String(card.getAttribute("data-recommend-node-label") || "").trim() || id;
  const typeAttr = String(card.getAttribute("data-recommend-node-type") || "").trim();
  const colorAttr = String(card.getAttribute("data-recommend-node-color") || "").trim();
  const color = colorAttr
    ? normalizeOntologyColor(colorAttr)
    : normalizeOntologyColor(getComputedStyle(card).getPropertyValue("--recommend-node-color"));
  return { kind: "node", id, label, type: typeAttr, color };
}

/** 树上的分类 → 新建节点；推荐卡片 → 已有知识加入画布。 */
export function resolveDragPayload(target) {
  const ontology = resolveTreePayload(target);
  if (ontology) return { kind: "ontology", ...ontology };
  return resolveRecommendPayload(target);
}

function graphBodyEl() {
  return document.querySelector(GRAPH_BODY_SELECTOR);
}

function isPointInside(point, rect) {
  if (!rect) return false;
  return (
    point.clientX >= rect.left &&
    point.clientX <= rect.right &&
    point.clientY >= rect.top &&
    point.clientY <= rect.bottom
  );
}

function positionDragChip(clientX, clientY) {
  if (!dragChip) return;
  dragChip.style.left = `${Math.round(clientX + DRAG_CHIP_OFFSET)}px`;
  dragChip.style.top = `${Math.round(clientY + DRAG_CHIP_OFFSET)}px`;
}

function startPointerDrag(event) {
  const payload = pointerDrag?.payload;
  if (!payload) return;
  pointerDrag.started = true;
  closePopover();
  dragChip = buildDragChip(payload);
  document.body.classList.add("vis-ontology-dragging");
  // 拖已有知识时提示文案不同（CSS 按这个类切换 ::after 内容）
  document.body.classList.toggle("is-recommend-drag", payload.kind === "node");
  positionDragChip(event.clientX, event.clientY);
}

/** 取当前视口的图模型坐标（与落点浮层用同一套换算）。 */
function currentGraphPoint(point) {
  const cyHost = byId(GRAPH_HOST_ID);
  const cyRect = cyHost?.getBoundingClientRect();
  if (!cyRect) return null;
  const cy = window.kbCy;
  const pan = typeof cy?.pan === "function" ? cy.pan() : { x: 0, y: 0 };
  const zoom = typeof cy?.zoom === "function" ? cy.zoom() : 1;
  return graphPointFromClient(
    cyRect,
    { panX: pan?.x, panY: pan?.y, zoom },
    point.clientX,
    point.clientY,
  );
}

function onPanelPointerDown(event) {
  if (event.button !== 0 || event.isPrimary === false) return;
  // 展开箭头沿用树自身的展开/收起行为
  if (event.target instanceof Element && event.target.closest(".dhx_tree-toggle-button")) return;
  const payload = resolveDragPayload(event.target);
  if (!payload) return;
  pointerDrag = {
    payload,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    started: false,
  };
}

function onPointerMove(event) {
  if (!pointerDrag) return;
  if (pointerDrag.pointerId !== undefined && event.pointerId !== pointerDrag.pointerId) return;
  if (!pointerDrag.started) {
    const moved =
      Math.abs(event.clientX - pointerDrag.startX) + Math.abs(event.clientY - pointerDrag.startY);
    if (moved < DRAG_THRESHOLD) return;
    startPointerDrag(event);
  }
  positionDragChip(event.clientX, event.clientY);
  const body = graphBodyEl();
  body?.classList.toggle(
    "is-ontology-drop-target",
    isPointInside(event, body.getBoundingClientRect()),
  );
}

function onPointerUp(event) {
  if (!pointerDrag) return;
  if (pointerDrag.pointerId !== undefined && event.pointerId !== pointerDrag.pointerId) return;
  const payload = pointerDrag.payload;
  const started = pointerDrag.started;
  const point = { clientX: event.clientX, clientY: event.clientY };
  clearDragState();
  if (!started) return;
  const body = graphBodyEl();
  if (!body || !isPointInside(point, body.getBoundingClientRect())) return;
  if (payload.kind === "node") {
    void addRecommendedNodeToGraph(payload, currentGraphPoint(point));
    return;
  }
  openCreatePopover(body, payload, point);
}

function onDragKeydown(event) {
  if (event.key === "Escape" && pointerDrag?.started) clearDragState();
}

function bindTreeDrag(host) {
  if (!host || host.dataset.dragBound === "true") return;
  host.dataset.dragBound = "true";
  if (dragWindowBound) return;
  dragWindowBound = true;
  // 树会随刷新重建，所以在 document 上统一代理；推荐卡片也走同一套逻辑
  document.addEventListener("pointerdown", onPanelPointerDown);
  // 拖拽过程中指针会移出面板，因此监听挂在 window 上
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", clearDragState);
  window.addEventListener("blur", clearDragState);
  window.addEventListener("keydown", onDragKeydown, true);
}

function clearDragState() {
  pointerDrag = null;
  document.body.classList.remove("vis-ontology-dragging");
  document.body.classList.remove("is-recommend-drag");
  graphBodyEl()?.classList.remove("is-ontology-drop-target");
  dragChip?.remove();
  dragChip = null;
}

/**
 * 把推荐里的知识拖入画布：只加这个节点本身，
 * 不拉下级关系、也不重新布局。
 */
async function addRecommendedNodeToGraph(payload, graphPoint) {
  if (typeof window.kbLoadGraphWithData !== "function" && !window.kbCy) {
    setRecommendStatus("加入画布失败：图谱模块不可用", "error");
    return;
  }
  const nodeData = recommendNodesById.get(payload.id) || {
    id: payload.id,
    name: payload.label,
    color: payload.color,
    type: payload.type || undefined,
    classLabel: payload.type || undefined,
  };
  const spec = ontologyNodeCyElement(nodeData, payload.label);
  if (!spec) {
    setRecommendStatus("加入画布失败：缺少节点标识", "error");
    return;
  }
  const placed = await placeNodeInGraph(spec, graphPoint);
  if (placed) setRecommendStatus(`已把「${payload.label}」加入画布`, "success");
  else setRecommendStatus(`加入画布失败：「${payload.label}」`, "error");
}

function onRecommendListKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const payload = resolveRecommendPayload(event.target);
  if (!payload) return;
  event.preventDefault();
  void addRecommendedNodeToGraph(payload, null);
}

/* ── 落点浮层：输入名称 → 创建节点 ───────────────────────── */

function closePopover() {
  const current = popover;
  popover = null;
  current?.remove();
  popoverCleanup?.();
  popoverCleanup = null;
}

function openCreatePopover(body, payload, point) {
  closePopover();
  const bodyRect = body.getBoundingClientRect();
  const graphPoint = currentGraphPoint(point);

  const form = document.createElement("form");
  form.className = "vis-node-popover";
  form.setAttribute("role", "dialog");
  form.setAttribute("aria-label", `新建${payload.label || "本体"}节点`);

  const head = document.createElement("div");
  head.className = "vis-node-popover__head";
  const dot = document.createElement("span");
  dot.className = "vis-node-popover__color";
  dot.style.setProperty("--vis-node-color", payload.color || DEFAULT_NODE_COLOR);
  const type = document.createElement("span");
  type.className = "vis-node-popover__type";
  type.textContent = payload.label || payload.id;
  head.append(dot, type);

  const input = document.createElement("input");
  input.type = "text";
  input.className = "vis-node-popover__input";
  input.placeholder = "输入节点名称，回车创建";
  input.setAttribute("aria-label", "节点名称");
  input.autocomplete = "off";

  const actions = document.createElement("div");
  actions.className = "vis-node-popover__actions";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "btn primary sm";
  submit.textContent = "创建";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn sm";
  cancel.textContent = "取消";
  actions.append(submit, cancel);

  const status = document.createElement("div");
  status.className = "vis-node-popover__status";
  status.setAttribute("role", "status");

  form.append(head, input, actions, status);
  body.appendChild(form);
  popover = form;

  const popoverRect = form.getBoundingClientRect();
  const position = clampPopoverPosition(
    { x: point.clientX - bodyRect.left, y: point.clientY - bodyRect.top },
    { width: popoverRect.width || 236, height: popoverRect.height || 140 },
    { width: bodyRect.width, height: bodyRect.height },
  );
  form.style.left = `${Math.round(position.left)}px`;
  form.style.top = `${Math.round(position.top)}px`;

  cancel.addEventListener("click", closePopover);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = String(input.value || "").trim();
    if (!name) {
      status.textContent = "请输入节点名称";
      input.focus();
      return;
    }
    submit.disabled = true;
    status.textContent = "创建中…";
    try {
      const node = await createNode(payload.id, name);
      const addedToGraph = await addCreatedNodeToGraph(node, name, graphPoint);
      closePopover();
      const typeLabel = payload.label || payload.id;
      notify(
        addedToGraph
          ? `已创建「${name}」（${typeLabel}）`
          : `已创建「${name}」（${typeLabel}）。加载图谱后可在画布查看`,
        "success",
      );
      refreshKnowledgeList();
    } catch (error) {
      submit.disabled = false;
      status.textContent = `创建失败：${error?.message || error}`;
    }
  });

  const onKeydown = (event) => {
    if (event.key === "Escape" && popover === form) closePopover();
  };
  const onPointerDown = (event) => {
    const target = event.target;
    if (popover !== form) return;
    if (target instanceof Node && form.contains(target)) return;
    closePopover();
  };
  document.addEventListener("keydown", onKeydown, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  popoverCleanup = () => {
    document.removeEventListener("keydown", onKeydown, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
  };
  input.focus();
}

async function createNode(ontologyId, name) {
  const body = {
    name,
    typeId: ontologyId,
    description: "",
    visibility: "public",
  };
  if (typeof window.apiPost === "function") {
    const response = await window.apiPost("/api/kb/nodes", body);
    return response?.node || null;
  }
  const target =
    typeof window.appendCurrentDbParam === "function"
      ? window.appendCurrentDbParam("/api/kb/nodes")
      : "/api/kb/nodes";
  const response = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload?.error || payload?.detail || "";
    } catch {}
    throw new Error("HTTP " + response.status + (detail ? ": " + detail : ""));
  }
  const payload = await response.json();
  return payload?.node || null;
}

/**
 * 把一个节点元素放进画布：画布为空时用该节点初始化图谱实例，
 * 否则直接 add —— 不拉取关系、也不触发重新布局。
 */
async function placeNodeInGraph(spec, graphPoint) {
  const hadGraph = Boolean(window.kbCy);
  if (!hadGraph) {
    if (typeof window.kbLoadGraphWithData !== "function") return false;
    try {
      await window.kbLoadGraphWithData({
        nodes: [spec.data],
        edges: [],
        counts: { nodes: 1, edges: 0 },
      });
    } catch (error) {
      console.warn("初始化关系图失败", error);
      return false;
    }
  }
  const cy = window.kbCy;
  if (!cy) return false;
  try {
    const existing = cy.getElementById(spec.data.id);
    if (existing && existing.length) existing.data(spec.data);
    else cy.add(spec);
    const element = cy.getElementById(spec.data.id);
    if (!element || !element.length) return false;
    const placeAtDropPoint = () => {
      if (graphPoint) element.position(graphPoint);
    };
    placeAtDropPoint();
    // 保持单选：只选中刚加入的节点
    cy.elements().unselect();
    element.select();
    element.addClass("new-node");
    element.style("border-width", 4);
    element.style("border-color", "#22c55e");
    setTimeout(() => {
      try {
        element.style("border-width", "");
        element.style("border-color", "");
      } catch {}
    }, 2000);
    if (hadGraph) {
      // 已有实例时底栏计数需要自己 +1；新建实例时 loadGraph 已按节点数刷新过
      syncGraphCounters();
    } else {
      // 新建实例会再跑一次默认布局，等布局结束把节点放回落点
      cy.one("layoutstop", () => {
        try {
          placeAtDropPoint();
          element.select();
        } catch {}
      });
    }
    return true;
  } catch (error) {
    console.warn("添加节点到关系图失败", error);
    return false;
  }
}

async function addCreatedNodeToGraph(node, fallbackLabel, graphPoint) {
  const spec = ontologyNodeCyElement(node, fallbackLabel);
  if (!spec) return false;
  return await placeNodeInGraph(spec, graphPoint);
}

function syncGraphCounters() {
  try {
    const all = byId("cyCountAll");
    if (all && all.textContent) {
      all.textContent = incrementGraphCount(all.textContent, ["全部"]);
    }
    const status = byId("visStatusText");
    if (status && status.textContent) {
      status.textContent = incrementGraphCount(status.textContent, ["节点"]);
    }
  } catch {}
}

function refreshKnowledgeList() {
  try {
    if (typeof window.loadTablePage === "function") {
      void window.loadTablePage({ resetPage: true });
    }
  } catch {}
}

/* ── 初始化 ────────────────────────────────────────────── */

function watchGraphVisibility() {
  const wrap = byId(GRAPH_WRAP_ID);
  if (!wrap) return;
  const sync = () => {
    if (wrap.style.display === "none") return;
    const collapsed = byId(PANEL_ID)?.classList.contains("is-collapsed");
    if (!collapsed) void ensureTree();
  };
  new MutationObserver(sync).observe(wrap, { attributes: true, attributeFilter: ["style", "class"] });
  sync();
}

function bindRecommendListEvents() {
  const list = byId(RECOMMEND_LIST_ID);
  if (!list || list.dataset.bound === "true") return;
  list.dataset.bound = "true";
  // 只能拖拽入画布：点击不把知识加进关系图
  list.addEventListener("keydown", onRecommendListKeydown);
}

function init() {
  const panel = byId(PANEL_ID);
  if (!panel) return;
  bindPanelToggle();
  setCollapsed(readCollapsedState());
  bindRecommendPanel();
  setRecommendCollapsed(readRecommendCollapsedState());
  bindRecommendListEvents();
  // 搜索节点：结果直接复用推荐列表展示，清空搜索时回到本体类型推荐
  window.addEventListener("kb:vis-search-results", (event) => {
    applySearchResults(event.detail || {});
  });
  window.addEventListener("kb:ontologies-updated", () => {
    if (treeState === "ready" || treeState === "error") void refreshTree();
    recommendCache.clear();
    if (recommendTypeId) void loadRecommendations(recommendTypeId);
  });
  window.addEventListener("hashchange", closePopover);
  watchGraphVisibility();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
}

if (typeof window !== "undefined") {
  window.kbVisOntologyPanel = {
    refresh: refreshTree,
    setCollapsed,
    setRecommendCollapsed,
    loadRecommendations,
    isReady: () => treeState === "ready",
  };
}
