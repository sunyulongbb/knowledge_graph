// public/assets/scripts/knowledge-explore.js
(function() {
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function buildExploreTree(rows) {
    const byId = new Map;
    for (const row of rows) {
      const id = String(row.id || "");
      if (id && !byId.has(id))
        byId.set(id, { ...row, id, parent_id: String(row.parent_id || row.parent || "") });
    }
    const children = new Map;
    for (const row of byId.values()) {
      const seen = new Set([row.id]);
      let parent = row.parent_id;
      while (parent && byId.has(parent) && !seen.has(parent)) {
        seen.add(parent);
        parent = byId.get(parent).parent_id;
      }
      if (!byId.has(row.parent_id) || parent && seen.has(parent))
        row.parent_id = "";
      if (!children.has(row.parent_id))
        children.set(row.parent_id, []);
      children.get(row.parent_id).push(row);
    }
    return { byId, children, roots: children.get("") || [] };
  }
  const panel = document.createElement("section");
  panel.id = "knowledgeExplorePage";
  panel.setAttribute("aria-label", "探索知识分类");
  document.getElementById("applicationHomePanel").append(panel);
  let tree = buildExploreTree([]), selected = "", items = [], total = 0, page = 1;
  let loadingTree = false, loadingItems = false, treeError = "", itemsError = "", treeVersion = 0, itemsVersion = 0;
  const expanded = new Map;
  const pageSize = 12;
  function writeExploreRoute() {
    if (window.kbViewMode !== "app_explore")
      return;
    const url = new URL(location.href);
    if (selected)
      url.searchParams.set("explore_category", selected);
    else
      url.searchParams.delete("explore_category");
    if (selected && page > 1)
      url.searchParams.set("explore_page", String(page));
    else
      url.searchParams.delete("explore_page");
    window.history.replaceState(window.history.state, "", url);
  }
  const name = (row) => row.name || row.label || row.id;
  const childrenOf = (id) => tree.children.get(id) || [];
  const imageUrl = (value) => typeof value === "string" && /^(https?:\/\/|\/(?!\/))/i.test(value.trim()) ? value.trim() : "";
  async function api(path, params = {}) {
    const url = new URL(path, location.origin);
    const db = new URLSearchParams(location.search).get("db");
    if (db)
      url.searchParams.set("db", db);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok)
      throw Error(`加载失败（${response.status}）`);
    return response.json();
  }
  function ancestry(id) {
    const result = [], seen = new Set;
    while (id && tree.byId.has(id) && !seen.has(id)) {
      seen.add(id);
      const row = tree.byId.get(id);
      result.unshift(row);
      id = row.parent_id;
    }
    return result;
  }
  function categoryCard(row) {
    const image = imageUrl(row.image), color = /^#[\da-f]{6}$/i.test(row.color || "") ? row.color : "";
    return `<button class="explore-category-card" type="button" data-explore-category="${escape(row.id)}">
      <span class="explore-category-icon" ${color ? `style="--category-color:${color}"` : ""}>${image ? `<img src="${escape(image)}" alt="" loading="lazy">` : '<i class="fa-solid fa-shapes" aria-hidden="true"></i>'}</span>
      <span class="explore-category-info"><strong>${escape(name(row))}</strong><small>${Math.max(0, Number(row.instance_count) || 0)} 条直属知识 · ${childrenOf(row.id).length} 个子分类</small></span>
      <span class="explore-category-open">探索 <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></span>
      <span class="explore-category-description">${escape(row.description || "沿着分类发现知识之间的联系，探索更多内容。")}</span>
    </button>`;
  }
  function group(title, rows, key, parentId = "") {
    const count = expanded.get(key) || 6;
    return `<section class="explore-group"><div class="explore-group-heading"><h2>${parentId ? `<button type="button" data-explore-category="${escape(parentId)}">${escape(title)}</button>` : escape(title)}</h2>${parentId ? `<button type="button" data-explore-category="${escape(parentId)}">查看全部 <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>` : ""}</div>
      <div class="explore-category-grid">${rows.slice(0, count).map(categoryCard).join("")}</div>
      ${rows.length > count ? `<button class="explore-show-more" type="button" data-explore-more="${escape(key)}">显示更多 <i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>` : ""}</section>`;
  }
  function knowledgeSection() {
    const current = tree.byId.get(selected);
    if (!current)
      return "";
    const content = loadingItems ? '<div class="explore-state" role="status">正在加载分类知识…</div>' : itemsError ? `<div class="explore-state" role="alert">${escape(itemsError)} <button type="button" data-explore-retry-items>重试</button></div>` : items.length ? `<div class="explore-knowledge-grid">${items.map((item) => {
      const media = window.homeKnowledgeMediaViewer?.collectMedia(item) || [];
      const urlOf = (value) => imageUrl(typeof value === "object" && value ? value.url || value.src : value);
      const video = media.find((value) => value.kind === "video")?.url || urlOf(item.video || item.videos?.[0]);
      const images = media.filter((value) => value.kind === "image");
      const cover = urlOf(item.cover || item.covers?.[0]);
      const image = (video ? cover : "") || images[0]?.url || urlOf(item.image || item.images?.[0]) || cover;
      const title = item.name || item.label || item.id;
      return `<article class="explore-knowledge-card explore-media-tile${!image && !video ? " is-text" : ""}" ><button type="button" class="explore-tile-media" data-explore-node="${escape(item.id || item._id)}" aria-label="查看 ${escape(title)}" title="${escape(title)}">${image ? `<img src="${escape(image)}" alt="" loading="lazy" decoding="async">` : video ? `<video src="${escape(video)}" muted playsinline preload="metadata"></video>` : '<span class="explore-tile-placeholder"><i class="fa-regular fa-lightbulb" aria-hidden="true"></i></span>'}${video || images.length > 1 ? `<span class="explore-tile-kind" aria-label="${video ? "视频" : "多图"}"><i class="${video ? "fa-solid fa-play" : "fa-regular fa-clone"}" aria-hidden="true"></i></span>` : ""}</button><span class="explore-tile-caption"><button type="button" data-explore-detail="${escape(item.id || item._id)}"><strong>${escape(title)}</strong></button><small>${escape(item.description || "查看知识详情")}</small></span></article>`;
    }).join("")}</div>` : '<div class="explore-state">该分类下暂无可浏览的知识，可继续探索子分类。</div>';
    const pages = Math.max(1, Math.ceil(total / pageSize));
    return `<section class="explore-group"><div class="explore-group-heading"><h2>${escape(name(current))}的知识</h2><span>${total} 条知识（含子分类）</span></div>${content}${!loadingItems && !itemsError && pages > 1 ? `<nav class="explore-pagination" aria-label="分类知识分页"><button type="button" data-explore-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一页</button><span>${page} / ${pages}</span><button type="button" data-explore-page="${page + 1}" ${page >= pages ? "disabled" : ""}>下一页</button></nav>` : ""}</section>`;
  }
  function render() {
    const crumbs = ancestry(selected), activeRoot = crumbs[0]?.id || "";
    let content;
    if (loadingTree)
      content = '<div class="explore-state" role="status">正在加载分类…</div>';
    else if (treeError)
      content = `<div class="explore-state" role="alert">${escape(treeError)} <button type="button" data-explore-retry>重新加载</button></div>`;
    else if (!tree.byId.size)
      content = '<div class="explore-state"><i class="fa-solid fa-shapes" aria-hidden="true"></i><h2>还没有分类</h2><p>在知识库中建立分类后，即可在这里探索。</p><button type="button" data-explore-workspace>管理分类</button></div>';
    else if (selected) {
      content = `<nav class="explore-breadcrumbs" aria-label="分类路径"><button type="button" data-explore-category="">全部分类</button>${crumbs.map((row) => `<span aria-hidden="true">/</span><button type="button" data-explore-category="${escape(row.id)}" ${row.id === selected ? 'aria-current="page"' : ""}>${escape(name(row))}</button>`).join("")}</nav>`;
      const children = childrenOf(selected);
      if (children.length)
        content += group("继续探索子分类", children, selected);
      content += knowledgeSection();
    } else {
      const recommended = [...tree.byId.values()].filter((row) => Number(row.instance_count) > 0).sort((a, b) => Number(b.instance_count) - Number(a.instance_count)).slice(0, 6);
      content = recommended.length ? group("从这些分类开始", recommended, "recommended") : "";
      for (const root of tree.roots)
        content += group(name(root), childrenOf(root.id).length ? childrenOf(root.id) : [root], root.id, root.id);
    }
    panel.innerHTML = `<div class="explore-content"><header class="explore-heading"><p>EXPLORE KNOWLEDGE</p><h1>${escape(tree.byId.has(selected) ? name(tree.byId.get(selected)) : "探索知识")}</h1><span>从分类出发，发现值得深入的知识。</span></header>
      <nav class="explore-topic-tabs" aria-label="一级分类"><button type="button" data-explore-category="" ${!selected ? 'aria-current="page"' : ""}>全部</button>${tree.roots.map((row) => `<button type="button" data-explore-category="${escape(row.id)}" ${row.id === activeRoot ? 'aria-current="page"' : ""}>${escape(name(row))}</button>`).join("")}</nav>${content}</div>`;
  }
  async function loadItems(nextPage = 1) {
    const version = ++itemsVersion, category = selected;
    page = nextPage;
    loadingItems = true;
    itemsError = "";
    render();
    try {
      const data = await api("/api/kb/discover/search", { class_id: category, order: "richness", limit: pageSize, offset: (page - 1) * pageSize });
      if (version !== itemsVersion || selected !== category)
        return;
      items = data.nodes || [];
      total = Number(data.total) || 0;
      const lastPage = Math.max(1, Math.ceil(total / pageSize));
      if (page > lastPage)
        return loadItems(lastPage);
      writeExploreRoute();
    } catch (error) {
      if (version === itemsVersion)
        itemsError = error.message || "知识加载失败";
    } finally {
      if (version === itemsVersion) {
        loadingItems = false;
        render();
      }
    }
  }
  function selectCategory(id) {
    if (id && !tree.byId.has(id))
      return;
    itemsVersion++;
    selected = id;
    items = [];
    total = 0;
    page = 1;
    itemsError = "";
    loadingItems = false;
    writeExploreRoute();
    panel.scrollTop = 0;
    render();
    if (id)
      loadItems();
  }
  window.loadKnowledgeExplore = async function() {
    const version = ++treeVersion;
    const params = new URLSearchParams(location.search);
    const requestedCategory = params.get("explore_category") || "";
    const requestedPage = Number(params.get("explore_page") || 1);
    loadingTree = true;
    treeError = "";
    render();
    try {
      const data = await api("/api/kb/classes");
      if (version !== treeVersion)
        return;
      tree = buildExploreTree(Array.isArray(data) ? data : data.items || []);
      selected = tree.byId.has(requestedCategory) ? requestedCategory : "";
      page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
      if (!selected)
        page = 1;
      writeExploreRoute();
      loadingTree = false;
      render();
      if (selected)
        loadItems(page);
    } catch (error) {
      if (version !== treeVersion)
        return;
      loadingTree = false;
      treeError = error.message || "分类加载失败";
      render();
    }
  };
  panel.addEventListener("click", (event) => {
    const category = event.target.closest("[data-explore-category]");
    if (category) {
      selectCategory(category.dataset.exploreCategory);
      return;
    }
    const more = event.target.closest("[data-explore-more]");
    if (more) {
      const key = more.dataset.exploreMore;
      expanded.set(key, (expanded.get(key) || 6) + 6);
      render();
      return;
    }
    const paging = event.target.closest("[data-explore-page]");
    if (paging && !paging.disabled) {
      loadItems(Number(paging.dataset.explorePage));
      return;
    }
    const detail = event.target.closest("[data-explore-detail]");
    if (detail) {
      window.setViewMode("knowledge_detail", { targetNodeId: detail.dataset.exploreDetail });
      return;
    }
    const node = event.target.closest("[data-explore-node]");
    if (node) {
      window.kbShortsLaunch = { nodes: items.slice(), category: name(tree.byId.get(selected)) };
      window.setViewMode("shorts", { targetNodeId: node.dataset.exploreNode });
      return;
    }
    if (event.target.closest("[data-explore-retry]"))
      window.loadKnowledgeExplore();
    if (event.target.closest("[data-explore-retry-items]"))
      loadItems(page);
    if (event.target.closest("[data-explore-workspace]"))
      window.setViewMode("table");
  });
  window.addEventListener("kb-auth-change", () => {
    treeVersion++;
    itemsVersion++;
    tree = buildExploreTree([]);
    items = [];
    selected = "";
    if (window.kbViewMode === "app_explore")
      window.loadKnowledgeExplore();
  });
  if (window.kbViewMode === "app_explore")
    window.loadKnowledgeExplore();
})();
