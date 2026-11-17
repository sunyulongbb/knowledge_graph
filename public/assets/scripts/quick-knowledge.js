(function () {
  function splitTags(value) {
    const tags = new Map();
    String(value || "")
      .split(/[,，;；、\n]+/)
      .forEach((raw) => {
        const tag = raw.trim();
        if (tag && !tags.has(tag.toLowerCase()))
          tags.set(tag.toLowerCase(), tag);
      });
    return [...tags.values()];
  }
  function parseQuickComposer(text, extraTags = "") {
    const parsed = window.parseComposerNodeText(text, extraTags);
    let tagText = String(text);
    for (const tag of splitTags(extraTags).sort(
      (left, right) => right.length - left.length,
    )) {
      const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      tagText = tagText.replace(
        new RegExp(
          `(^|\\s)#${escaped}(?=$|[\\s，,。.!！？；;：:）)\\]}>》」』】])`,
          "gi",
        ),
        "$1",
      );
    }
    const inlineTags = Array.from(
      tagText.matchAll(/(?:^|\s)#([^\s#@，,。.!！？；;：:）)\]}>》」』】]+)/g),
      (match) => match[1],
    );
    // Keep explicitly entered tags (including spaces) intact, and deduplicate both sources.
    const tags = splitTags([...splitTags(extraTags), ...inlineTags].join(","));
    return { ...parsed, tags };
  }
  function categoryOptions(rows) {
    const byId = new Map(rows.map((row) => [String(row.id), row]));
    return rows.map((row) => {
      const path = [row.name || row.label || row.id],
        seen = new Set([String(row.id)]);
      let parent = String(row.parent_id || row.parent || "");
      while (parent && byId.has(parent) && !seen.has(parent)) {
        seen.add(parent);
        const item = byId.get(parent);
        path.unshift(item.name || item.label || item.id);
        parent = String(item.parent_id || item.parent || "");
      }
      return { id: String(row.id), label: path.join(" / ") };
    });
  }
  function buildCategoryTree(rows) {
    const byId = new Map();
    const collect = (nodes, parent = "") => {
      for (const node of nodes) {
        const id = String(node.id || "");
        if (!id || byId.has(id)) continue;
        byId.set(id, {
          ...node,
          id,
          parent_id: String(node.parent_id || node.parent || parent),
          children: [],
        });
        collect(node.children || [], id);
      }
    };
    collect(rows);
    const roots = [];
    for (const node of byId.values()) {
      const seen = new Set([node.id]);
      let parent = node.parent_id;
      while (parent && byId.has(parent) && !seen.has(parent)) {
        seen.add(parent);
        parent = byId.get(parent).parent_id;
      }
      if (!byId.has(node.parent_id) || (parent && seen.has(parent)))
        node.parent_id = "";
      if (node.parent_id) byId.get(node.parent_id).children.push(node);
      else roots.push(node);
    }
    return roots;
  }
  const dialog = document.createElement("dialog");
  dialog.id = "quickKnowledgeDialog";
  dialog.setAttribute("aria-labelledby", "quickKnowledgeTitle");
  dialog.innerHTML = `<form id="quickKnowledgeForm">
    <div class="quick-knowledge-header"><div class="quick-publisher"><span class="quick-publisher-avatar" data-quick-avatar aria-hidden="true"></span><div><strong data-quick-author></strong><small data-quick-app></small></div></div><h2 id="quickKnowledgeTitle" class="quick-sr-only">新增知识</h2></div>
    <div class="quick-knowledge-layout" data-quick-layout><div class="quick-knowledge-fields">
      <div class="quick-ontology-picker"><button type="button" class="social-ontology-trigger" data-quick-ontology aria-expanded="false" aria-controls="quickOntologyDropdown"><i class="fa-solid fa-tag" aria-hidden="true"></i><span data-quick-ontology-label>添加本体</span></button><select name="type" hidden aria-label="本体类型"><option value="">暂不设置</option></select></div>
      <div id="quickOntologyDropdown" class="ontology-floating-dropdown is-portal quick-ontology-dropdown" hidden><label class="quick-sr-only" for="quickOntologySearch">搜索本体</label><input id="quickOntologySearch" type="search" data-quick-ontology-search placeholder="搜索本体" autocomplete="off"><div class="ontology-dropdown-plugin-host" data-quick-ontology-tree></div></div>
      <div class="quick-body-editor"><label class="quick-sr-only" for="quickKnowledgeContent">知识内容</label><textarea id="quickKnowledgeContent" name="content" rows="6" required maxlength="14000" placeholder="写下知识标题&#10;&#10;空一行，补充描述…"></textarea>
      <div class="quick-composer-tools" role="toolbar" aria-label="添加内容">
        <button type="button" data-quick-pick="image" title="添加图片或 GIF" aria-label="添加图片或 GIF"><i class="fa-regular fa-image" aria-hidden="true"></i></button>
        <button type="button" data-quick-pick="video" title="添加视频" aria-label="添加视频"><i class="fa-solid fa-video" aria-hidden="true"></i></button>
        <button type="button" data-quick-toggle="link" title="来源链接" aria-label="来源链接" aria-expanded="false"><i class="fa-solid fa-link" aria-hidden="true"></i></button>
        <button type="button" data-quick-pick="pdf" title="添加 PDF" aria-label="添加 PDF"><i class="fa-regular fa-file-pdf" aria-hidden="true"></i></button>
        <button type="button" data-quick-format="list" title="插入列表" aria-label="插入列表"><i class="fa-solid fa-list-ul" aria-hidden="true"></i></button>
        <button type="button" data-quick-format="divider" title="插入分隔线" aria-label="插入分隔线"><i class="fa-solid fa-grip-lines" aria-hidden="true"></i></button>
      </div></div>
      <div class="quick-composer-preview" data-quick-preview hidden><span>标题</span><strong data-quick-title-preview></strong><small data-quick-alias-preview></small></div>
      <div class="quick-attachments" data-quick-attachments aria-label="附件预览"></div>
      <div class="quick-composer-panel" data-quick-panel="link" hidden><label>来源链接<input class="kb-input" name="link" type="url" maxlength="2000" placeholder="https://…"></label></div>
      <div class="quick-composer-panel" data-quick-panel="tags" hidden><label>标签<input class="kb-input" name="tags" maxlength="2000" placeholder="用逗号分隔标签"></label></div>
      <div class="quick-composer-meta"><span class="quick-category-summary" data-quick-category-label>未选择分类</span></div>
      <input type="file" data-quick-file="image" accept="image/*" multiple hidden><input type="file" data-quick-file="video" accept=".mp4,.webm,.avi,.mkv,.ogg,.mpeg" multiple hidden><input type="file" data-quick-file="pdf" accept="application/pdf,.pdf" hidden>
    </div>
    <aside class="quick-category-sidebar" aria-label="知识分类"><div class="quick-category-heading"><button type="button" data-quick-clear="category">清空</button></div><select name="category" multiple hidden aria-label="已选知识分类"></select><div id="quickCategoryTree" class="ontology-dropdown-plugin-host quick-category-tree" data-quick-category-tree></div><p class="quick-knowledge-options-status" data-quick-options role="status"></p></aside></div>
    <div class="quick-knowledge-success" data-quick-success hidden><i class="fa-regular fa-circle-check" aria-hidden="true"></i><h3>知识已创建</h3><p>已保存到当前应用。</p><button type="button" class="btn" data-quick-another>继续新增</button></div>
    <p class="quick-knowledge-message" data-quick-message role="status" aria-live="polite"></p>
    <div class="quick-knowledge-footer"><button type="button" class="btn" data-quick-close>关闭</button><label class="quick-audience"><i class="fa-solid fa-earth-asia" aria-hidden="true"></i><span class="quick-sr-only">可见性</span><select name="visibility" aria-label="可见性"><option value="public">所有人可见</option><option value="private">仅自己可见</option></select></label><button type="submit" class="btn primary" data-quick-save>立即发布 <i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button><button type="button" class="btn primary" data-quick-done hidden>完成</button></div>
  </form>`;
  document.body.append(dialog);
  // Reuse the original controls, arranged around the writing surface.
  const editorFields = dialog.querySelector(".quick-knowledge-fields");
  const editorBody = dialog.querySelector(".quick-body-editor");
  const editorToolbar = document.createElement("div");
  editorToolbar.className = "quick-editor-topline";
  dialog.querySelector(".quick-ontology-picker").hidden = true;
  dialog.querySelector(".quick-knowledge-header").append(dialog.querySelector(".quick-audience"));
  const meta = dialog.querySelector(".quick-composer-meta");
  const categorySummary = meta.querySelector(".quick-category-summary");
  dialog.querySelector(".quick-category-heading").after(categorySummary);
  // Keep the writing surface first; place the count alongside attachment tools.
  dialog.querySelector(".quick-composer-tools").append(meta);
  const attachmentTools = dialog.querySelector(".quick-composer-tools");
  editorBody.after(attachmentTools);
  const form = dialog.querySelector("form"),
    fields = form.elements;
  const get = (selector) => dialog.querySelector(selector);
  let saving = false,
    saved = false,
    version = 0,
    previousFocus;
  let attachments = [];
  let categoryController = null,
    categoryNodes = [],
    categoryVersion = 0;
  const choiceRows = { category: [], type: [] };
  const addCategory = document.createElement('button');
  addCategory.type = 'button'; addCategory.textContent = '＋ 新建分类';
  addCategory.className = 'quick-category-add';
  get('.quick-category-heading').append(addCategory);
  const categoryEditor = document.createElement('div'); categoryEditor.hidden = true;
  categoryEditor.className = 'quick-category-inline';
  categoryEditor.innerHTML = '<small data-parent></small><div><input maxlength="100" placeholder="输入分类名称，回车添加" aria-label="新分类名称"><button type="button" data-create aria-label="添加分类">添加</button><button type="button" data-cancel aria-label="取消新建">×</button></div>';
  get('.quick-category-heading').after(categoryEditor);
  addCategory.onclick = () => {
    if (saving || saved) return;
    categoryEditor.dataset.parent = categoryPath[categoryPath.length - 1] || '';
    const parentName = Array.from(fields.namedItem('category').options).find(option => option.value === categoryEditor.dataset.parent)?.textContent;
    categoryEditor.querySelector('[data-parent]').textContent = parentName ? `添加到「${parentName.trim()}」下` : '添加根级分类';
    categoryEditor.hidden = false; categoryEditor.querySelector('input').focus();
  };
  categoryEditor.querySelector('[data-cancel]').onclick = () => { categoryEditor.hidden = true; };
  categoryEditor.querySelector('input').addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Enter') { event.preventDefault(); categoryEditor.querySelector('[data-create]').click(); }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); categoryEditor.hidden = true; (dialog.dataset.step === 'type' ? typeStep.querySelector('.quick-type-add') : addCategory).focus(); }
  });
  categoryEditor.querySelector('[data-create]').onclick = async () => {
    const input = categoryEditor.querySelector('input'), button = categoryEditor.querySelector('[data-create]');
    const name = input.value.trim(); if (!name || saving || saved) return;
    button.disabled = true;
    const scope = scopedUrl('/api/kb/classes').href;
    try {
      const response = await fetch(scope, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parent_id: categoryEditor.dataset.parent || null }) });
      if (!response.ok) throw new Error(await response.text());
      const created = await response.json();
      const refreshed = await fetch(scope); if (!refreshed.ok) throw new Error('分类刷新失败');
      const data = await refreshed.json();
      if (!dialog.open || scope !== scopedUrl('/api/kb/classes').href) return;
      categoryNodes = buildCategoryTree(Array.isArray(data) ? data : data.items || []);
      const flatten = rows => rows.flatMap(row => [row, ...flatten(row.children || [])]);
      choiceRows.category = categoryOptions(flatten(categoryNodes));
      renderChoices('category');
      const option = Array.from(fields.namedItem('category').options).find(item => item.value === created.id);
      if (option) {
        if (dialog.dataset.step === 'type') for (const item of fields.namedItem('category').options) item.selected = false;
        option.selected = true;
      }
      updateMeta(); void renderCategoryTree();
      if (dialog.dataset.step === 'type') renderTypeStep();
      input.value = ''; categoryEditor.hidden = true;
      get('[data-quick-options]').textContent = '分类已添加并选中';
      window.dispatchEvent(new CustomEvent('kb:classes-updated'));
    } catch (error) { get('[data-quick-options]').textContent = `创建分类失败：${error.message}`; }
    finally { button.disabled = false; }
  };
  let ontologyController = null,
    ontologyItems = null,
    ontologyVersion = 0,
    ontologyScope = null;
  function togglePanel(key, force) {
    if (saving) return;
    const panel = get(`[data-quick-panel="${key}"]`);
    panel.hidden = force === undefined ? !panel.hidden : !force;
    dialog
      .querySelectorAll(`[data-quick-toggle="${key}"]`)
      .forEach((button) =>
        button.setAttribute("aria-expanded", String(!panel.hidden)),
      );
    if (!panel.hidden) panel.querySelector("input,select")?.focus();
  }
  function updateMeta() {
    const content = fields.namedItem("content");
    content.setCustomValidity("");
    const parsed = parseQuickComposer(
      content.value,
      fields.namedItem("tags").value,
    );

    const category = fields.namedItem("category"),
      type = fields.namedItem("type");
    const summary = get('[data-quick-category-label]');
    summary.replaceChildren();
    for (const option of Array.from(category.selectedOptions).filter(o => o.value)) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'quick-category-chip';
      chip.textContent = option.textContent.split(' / ').pop() + ' ×';
      chip.title = option.textContent;
      chip.setAttribute('aria-label', '移除分类：' + option.textContent);
      chip.disabled = saving || saved;
      chip.onclick = () => {
        if (saving || saved) return;
        option.selected = false; updateMeta(); void renderCategoryTree();
      };
      summary.append(chip);
    }
    summary.hidden = !summary.childElementCount;
    get('[data-quick-clear="category"]').hidden = !summary.childElementCount;
    get("[data-quick-ontology-label]").textContent = type.selectedOptions[0]
      ?.value
      ? type.selectedOptions[0].textContent
      : "添加本体";
    get("[data-quick-preview]").hidden = !content.value.trim();
    get("[data-quick-title-preview]").textContent = parsed.name || "请填写标题";
    get("[data-quick-alias-preview]").textContent = parsed.aliases.length
      ? `别名：${parsed.aliases.join("、")}`
      : "";
  }
  function renderAttachments() {
    const container = get("[data-quick-attachments]");
    container.replaceChildren();
    attachments.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "quick-attachment";
      if (item.kind === "image") {
        const image = document.createElement("img");
        image.src = item.preview;
        image.alt = item.file.name;
        card.append(image);
      }
      if (item.kind === "video") {
        const video = document.createElement("video");
        video.src = item.preview;
        video.controls = true;
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";
        if (item.cover) video.poster = item.cover;
        card.append(video);
        const state = document.createElement("small");
        state.textContent = item.cover
          ? "封面已提取"
          : item.coverError || "正在提取封面…";
        card.append(state);
      }
      if (item.kind === "pdf") {
        const icon = document.createElement("i");
        icon.className = "fa-regular fa-file-pdf";
        icon.setAttribute("aria-hidden", "true");
        card.append(icon);
      }
      const label = document.createElement("span");
      label.textContent = item.file.name;
      card.append(label);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `移除 ${item.file.name}`);
      remove.onclick = () => {
        if (saving) return;
        URL.revokeObjectURL(item.preview);
        attachments.splice(index, 1);
        renderAttachments();
      };
      card.append(remove);
      container.append(card);
    });
  }
  function addFiles(files) {
    if (saving || saved) return;
    for (const file of files) {
      const kind = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/") ||
            /\.(mp4|webm|avi|mkv|ogg|mpeg)$/i.test(file.name)
          ? "video"
          : file.type === "application/pdf" || /\.pdf$/i.test(file.name)
            ? "pdf"
            : "";
      if (!kind) {
        get("[data-quick-message]").textContent =
          "支持图片、GIF、视频和 PDF 文件。";
        continue;
      }
      if (
        attachments.some(
          (item) =>
            item.file.name === file.name &&
            item.file.size === file.size &&
            item.file.lastModified === file.lastModified,
        )
      )
        continue;
      if (kind === "pdf") {
        attachments
          .filter((item) => item.kind === "pdf")
          .forEach((item) => URL.revokeObjectURL(item.preview));
        attachments = attachments.filter((item) => item.kind !== "pdf");
      }
      const item = {
        file,
        kind,
        preview: URL.createObjectURL(file),
        url: "",
        cover: "",
        coverError: "",
      };
      attachments.push(item);
      if (kind === "video") void prepareVideoCover(item).catch(() => {});
    }
    renderAttachments();
  }
  async function prepareVideoCover(item) {
    if (item.cover) return item.cover;
    if (item.coverPromise) return item.coverPromise;
    item.coverError = "";
    item.coverPromise = window
      .captureVideoPoster(item.file)
      .then((cover) => {
        if (!cover) throw Error("未能提取视频封面");
        item.cover = cover;
        return cover;
      })
      .catch((error) => {
        item.coverError = "封面提取失败，发布时将重试";
        throw error;
      })
      .finally(() => {
        item.coverPromise = null;
        if (attachments.includes(item)) renderAttachments();
      });
    return item.coverPromise;
  }
  async function uploadAttachments() {
    for (const item of attachments) {
      if (item.kind === "video") {
        get("[data-quick-message]").textContent =
          `正在提取 ${item.file.name} 的封面…`;
        await prepareVideoCover(item);
      }
      if (item.url) continue;
      get("[data-quick-message]").textContent = `正在上传 ${item.file.name}…`;
      const data = new FormData();
      data.append("file", item.file);
      const response = await fetch(scopedUrl(`/api/kb/upload-${item.kind}`), {
        method: "POST",
        body: data,
      });
      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        result = {};
      }
      if (!response.ok || !result.url)
        throw Error(result.error || result.message || text || "附件上传失败");
      item.url = result.url;
    }
    return {
      images: attachments
        .filter((item) => item.kind === "image")
        .map((item) => item.url),
      videos: attachments
        .filter((item) => item.kind === "video")
        .map((item) => item.url),
      covers: attachments
        .filter((item) => item.kind === "video")
        .map((item) => item.cover),
      ...(attachments.find((item) => item.kind === "pdf")
        ? { pdf: attachments.find((item) => item.kind === "pdf").url }
        : {}),
    };
  }
  function scopedUrl(path) {
    const url = new URL(path, location.origin),
      db = window.getCurrentDbParam();
    if (db) url.searchParams.set("db", db);
    return url;
  }
  function showForm() {
    closeOntology();
    saved = false;
    form.reset();
    attachments.forEach((item) => URL.revokeObjectURL(item.preview));
    attachments = [];
    renderAttachments();
    dialog.querySelectorAll("[data-quick-filter]").forEach((input) => {
      input.value = "";
      renderChoices(input.dataset.quickFilter);
    });
    ["link", "tags"].forEach((key) => togglePanel(key, false));
    updateMeta();
    get("[data-quick-layout]").hidden = false;
    get("[data-quick-success]").hidden = true;
    get("[data-quick-save]").hidden = false;
    get("[data-quick-done]").hidden = true;
    get("[data-quick-message]").textContent = "";
    fields.namedItem("content").focus();
  }
  function close() {
    if (!saving) dialog.close();
  }
  function renderChoices(key) {
    const control = fields.namedItem(key);
    const selected = new Set(
      Array.from(control.selectedOptions, (option) => option.value).filter(
        Boolean,
      ),
    );
    const rows = choiceRows[key];
    control.replaceChildren();
    if (key === "type")
      control.add(new Option("暂不设置", "", false, !selected.size));
    rows.forEach((row) =>
      control.add(new Option(row.label, row.id, false, selected.has(row.id))),
    );
    if (key === "category") void renderCategoryTree();
  }
  let categoryPath = [];
  async function renderCategoryTree() {
    const host = get('[data-quick-category-tree]');
    const query = "";
    host.replaceChildren();
    let nodes = categoryNodes, depth = 0;
    const matches = n => String(n.name || n.label || n.id).toLowerCase().includes(query) || n.children.some(matches);
    do {
      const column = document.createElement('div');
      column.className = 'quick-category-level';
      column.setAttribute('aria-label', '第 ' + (depth + 1) + ' 级分类');
      const level = depth;
      for (const node of nodes.filter(matches)) {
        const row = document.createElement('div'), label = document.createElement('button');
        row.className = 'quick-category-option';
        const option = Array.from(fields.namedItem('category').options).find(o => o.value === node.id);
        label.type = 'button';
        label.className = 'quick-category-select';
        label.setAttribute('aria-pressed', String(!!option?.selected));
        label.disabled = saving || saved;
        label.onclick = () => {
          if (!option || saving || saved) return;
          option.selected = !option.selected;
          categoryPath = categoryPath.slice(0, level); categoryPath[level] = node.id;
          updateMeta(); void renderCategoryTree();
        };
        label.textContent = node.name || node.label || node.id; row.append(label);
        if (node.children.length) {
          const next = document.createElement('button'); next.type = 'button'; next.textContent = '›';
          next.disabled = saving || saved;
          next.setAttribute('aria-label', '展开' + (node.name || node.label || node.id) + '的下级分类');
          next.setAttribute('aria-expanded', String(categoryPath[level] === node.id));
          next.onclick = () => { if (saving || saved) return; const expanded = categoryPath[level] === node.id; categoryPath = categoryPath.slice(0, level); if (!expanded) categoryPath[level] = node.id; void renderCategoryTree(); };
          row.append(next);
        }
        row.classList.toggle('is-selected', !!option?.selected);
        row.classList.toggle('is-expanded', categoryPath[level] === node.id && !!node.children.length);
        column.append(row);
      }
      if (!column.childElementCount) column.textContent = query ? '无匹配分类' : '暂无分类';
      host.append(column);
      nodes = nodes.find(n => n.id === categoryPath[depth])?.children || []; depth++;
    } while (nodes.length);
  }

  function closeOntology() {
    ontologyVersion++;
    get("#quickOntologyDropdown").hidden = true;
    get("[data-quick-ontology]").setAttribute("aria-expanded", "false");
  }
  function positionOntology() {
    const dropdown = get("#quickOntologyDropdown");
    if (dropdown.hidden) return;
    const rect = get("[data-quick-ontology]").getBoundingClientRect();
    const width = dropdown.offsetWidth,
      height = dropdown.offsetHeight;
    dropdown.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
    dropdown.style.top = `${Math.max(12, rect.bottom + height + 8 > window.innerHeight - 12 ? rect.top - height - 8 : rect.bottom + 8)}px`;
  }
  function selectOntology(id, nodes) {
    const control = fields.namedItem("type");
    if (
      id &&
      !Array.from(control.options).some((option) => option.value === id)
    ) {
      const find = (rows) => {
        for (const row of rows) {
          if (String(row.id) === id) return row;
          const nested = find(row.children || []);
          if (nested) return nested;
        }
      };
      const row = find(nodes);
      control.add(new Option(row?.name || row?.label || id, id));
    }
    control.value = id;
    updateMeta();
    closeOntology();
    get("[data-quick-ontology]").focus();
  }
  async function openOntology() {
    if (saving || saved) return;
    const dropdown = get("#quickOntologyDropdown");
    if (!dropdown.hidden) {
      closeOntology();
      return;
    }
    const token = ++ontologyVersion;
    dropdown.hidden = false;
    get("[data-quick-ontology]").setAttribute("aria-expanded", "true");
    const search = get("[data-quick-ontology-search]"),
      host = get("[data-quick-ontology-tree]");
    search.value = "";
    host.textContent = "正在加载本体…";
    positionOntology();
    try {
      const scope = scopedUrl("/api/kb/ontology/tree").href;
      if (ontologyScope !== scope) {
        ontologyItems = null;
        ontologyScope = scope;
      }
      const [nodes, treeModule] = await Promise.all([
        ontologyItems ||
          fetch(scope).then(async (response) => {
            if (!response.ok) throw Error("本体加载失败，请重试");
            const data = await response.json();
            return Array.isArray(data.items) ? data.items : [];
          }),
        window.kbOntologyTreeModuleReady,
      ]);
      if (token !== ontologyVersion || !dialog.open) return;
      if (!treeModule?.OntologyTreeController)
        throw Error("本体选择器加载失败，请重试");
      ontologyItems = nodes;
      ontologyController?.destroy();
      ontologyController = new treeModule.OntologyTreeController(host, {
        allLabel: "不设置本体",
        showAllButton: true,
        enableDrag: false,
        enableContextMenu: false,
        disableReadonlyItems: false,
        toggleSelection: false,
        storageKey: `kb:ontology-tree-state:quick-composer:${scope}`,
        onSelect: (id) => {
          if (!saving) selectOntology(id || "", nodes);
        },
        onEdit() {},
        onAddChild() {},
        onDelete() {},
        onReload: () => {
          ontologyItems = null;
          closeOntology();
          void openOntology();
        },
      });
      ontologyController.update(nodes, fields.namedItem("type").value || "");
      ontologyController.filter(search.value);
      positionOntology();
      search.focus();
    } catch (error) {
      if (token !== ontologyVersion || !dialog.open) return;
      host.textContent = error.message || "本体加载失败";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "btn sm";
      retry.textContent = "重试";
      retry.onclick = () => {
        closeOntology();
        void openOntology();
      };
      host.append(retry);
      positionOntology();
    }
  }
  let presetCategoryId = '';
  async function loadOptions() {
    const token = ++version;
    const status = get("[data-quick-options]");
    status.textContent = "正在加载分类与本体…";
    const controls = [fields.namedItem("category"), fields.namedItem("type")];
    controls.forEach((control) => {
      control.disabled = true;
    });
    const defaultRequest = fetch(scopedUrl("/api/kb/default-ontology")).then(response => response.ok ? response.json() : null).catch(() => null);
    const results = await Promise.allSettled(
      ["/api/kb/classes", "/api/kb/ontologies"].map(async (path) => {
        const response = await fetch(scopedUrl(path));
        if (!response.ok) throw Error("加载失败");
        const data = await response.json();
        return Array.isArray(data) ? data : data.items || [];
      }),
    );
    if (token !== version || !dialog.open) return;
    results.forEach((result, index) => {
      const key = index === 0 ? "category" : "type",
        control = controls[index];
      if (result.status === "fulfilled") {
        if (key === "category") categoryNodes = buildCategoryTree(result.value);
        const flatten = (rows) =>
          rows.flatMap((row) => [row, ...flatten(row.children || [])]);
        choiceRows[key] = categoryOptions(
          key === "category" ? flatten(categoryNodes) : result.value,
        );
        if (key === "category") categoryPath = [];
        renderChoices(key);
      }
      control.disabled = false;
    });
    const defaultOntology = await defaultRequest;
    if (token !== version || !dialog.open) return;
    const typeControl = fields.namedItem('type');
    if (dialog.dataset.step !== 'type' && !typeControl.value && defaultOntology?.id && Array.from(typeControl.options).some(option => option.value === defaultOntology.id)) typeControl.value = defaultOntology.id;
    if (presetCategoryId) {
      const category = fields.namedItem('category');
      const match = Array.from(category.options).find(option => option.value === presetCategoryId);
      if (match) {
        for (const option of category.options) option.selected = option === match;
        setComposerStep('content');
      } else setComposerStep('type');
      presetCategoryId = '';
    }
    get('[data-quick-save]').disabled = false;
    updateMeta();
    renderTypeStep();
    status.textContent = results.some((result) => result.status === "rejected")
      ? "部分选项加载失败，可重试或先保存内容。"
      : "";
    if (results.some((result) => result.status === "rejected")) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "重试";
      retry.onclick = loadOptions;
      status.append(retry);
    }
  }

  const typeStep = document.createElement('section');
  typeStep.className = 'quick-type-step';
  typeStep.innerHTML = '<div class="quick-type-choices" role="group" aria-label="\u77e5\u8bc6\u7c7b\u578b"></div><p class="quick-type-status" role="status"></p>';
  get('[data-quick-layout]').before(typeStep);
  const nextStep = document.createElement('button');
  nextStep.type = 'button'; nextStep.className = 'btn primary'; nextStep.dataset.quickNext = '';
  nextStep.textContent = '\u4e0b\u4e00\u6b65'; nextStep.disabled = true;
  const backStep = document.createElement('button');
  backStep.type = 'button'; backStep.className = 'btn'; backStep.dataset.quickBack = '';
  backStep.textContent = '\u4e0a\u4e00\u6b65';
  get('.quick-knowledge-footer').append(backStep, nextStep);
  function setComposerStep(step) {
    dialog.dataset.step = step;
    closeOntology();
    fields.namedItem('content').required = step === 'content';
    if (step === 'content') fields.namedItem('content').focus();
  }
  function renderTypeStep() {
    const control = fields.namedItem('category');
    const choices = typeStep.querySelector('.quick-type-choices');
    choices.replaceChildren();
    const findPath = (nodes, id, parents = []) => {
      for (const node of nodes) {
        const path = [...parents, node];
        if (String(node.id) === id) return path;
        const found = findPath(node.children || [], id, path);
        if (found.length) return found;
      }
      return [];
    };
    const path = findPath(categoryNodes, control.value);
    const current = path[path.length - 1];
    const rows = current ? (current.children?.length ? current.children : [current]) : categoryNodes;
    let navigation = typeStep.querySelector('.quick-type-path');
    if (!navigation) {
      navigation = document.createElement('nav'); navigation.className = 'quick-type-path';
      navigation.setAttribute('aria-label', '\u7c7b\u578b\u5c42\u7ea7'); choices.before(navigation);
    }
    navigation.replaceChildren();
    const selectType = id => {
      for (const item of control.options) item.selected = item.value === id;
      updateMeta(); void renderCategoryTree(); renderTypeStep();
    };
    const addCrumb = (label, id, isCurrent) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
      if (isCurrent) button.setAttribute('aria-current', 'location');
      button.onclick = () => { selectType(id); typeStep.querySelector('.quick-type-choices button')?.focus(); };
      navigation.append(button);
    };
    addCrumb('\u5168\u90e8\u7c7b\u578b', '', !path.length);
    for (const node of path) addCrumb(node.name || node.label || node.id, String(node.id), node === current);
    for (const node of rows) {
      const button = document.createElement('button'); button.type = 'button';
      const icon = document.createElement('i'); icon.className = node.children?.length ? 'fa-solid fa-folder' : 'fa-solid fa-tag'; icon.setAttribute('aria-hidden','true');
      const label = document.createElement('span'); label.textContent = node.name || node.label || node.id;
      button.append(icon, label); button.setAttribute('aria-pressed', String(control.value === String(node.id)));
      if (node.children?.length) {
        const arrow = document.createElement('span'); arrow.textContent = '\u203a'; arrow.setAttribute('aria-hidden', 'true'); button.append(arrow);
      }
      button.onclick = () => { selectType(String(node.id)); typeStep.querySelector('.quick-type-choices button')?.focus(); };
      choices.append(button);
    }
    const addType = document.createElement('button'); addType.type = 'button';
    addType.className = 'quick-type-add';
    addType.title = '\u65b0\u589e\u7c7b\u578b'; addType.setAttribute('aria-label', addType.title);
    addType.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
    addType.disabled = control.disabled;
    addType.onclick = () => {
      typeStep.append(categoryEditor);
      categoryEditor.dataset.parent = current ? String(current.id) : '';
      categoryEditor.querySelector('[data-create]').disabled = false;
      categoryEditor.querySelector('[data-parent]').textContent = current
        ? '\u65b0\u589e\u4e0b\u7ea7\u7c7b\u578b' : '\u65b0\u589e\u7b2c\u4e00\u5c42\u7c7b\u578b';
      categoryEditor.hidden = false;
      categoryEditor.querySelector('input').value = '';
      categoryEditor.querySelector('input').focus();
    };
    choices.append(addType);
    if (current) {
      const remove = document.createElement('button'); remove.type = 'button';
      remove.className = 'quick-type-delete';
      const icon = document.createElement('i'); icon.className = 'fa-regular fa-trash-can'; icon.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span'); label.textContent = '\u5220\u9664\u5f53\u524d\u7c7b\u578b'; remove.append(icon); remove.setAttribute('aria-label', label.textContent);
      remove.disabled = control.disabled || Boolean(current.children?.length);
      remove.title = current.children?.length ? '\u8bf7\u5148\u5220\u9664\u4e0b\u7ea7\u7c7b\u578b' : label.textContent;
      remove.onclick = async () => {
        if (saving || saved || !window.confirm('\u786e\u8ba4\u5220\u9664\u7c7b\u578b\u201c' + (current.name || current.label || current.id) + '\u201d\uff1f')) return;
        const scope = scopedUrl('/api/kb/classes');
        const request = new URL(scope); request.searchParams.set('id', String(current.id));
        remove.disabled = true; addType.disabled = true;
        choices.inert = true; navigation.inert = true; nextStep.disabled = true;
        const status = typeStep.querySelector('.quick-type-status');
        status.textContent = '\u6b63\u5728\u5220\u9664\u2026';
        try {
          const response = await fetch(request, { method:'DELETE' });
          const text = await response.text();
          let result = {};
          try { result = text ? JSON.parse(text) : {}; } catch {}
          if (!response.ok || result.ok === false || result.success === false) {
            throw new Error(result.error || result.message || (response.status === 401 ? '\u8bf7\u5148\u767b\u5f55' : response.status === 403 ? '\u6ca1\u6709\u5220\u9664\u7c7b\u578b\u7684\u6743\u9650' : text || '\u5220\u9664\u5931\u8d25'));
          }
          const refreshed = await fetch(scope); if (!refreshed.ok) throw new Error('\u7c7b\u578b\u5df2\u5220\u9664\uff0c\u5217\u8868\u5237\u65b0\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u6253\u5f00');
          const data = await refreshed.json();
          if (!dialog.open || scope.href !== scopedUrl('/api/kb/classes').href) return;
          categoryNodes = buildCategoryTree(Array.isArray(data) ? data : data.items || []);
          const flatten = rows => rows.flatMap(row => [row, ...flatten(row.children || [])]);
          choiceRows.category = categoryOptions(flatten(categoryNodes));
          renderChoices('category');
          const parent = path[path.length - 2];
          for (const option of control.options) option.selected = Boolean(parent && option.value === String(parent.id));
          categoryEditor.hidden = true;
          updateMeta(); renderTypeStep();
          window.dispatchEvent(new CustomEvent('kb:classes-updated'));
        } catch (error) {
          status.textContent = '\u5220\u9664\u5931\u8d25\uff1a' + error.message;
        } finally {
          choices.inert = false; navigation.inert = false; remove.disabled = false; addType.disabled = false;
          nextStep.disabled = control.disabled || !control.value;
        }
      };
      choices.append(remove);
    }

    nextStep.disabled = control.disabled || !current;
    const status = typeStep.querySelector('.quick-type-status');
    status.replaceChildren();
    if (!rows.length) {
      status.textContent = '\u6682\u65e0\u53ef\u9009\u7c7b\u578b\uff0c\u8bf7\u786e\u8ba4\u5df2\u914d\u7f6e\u7c7b\u578b\u6811\u6216\u91cd\u8bd5\u3002';
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn'; retry.textContent = '\u91cd\u8bd5'; retry.onclick = () => void loadOptions(); status.append(retry);
    }
  }
  nextStep.onclick = () => { if (!nextStep.disabled) setComposerStep('content'); };
  backStep.onclick = () => { setComposerStep('type'); renderTypeStep(); typeStep.querySelector('button')?.focus(); };
  window.openQuickKnowledge = function (options = {}) {
    if (dialog.open) return;
    presetCategoryId = String(options.categoryId || '');
    previousFocus = document.activeElement;
    get("[data-quick-author]").textContent =
      window.authUser?.displayName || window.authUser?.username || "新增知识";
    const avatar = get("[data-quick-avatar]");
    avatar.textContent = Array.from(
      String(window.authUser?.displayName || window.authUser?.username || "知"),
    )[0].toUpperCase();
    const imageUrl = String(window.authUser?.avatar || "").trim();
    if (/^(https?:\/\/|\/(?!\/))/i.test(imageUrl)) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = "";
      image.onload = () => {
        avatar.replaceChildren(image);
      };
      image.onerror = () => {
        image.remove();
      };
      avatar.append(image);
    } else if (
      imageUrl &&
      !/[<>]/.test(imageUrl) &&
      Array.from(imageUrl).length <= 8
    )
      avatar.textContent = imageUrl;
    get("[data-quick-app]").textContent =
      document.getElementById("headerProjectName")?.textContent.trim() ||
      "当前应用";
    if (saved) showForm();
    updateMeta();
    setComposerStep(presetCategoryId ? 'content' : 'type');
    get('[data-quick-save]').disabled = Boolean(presetCategoryId);
    nextStep.disabled = true;
    typeStep.querySelector('.quick-type-choices').replaceChildren();
    typeStep.querySelector('.quick-type-status').textContent = '\u6b63\u5728\u52a0\u8f7d\u7c7b\u578b\u2026';
    dialog.showModal();
    get('[data-quick-close]').focus();
    void loadOptions();
  };
  get("[data-quick-ontology]").addEventListener("click", () => {
    void openOntology();
  });
  get("[data-quick-ontology-search]").addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.preventDefault();
  });
  get("[data-quick-ontology-search]").addEventListener("input", (event) =>
    ontologyController?.filter(event.target.value),
  );
  dialog.addEventListener("click", (event) => {
    const path = event.composedPath();
    if (
      !path.includes(get("#quickOntologyDropdown")) &&
      !path.includes(get("[data-quick-ontology]"))
    )
      closeOntology();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !get("#quickOntologyDropdown").hidden) {
      event.preventDefault();
      event.stopPropagation();
      closeOntology();
      get("[data-quick-ontology]").focus();
    }
  });
  window.addEventListener("resize", positionOntology, { passive: true });
  dialog.addEventListener("scroll", positionOntology, { passive: true });
  dialog.querySelectorAll("[data-quick-close]").forEach((button) => {
    button.onclick = close;
  });
  get("[data-quick-done]").onclick = close;
  get("[data-quick-another]").onclick = () => { showForm(); setComposerStep('type'); void loadOptions(); };
  dialog.querySelectorAll("[data-quick-toggle]").forEach((button) => {
    button.onclick = () => togglePanel(button.dataset.quickToggle);
  });
  dialog.querySelectorAll("[data-quick-pick]").forEach((button) => {
    button.onclick = () => {
      if (!saving)
        get(`[data-quick-file="${button.dataset.quickPick}"]`).click();
    };
  });
  dialog.querySelectorAll("[data-quick-file]").forEach((input) => {
    input.onchange = () => {
      addFiles(input.files);
      input.value = "";
    };
  });
  dialog.querySelectorAll("[data-quick-format]").forEach((button) => {
    button.onclick = () => {
      if (saving) return;
      const input = fields.namedItem("content"),
        text = button.dataset.quickFormat === "list" ? "\n- " : "\n\n---\n\n";
      if (input.value.length + text.length > input.maxLength) return;
      input.setRangeText(text, input.selectionStart, input.selectionEnd, "end");
      input.focus();
      updateMeta();
    };
  });
  dialog.querySelectorAll("[data-quick-filter]").forEach((input) =>
    input.addEventListener("input", () => {
      void renderCategoryTree();
    }),
  );
  dialog.querySelectorAll("[data-quick-clear]").forEach((button) =>
    button.addEventListener("click", () => {
      if (saving) return;
      const key = button.dataset.quickClear;
      Array.from(fields.namedItem(key).options).forEach((option) => {
        option.selected = false;
      });

      renderChoices(key);
      updateMeta();
    }),
  );
  fields.namedItem("category").addEventListener("change", () => {
    void renderCategoryTree();
  });

  form.addEventListener("input", updateMeta);
  form.addEventListener("change", updateMeta);
  form.addEventListener(
    "invalid",
    (event) => {
      const panel = event.target.closest("[data-quick-panel]");
      if (panel) togglePanel(panel.dataset.quickPanel, true);
    },
    true,
  );
  fields.namedItem("content").addEventListener("paste", (event) => {
    const files = Array.from(event.clipboardData?.files || []);
    if (files.length) {
      event.preventDefault();
      addFiles(files);
    }
  });
  dialog.addEventListener("dragover", (event) => {
    if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
  });
  dialog.addEventListener("drop", (event) => {
    if (event.dataTransfer?.files.length) {
      event.preventDefault();
      addFiles(event.dataTransfer.files);
    }
  });
  dialog.addEventListener("keydown", (event) => {
    if (
      !event.isComposing &&
      (event.ctrlKey || event.metaKey) &&
      event.key === "Enter"
    ) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  dialog.addEventListener("cancel", (event) => {
    if (saving) event.preventDefault();
  });
  dialog.addEventListener("close", () => {
    categoryVersion++;
    categoryController?.destroy();
    categoryController = null;
    closeOntology();
    ontologyController?.destroy();
    ontologyController = null;
    version++;
    previousFocus?.focus?.({ preventScroll: true });
  });
  form.addEventListener("submit", async (event) => {
    if (dialog.dataset.step === 'type') { event.preventDefault(); nextStep.click(); return; }
    event.preventDefault();
    if (saving || saved || !form.reportValidity()) return;
    const value = (key) => String(fields.namedItem(key).value || "").trim();
    if (!value("content")) {
      fields.namedItem("content").setCustomValidity("请输入知识名称");
      fields.namedItem("content").reportValidity();
      fields.namedItem("content").setCustomValidity("");
      return;
    }
    const parsed = parseQuickComposer(value("content"), value("tags"));
    const validationMessage = !parsed.name
      ? "请输入知识标题"
      : parsed.name.length > 300
        ? "标题不能超过 300 字，请用空行分隔标题和描述。"
        : parsed.description.length > 10000
          ? "描述不能超过 10000 字。"
          : "";
    if (validationMessage) {
      const input = fields.namedItem("content");
      input.setCustomValidity(validationMessage);
      input.reportValidity();
      input.setCustomValidity("");
      return;
    }
    const body = {
      name: parsed.name,
      description: parsed.description,
      aliases: parsed.aliases,
      categoryIds: Array.from(
        fields.namedItem("category").selectedOptions,
        (option) => option.value,
      ).filter(Boolean),
      mapCategoryToOntology: true,
      tags: parsed.tags,
      link: value("link"),
      visibility: value("visibility"),
    };
    const submit = get("[data-quick-save]"),
      message = get("[data-quick-message]");
    closeOntology();
    saving = true;
    submit.disabled = true;
    submit.textContent = "正在创建…";
    message.textContent = "";
    get("[data-quick-layout]").inert = true;
    fields.namedItem("visibility").disabled = true;
    try {
      Object.assign(body, await uploadAttachments());
      message.textContent = "";
      const response = await fetch(scopedUrl("/api/kb/nodes"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        result = {};
      }
      if (!response.ok)
        throw Error(
          response.status === 401
            ? "请先登录后再创建知识。"
            : result.error ||
                result.message ||
                text ||
                `创建失败（${response.status}）`,
        );
      saved = true;
      dialog.close();
      window.dispatchEvent(
        new CustomEvent("kb:knowledge-created", {
          detail: { node: result.node },
        }),
      );
    } catch (error) {
      message.textContent = error.message || "创建失败，请重试";
    } finally {
      saving = false;
      submit.disabled = false;
      submit.textContent = "立即发布 ↑";
      get("[data-quick-layout]").inert = false;
      fields.namedItem("visibility").disabled = false;
    }
  });
})();
