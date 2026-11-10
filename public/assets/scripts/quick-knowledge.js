(function () {
  function splitTags(value) {
    const tags = new Map();
    String(value || '').split(/[,，;；、\n]+/).forEach(raw => {
      const tag = raw.trim();
      if (tag && !tags.has(tag.toLowerCase())) tags.set(tag.toLowerCase(), tag);
    });
    return [...tags.values()];
  }
  function categoryOptions(rows) {
    const byId = new Map(rows.map(row => [String(row.id), row]));
    return rows.map(row => {
      const path = [row.name || row.label || row.id], seen = new Set([String(row.id)]);
      let parent = String(row.parent_id || row.parent || '');
      while (parent && byId.has(parent) && !seen.has(parent)) {
        seen.add(parent); const item = byId.get(parent);
        path.unshift(item.name || item.label || item.id); parent = String(item.parent_id || item.parent || '');
      }
      return { id: String(row.id), label: path.join(' / ') };
    });
  }
  const dialog = document.createElement('dialog');
  dialog.id = 'quickKnowledgeDialog';
  dialog.setAttribute('aria-labelledby', 'quickKnowledgeTitle');
  dialog.innerHTML = `<form id="quickKnowledgeForm">
    <div class="quick-knowledge-header"><div class="quick-publisher"><span class="quick-publisher-avatar" data-quick-avatar aria-hidden="true"></span><div><strong data-quick-author></strong><small data-quick-app></small></div></div><h2 id="quickKnowledgeTitle" class="quick-sr-only">新增知识</h2><button type="button" data-quick-toggle="settings" aria-label="分类与本体设置" aria-expanded="false" title="分类与本体设置"><i class="fa-solid fa-gear" aria-hidden="true"></i></button></div>
    <div class="quick-knowledge-fields">
      <input class="quick-title" name="name" required maxlength="300" autocomplete="off" aria-label="知识标题" placeholder="标题">
      <div class="quick-body-editor"><textarea name="description" rows="6" maxlength="10000" aria-label="知识正文" placeholder="写下想法，或拖入图片、视频与 PDF…"></textarea>
      <div class="quick-composer-tools" role="toolbar" aria-label="添加内容">
        <button type="button" data-quick-pick="image" title="添加图片或 GIF" aria-label="添加图片或 GIF"><i class="fa-regular fa-image" aria-hidden="true"></i></button>
        <button type="button" data-quick-pick="video" title="添加视频" aria-label="添加视频"><i class="fa-solid fa-video" aria-hidden="true"></i></button>
        <button type="button" data-quick-toggle="link" title="来源链接" aria-label="来源链接" aria-expanded="false"><i class="fa-solid fa-link" aria-hidden="true"></i></button>
        <button type="button" data-quick-pick="pdf" title="添加 PDF" aria-label="添加 PDF"><i class="fa-regular fa-file-pdf" aria-hidden="true"></i></button>
        <button type="button" data-quick-format="list" title="插入列表" aria-label="插入列表"><i class="fa-solid fa-list-ul" aria-hidden="true"></i></button>
        <button type="button" data-quick-format="divider" title="插入分隔线" aria-label="插入分隔线"><i class="fa-solid fa-grip-lines" aria-hidden="true"></i></button>
      </div></div>
      <div class="quick-attachments" data-quick-attachments aria-label="附件预览"></div>
      <div class="quick-composer-panel quick-knowledge-row" data-quick-panel="settings" hidden><label>分类<select class="kb-select" name="category"><option value="">暂不分类</option></select></label><label>本体类型<select class="kb-select" name="type"><option value="">暂不设置</option></select></label><p class="quick-knowledge-options-status" data-quick-options role="status"></p></div>
      <div class="quick-composer-panel" data-quick-panel="link" hidden><label>来源链接<input class="kb-input" name="link" type="url" maxlength="2000" placeholder="https://…"></label></div>
      <div class="quick-composer-panel" data-quick-panel="tags" hidden><label>标签<input class="kb-input" name="tags" maxlength="2000" placeholder="用逗号分隔标签"></label></div>
      <div class="quick-composer-meta"><button type="button" data-quick-toggle="tags" aria-expanded="false"><span data-quick-tag-label># 添加标签</span></button><button type="button" data-quick-toggle="settings" aria-expanded="false"><i class="fa-solid fa-shapes" aria-hidden="true"></i><span data-quick-category-label>分类与本体</span></button><small data-quick-count>0 / 10000</small></div>
      <input type="file" data-quick-file="image" accept="image/*" multiple hidden><input type="file" data-quick-file="video" accept=".mp4,.webm,.avi,.mkv,.ogg,.mpeg" multiple hidden><input type="file" data-quick-file="pdf" accept="application/pdf,.pdf" hidden>
    </div>
    <div class="quick-knowledge-success" data-quick-success hidden><i class="fa-regular fa-circle-check" aria-hidden="true"></i><h3>知识已创建</h3><p>已保存到当前应用。</p><button type="button" class="btn" data-quick-another>继续新增</button></div>
    <p class="quick-knowledge-message" data-quick-message role="status" aria-live="polite"></p>
    <div class="quick-knowledge-footer"><button type="button" class="btn" data-quick-close>关闭</button><label class="quick-audience"><i class="fa-solid fa-earth-asia" aria-hidden="true"></i><span class="quick-sr-only">可见性</span><select name="visibility" aria-label="可见性"><option value="public">所有人可见</option><option value="private">仅自己可见</option></select></label><button type="submit" class="btn primary" data-quick-save>立即发布 <i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button><button type="button" class="btn primary" data-quick-done hidden>完成</button></div>
  </form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form'), fields = form.elements;
  const get = selector => dialog.querySelector(selector);
  let saving = false, saved = false, version = 0, previousFocus;
  let attachments = [];
  function togglePanel(key, force) {
    if (saving) return;
    const panel = get(`[data-quick-panel="${key}"]`);
    panel.hidden = force === undefined ? !panel.hidden : !force;
    dialog.querySelectorAll(`[data-quick-toggle="${key}"]`).forEach(button => button.setAttribute('aria-expanded', String(!panel.hidden)));
    if (!panel.hidden) panel.querySelector('input,select')?.focus();
  }
  function updateMeta() {
    const tags = splitTags(fields.namedItem('tags').value);
    get('[data-quick-tag-label]').textContent = tags.length ? tags.map(tag => '#' + tag).join(' ') : '# 添加标签';
    const category = fields.namedItem('category'), type = fields.namedItem('type');
    get('[data-quick-category-label]').textContent = [category, type].filter(control => control.value).map(control => control.selectedOptions[0]?.textContent).join(' · ') || '分类与本体';
    get('[data-quick-count]').textContent = `${fields.namedItem('description').value.length} / 10000`;
  }
  function renderAttachments() {
    const container = get('[data-quick-attachments]'); container.replaceChildren();
    attachments.forEach((item, index) => {
      const card = document.createElement('div'); card.className = 'quick-attachment';
      if (item.kind === 'image') { const image = document.createElement('img'); image.src = item.preview; image.alt = item.file.name; card.append(image); }
      const label = document.createElement('span'); label.textContent = item.file.name; card.append(label);
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `移除 ${item.file.name}`);
      remove.onclick = () => { if (saving) return; URL.revokeObjectURL(item.preview); attachments.splice(index, 1); renderAttachments(); };
      card.append(remove); container.append(card);
    });
  }
  function addFiles(files) {
    if (saving || saved) return;
    for (const file of files) {
      const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') || /\.(mp4|webm|avi|mkv|ogg|mpeg)$/i.test(file.name) ? 'video' : /\.pdf$/i.test(file.name) ? 'pdf' : '';
      if (!kind) { get('[data-quick-message]').textContent = '支持图片、GIF、视频和 PDF 文件。'; continue; }
      if (attachments.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) continue;
      if (kind === 'pdf') { attachments.filter(item => item.kind === 'pdf').forEach(item => URL.revokeObjectURL(item.preview)); attachments = attachments.filter(item => item.kind !== 'pdf'); }
      attachments.push({ file, kind, preview: URL.createObjectURL(file), url: '' });
    }
    renderAttachments();
  }
  async function uploadAttachments() {
    for (const item of attachments) {
      if (item.url) continue;
      get('[data-quick-message]').textContent = `正在上传 ${item.file.name}…`;
      const data = new FormData(); data.append('file', item.file);
      const response = await fetch(scopedUrl(`/api/kb/upload-${item.kind}`), { method: 'POST', body: data });
      const text = await response.text(); let result; try { result = JSON.parse(text); } catch { result = {}; }
      if (!response.ok || !result.url) throw Error(result.error || result.message || text || '附件上传失败');
      item.url = result.url;
    }
    return { images: attachments.filter(item => item.kind === 'image').map(item => item.url), videos: attachments.filter(item => item.kind === 'video').map(item => item.url), ...(attachments.find(item => item.kind === 'pdf') ? { pdf: attachments.find(item => item.kind === 'pdf').url } : {}) };
  }
  function scopedUrl(path) {
    const url = new URL(path, location.origin), db = new URLSearchParams(location.search).get('db');
    if (db) url.searchParams.set('db', db);
    return url;
  }
  function showForm() {
    saved = false; form.reset();
    attachments.forEach(item => URL.revokeObjectURL(item.preview)); attachments = []; renderAttachments();
    ['settings', 'link', 'tags'].forEach(key => togglePanel(key, false)); updateMeta();
    get('.quick-knowledge-fields').hidden = false; get('[data-quick-success]').hidden = true;
    get('[data-quick-save]').hidden = false; get('[data-quick-done]').hidden = true;
    get('[data-quick-message]').textContent = ''; fields.namedItem('name').focus();
  }
  function close() { if (!saving) dialog.close(); }
  async function loadOptions() {
    const token = ++version;
    const status = get('[data-quick-options]'); status.textContent = '正在加载分类与本体…';
    const controls = [fields.namedItem('category'), fields.namedItem('type')];
    controls.forEach(control => { control.disabled = true; });
    const results = await Promise.allSettled(['/api/kb/classes', '/api/kb/ontologies'].map(async path => {
      const response = await fetch(scopedUrl(path));
      if (!response.ok) throw Error('加载失败');
      const data = await response.json(); return Array.isArray(data) ? data : data.items || [];
    }));
    if (token !== version || !dialog.open) return;
    results.forEach((result, index) => {
      const control = controls[index], selected = control.value;
      if (result.status === 'fulfilled') {
        control.replaceChildren(new Option(index === 0 ? '暂不分类' : '暂不设置', ''));
        categoryOptions(result.value).forEach(row => control.add(new Option(row.label, row.id)));
        control.value = selected;
      }
      control.disabled = false;
    });
    status.textContent = results.some(result => result.status === 'rejected') ? '部分选项加载失败，可重试或先保存内容。' : '';
    if (results.some(result => result.status === 'rejected')) {
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = '重试'; retry.onclick = loadOptions; status.append(retry);
    }
  }
  window.openQuickKnowledge = function () {
    if (dialog.open) return;
    previousFocus = document.activeElement;
    get('[data-quick-author]').textContent = window.authUser?.displayName || window.authUser?.username || '新增知识';
    get('[data-quick-avatar]').textContent = String(window.authUser?.displayName || window.authUser?.username || '知').slice(0, 1).toUpperCase();
    get('[data-quick-app]').textContent = document.getElementById('headerProjectName')?.textContent.trim() || '当前应用';
    if (saved) showForm();
    dialog.showModal(); fields.namedItem('name').focus(); void loadOptions();
  };
  dialog.querySelectorAll('[data-quick-close]').forEach(button => { button.onclick = close; });
  get('[data-quick-done]').onclick = close;
  get('[data-quick-another]').onclick = showForm;
  dialog.querySelectorAll('[data-quick-toggle]').forEach(button => { button.onclick = () => togglePanel(button.dataset.quickToggle); });
  dialog.querySelectorAll('[data-quick-pick]').forEach(button => { button.onclick = () => { if (!saving) get(`[data-quick-file="${button.dataset.quickPick}"]`).click(); }; });
  dialog.querySelectorAll('[data-quick-file]').forEach(input => { input.onchange = () => { addFiles(input.files); input.value = ''; }; });
  dialog.querySelectorAll('[data-quick-format]').forEach(button => { button.onclick = () => {
    if (saving) return;
    const input = fields.namedItem('description'), text = button.dataset.quickFormat === 'list' ? '\n- ' : '\n\n---\n\n';
    if (input.value.length + text.length > input.maxLength) return;
    input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end'); input.focus(); updateMeta();
  }; });
  form.addEventListener('input', updateMeta); form.addEventListener('change', updateMeta);
  form.addEventListener('invalid', event => { const panel = event.target.closest('[data-quick-panel]'); if (panel) togglePanel(panel.dataset.quickPanel, true); }, true);
  fields.namedItem('description').addEventListener('paste', event => { const files = Array.from(event.clipboardData?.files || []); if (files.length) { event.preventDefault(); addFiles(files); } });
  dialog.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); });
  dialog.addEventListener('drop', event => { if (event.dataTransfer?.files.length) { event.preventDefault(); addFiles(event.dataTransfer.files); } });
  dialog.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); form.requestSubmit(); } });
  dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
  dialog.addEventListener('close', () => { version++; previousFocus?.focus?.({ preventScroll: true }); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || saved || !form.reportValidity()) return;
    const value = key => String(fields.namedItem(key).value || '').trim();
    if (!value('name')) { fields.namedItem('name').setCustomValidity('请输入知识名称'); fields.namedItem('name').reportValidity(); fields.namedItem('name').setCustomValidity(''); return; }
    const body = { name: value('name'), description: value('description'), categoryIds: value('category') ? [value('category')] : [], typeId: value('type') || null, tags: splitTags(value('tags')), link: value('link'), visibility: value('visibility') };
    const submit = get('[data-quick-save]'), message = get('[data-quick-message]');
    saving = true; submit.disabled = true; submit.textContent = '正在创建…'; message.textContent = '';
    get('.quick-knowledge-fields').inert = true; fields.namedItem('visibility').disabled = true;
    try {
      Object.assign(body, await uploadAttachments());
      message.textContent = '';
      const response = await fetch(scopedUrl('/api/kb/nodes'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const text = await response.text();
      let result; try { result = JSON.parse(text); } catch { result = {}; }
      if (!response.ok) throw Error(response.status === 401 ? '请先登录后再创建知识。' : result.error || result.message || text || `创建失败（${response.status}）`);
      saved = true;
      get('.quick-knowledge-fields').hidden = true; get('[data-quick-success]').hidden = false;
      submit.hidden = true; get('[data-quick-done]').hidden = false; get('[data-quick-done]').focus();
      message.textContent = result.sync === 'pending' ? '知识已保存，首页搜索索引正在同步，可能稍后显示。' : '';
      window.dispatchEvent(new CustomEvent('kb:knowledge-created', { detail: { node: result.node } }));
    } catch (error) { message.textContent = error.message || '创建失败，请重试'; }
    finally { saving = false; submit.disabled = false; submit.textContent = '立即发布 ↑'; get('.quick-knowledge-fields').inert = false; fields.namedItem('visibility').disabled = false; }
  });
})();
