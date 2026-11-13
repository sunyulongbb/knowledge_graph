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
      <div class="quick-body-editor"><label class="quick-sr-only" for="quickKnowledgeContent">知识内容</label><textarea id="quickKnowledgeContent" name="content" rows="6" required maxlength="14000" aria-describedby="quickKnowledgeHint" placeholder="写下知识标题&#10;&#10;空一行，补充描述…"></textarea><p id="quickKnowledgeHint" class="quick-composer-hint">首段为标题，空行后为描述。支持 #标签、粘贴或拖入附件；括号内可填写别名。</p>
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
      <div class="quick-composer-meta"><button type="button" data-quick-toggle="tags" aria-expanded="false"><span data-quick-tag-label># 添加标签</span></button><span class="quick-category-summary" data-quick-category-label>未选择分类</span><small data-quick-count>0 字</small></div>
      <input type="file" data-quick-file="image" accept="image/*" multiple hidden><input type="file" data-quick-file="video" accept=".mp4,.webm,.avi,.mkv,.ogg,.mpeg" multiple hidden><input type="file" data-quick-file="pdf" accept="application/pdf,.pdf" hidden>
    </div>
    <aside class="quick-category-sidebar" aria-labelledby="quickCategoryTitle"><div class="quick-category-heading"><h3 id="quickCategoryTitle">分类</h3><button type="button" data-quick-clear="category">清空</button></div><p>点击分类可多选，再次点击取消。</p><label class="quick-sr-only" for="quickCategorySearch">搜索分类</label><input id="quickCategorySearch" type="search" data-quick-filter="category" placeholder="搜索分类" autocomplete="off" aria-controls="quickCategoryTree"><select name="category" multiple hidden aria-label="已选知识分类"></select><div id="quickCategoryTree" class="ontology-dropdown-plugin-host quick-category-tree" data-quick-category-tree></div><small data-quick-choice-count="category"></small><p class="quick-knowledge-options-status" data-quick-options role="status"></p></aside></div>
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
  editorToolbar.append(dialog.querySelector(".quick-ontology-picker"));
  const meta = dialog.querySelector(".quick-composer-meta");
  const categorySummary = meta.querySelector(".quick-category-summary");
  dialog.querySelector(".quick-category-heading").after(categorySummary);
  editorToolbar.append(meta);
  editorFields.prepend(editorToolbar);
  const attachmentTools = dialog.querySelector(".quick-composer-tools");
  editorBody.after(attachmentTools);
  const hint = dialog.querySelector(".quick-composer-hint");
  attachmentTools.after(hint);
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
    const tags = parsed.tags;
    get("[data-quick-tag-label]").textContent = tags.length
      ? tags.map((tag) => "#" + tag).join(" ")
      : "# 添加标签";
    const category = fields.namedItem("category"),
      type = fields.namedItem("type");
    get("[data-quick-category-label]").textContent =
      Array.from(category.selectedOptions)
        .filter((option) => option.value)
        .map((option) => option.textContent)
        .join("、") || "未选择分类";
    get('[data-quick-choice-count="category"]').textContent =
      `已选 ${category.selectedOptions.length} 个分类`;
    get("[data-quick-ontology-label]").textContent = type.selectedOptions[0]
      ?.value
      ? type.selectedOptions[0].textContent
      : "添加本体";
    get("[data-quick-count]").textContent = `${content.value.length} 字`;
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
      db = new URLSearchParams(location.search).get("db");
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
  async function renderCategoryTree() {
    const token = ++categoryVersion,
      host = get("[data-quick-category-tree]");
    try {
      const treeModule = await window.kbOntologyTreeModuleReady;
      if (token !== categoryVersion || !dialog.open) return;
      if (!treeModule?.OntologyTreeController)
        throw Error("分类树加载失败，请重试");
      if (!categoryController)
        categoryController = new treeModule.OntologyTreeController(host, {
          showAllButton: false,
          enableDrag: false,
          enableContextMenu: false,
          disableReadonlyItems: false,
          toggleSelection: false,
          nodeIcon: "folder",
          nodeLabel: "分类",
          defaultExpandAll: true,
          expandOnFirstRender: true,
          storageKey: `kb:ontology-tree-state:quick-categories:${scopedUrl("/").search}`,
          nodeIconFilled: (id) =>
            Array.from(fields.namedItem("category").selectedOptions).some(
              (option) => option.value === id,
            ),
          onActivate: (id) => {
            if (saving || saved) return;
            const option = Array.from(
              fields.namedItem("category").options,
            ).find((option) => option.value === id);
            if (!option) return;
            option.selected = !option.selected;
            updateMeta();
            void renderCategoryTree();
          },
          onSelect() {},
          onEdit() {},
          onAddChild() {},
          onDelete() {},
          onReload: loadOptions,
        });
      categoryController.update(categoryNodes, "");
      if (!categoryNodes.length)
        host.textContent = "当前应用暂无分类，可以先发布知识。";
      categoryController.filter(get('[data-quick-filter="category"]').value);
    } catch (error) {
      if (token !== categoryVersion || !dialog.open) return;
      host.textContent = error.message || "分类树加载失败";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "btn sm";
      retry.textContent = "重试";
      retry.onclick = () => {
        void renderCategoryTree();
      };
      host.append(retry);
    }
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
  async function loadOptions() {
    const token = ++version;
    const status = get("[data-quick-options]");
    status.textContent = "正在加载分类与本体…";
    const controls = [fields.namedItem("category"), fields.namedItem("type")];
    controls.forEach((control) => {
      control.disabled = true;
    });
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
        renderChoices(key);
      }
      control.disabled = false;
    });
    updateMeta();
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
  window.openQuickKnowledge = function () {
    if (dialog.open) return;
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
    dialog.showModal();
    fields.namedItem("content").focus();
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
  get("[data-quick-another]").onclick = showForm;
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
      categoryController?.filter(input.value);
    }),
  );
  dialog.querySelectorAll("[data-quick-clear]").forEach((button) =>
    button.addEventListener("click", () => {
      if (saving) return;
      const key = button.dataset.quickClear;
      Array.from(fields.namedItem(key).options).forEach((option) => {
        option.selected = false;
      });
      get(`[data-quick-filter="${key}"]`).value = "";
      renderChoices(key);
      updateMeta();
    }),
  );
  fields.namedItem("category").addEventListener("change", () => {
    void renderCategoryTree();
  });
  get('[data-quick-filter="category"]').addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.preventDefault();
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
      typeId: value("type") || null,
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
      get("[data-quick-layout]").hidden = true;
      get("[data-quick-success]").hidden = false;
      submit.hidden = true;
      get("[data-quick-done]").hidden = false;
      get("[data-quick-done]").focus();
      message.textContent =
        result.sync === "pending"
          ? "知识已保存，首页搜索索引正在同步，可能稍后显示。"
          : "";
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
