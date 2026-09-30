(function () {
  const button = document.getElementById('btnManualClassify');
  if (!button) return;
  const idOf = (item) => String(item?.id || item?._id || item || '').replace(/^entity\//, '');
  let dialog, refs, queue = [], index = 0, classes = [], scope = '', version = 0, saving = false, loaded = false, changed = false, assigned = 0, skipped = 0;
  let existingClasses = new Map();
  let picks = new Map(), outcomes = new Map(), loading = false, mediaIndex = 0, mediaItems = [], currentNode = null, gesture = null, wheelAt = 0;
  const selection = () => { const id = queue[index]; if (!id) return new Set(); if (!picks.has(id)) picks.set(id, new Set()); return picks.get(id); };
  function restoreExistingClasses(entityId, items) {
    const ids = new Set((items || []).map((item) => String(item.id)));
    existingClasses.set(entityId, ids);
    const selected = picks.get(entityId) || new Set();
    ids.forEach((id) => selected.add(id));
    picks.set(entityId, selected);
  }
  const flatten = (items, parent = '') => (items || []).flatMap((item) => [{ ...item, id: String(item.id), parent_id: item.parent_id || parent }, ...flatten(item.children, String(item.id))]);
  function path(id) {
    const labels = [], seen = new Set(); let item = classes.find((item) => item.id === id);
    while (item && !seen.has(item.id)) { seen.add(item.id); labels.unshift(item.name || item.label || item.id); item = classes.find((other) => other.id === item.parent_id); }
    return labels.join(' / ');
  }
  async function api(route, params = {}, body) {
    const url = new URL(route, location.origin); if (scope) url.searchParams.set('db', scope);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.error || data.message || `请求失败（${response.status}）`);
    return data;
  }
  function stopMedia() { refs?.detail.querySelectorAll('video').forEach((video) => video.pause()); }
  function controls() {
    refs.skip.disabled = saving || loading || index >= queue.length;
    refs.previous.disabled = saving || loading || index <= 0;
    refs.next.disabled = saving || loading || index >= queue.length - 1;
    refs.save.disabled = saving || !loaded || !selection().size;
    refs.save.textContent = `保存并下一条（${selection().size}）`;
    refs.close.disabled = saving; refs.retry.disabled = saving;
    refs.choices.querySelectorAll('button').forEach((item) => { item.disabled = saving || !loaded || item.dataset.existing === 'true'; });
    refs.meter.max = Math.max(queue.length, 1); refs.meter.value = outcomes.size;
    refs.progress.textContent = `已处理 ${outcomes.size} / ${queue.length}`;
    refs.assigned.textContent = assigned; refs.skipped.textContent = skipped;
    refs.position.textContent = `知识预览 · ${Math.min(index + 1, queue.length)} / ${queue.length}`;
  }
  function renderChoices() {
    refs.choices.replaceChildren(); const query = refs.search.value.trim().toLowerCase();
    for (const item of classes) {
      const label = path(item.id); if (query && !label.toLowerCase().includes(query)) continue;
      const choice = document.createElement('button'); choice.type = 'button'; choice.className = 'btn manual-classify-choice'; choice.title = label;
      const name = document.createElement('strong'); name.textContent = item.name || item.label || item.id;
      const trail = document.createElement('small'); trail.textContent = label; choice.append(name, trail);
      const existing = existingClasses.get(queue[index])?.has(item.id) || false;
      choice.dataset.existing = String(existing);
      if (existing) trail.textContent = '已分类 · ' + label;
      const checked = selection().has(item.id);
      choice.classList.toggle('is-selected', checked); choice.setAttribute('aria-pressed', String(checked));
      name.textContent = (checked ? '✓ ' : '') + name.textContent;
      choice.onclick = () => { if (saving || !loaded || existing) return; const selected = selection(); selected.has(item.id) ? selected.delete(item.id) : selected.add(item.id); renderChoices(); }; refs.choices.append(choice);
    }
    refs.count.textContent = `${refs.choices.children.length} 个分类`;
    if (!refs.choices.children.length) {
      const empty = document.createElement('p'); empty.className = 'manual-classify-empty';
      empty.textContent = classes.length ? '没有匹配的分类，试试更短的关键词。' : '当前应用暂无分类，请先新增分类。'; refs.choices.append(empty);
    }
    controls();
  }
  async function show(direction = 0) {
    const token = ++version; loaded = false; loading = true; renderChoices(); stopMedia(); refs.detail.scrollTop = 0; refs.retry.hidden = true;
    dialog.classList.toggle('is-complete', index >= queue.length);
    controls();
    if (index >= queue.length) { loading = false; refs.detail.replaceChildren(); refs.status.textContent = `本轮完成：已分类 ${assigned} 条，跳过 ${skipped} 条`; refs.footer.hidden = true; const done = document.createElement('div'); done.className = 'manual-classify-done'; done.innerHTML = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i><h3>本轮分类已完成</h3><p>可以关闭面板，返回知识列表查看结果。</p>'; refs.detail.append(done); controls(); return; }
    refs.footer.hidden = false; refs.status.textContent = '正在加载知识详情…';
    try {
      const entityId = queue[index];
      const [data, assignedClasses] = await Promise.all([
        api('/api/kb/node', { id: entityId }),
        api('/api/kb/entity/class', { entity_id: entityId }),
      ]);
      if (token !== version || !dialog.open) return;
      const node = data.node; if (!node) throw Error('知识不存在或无权查看');
      restoreExistingClasses(entityId, assignedClasses.items);
      currentNode = node; mediaItems = window.homeKnowledgeMediaViewer?.collectMedia(node) || []; mediaIndex = 0;
      refs.detail.replaceChildren(); renderKnowledge();
      if (direction && refs.detail.animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const animation = refs.detail.animate([{transform: 'translate3d(0,' + (direction * 24) + '%,0)', opacity: .5}, {transform:'translate3d(0,0,0)',opacity:1}], {duration:240,easing:'ease-out'});
        await animation.finished.catch(() => {});
        if (token !== version || !dialog.open) return;
      }
      loaded = node.can_edit !== false;
      refs.status.textContent = loaded ? '可多选分类，点击保存并下一条提交。上下翻页保留本次勾选，已分类项已勾选并保留，可继续添加分类。' : '无权修改此知识，可以跳过';
    } catch (error) { if (token === version) { refs.status.textContent = error.message; refs.retry.hidden = false; } }
    finally { if (token === version) { loading = false; renderChoices(); } }
  }
  function updateTotals() {
    assigned = [...outcomes.values()].filter((value) => value === 'assigned').length;
    skipped = [...outcomes.values()].filter((value) => value === 'skipped').length;
  }
  function navigate(direction) {
    if (saving || loading) return;
    const next = index + direction; if (next < 0 || next >= queue.length) return;
    index = next; void show(direction);
  }
  function renderKnowledge() {
    stopMedia(); refs.detail.replaceChildren();
    const stage = document.createElement('div'); stage.className = 'manual-reel-stage';
    const item = mediaItems[mediaIndex];
    if (item) {
      const el = document.createElement(item.kind === 'video' ? 'video' : 'img'); el.src = item.url;
      if (item.kind === 'video') { el.controls = true; el.playsInline = true; el.preload = 'metadata'; } else el.alt = currentNode.name || '知识图片';
      stage.append(el);
    }
    const caption = document.createElement('div'); caption.className = 'manual-reel-caption';
    const title = document.createElement('h3'); title.textContent = currentNode.name || currentNode.label_zh || currentNode.label || queue[index];
    const text = document.createElement('p'); text.textContent = [currentNode.description || currentNode.desc_zh, currentNode.wiki_md].filter(Boolean).join('\n\n') || '暂无文字描述';
    caption.append(title, text);
    const more = document.createElement('button'); more.type = 'button'; more.className = 'manual-reel-more'; more.textContent = '查看完整信息'; more.setAttribute('aria-expanded', 'false');
    more.onclick = () => { const expanded = caption.classList.toggle('is-expanded'); more.textContent = expanded ? '收起信息' : '查看完整信息'; more.setAttribute('aria-expanded', String(expanded)); };
    caption.append(more); stage.append(caption);
    if (mediaItems.length > 1) {
      const nav = document.createElement('div'); nav.className = 'manual-reel-media-nav';
      for (const direction of [-1, 1]) { const button = document.createElement('button'); button.type = 'button'; button.className = 'btn'; button.textContent = direction < 0 ? '‹' : '›'; button.setAttribute('aria-label', direction < 0 ? '上一个媒体' : '下一个媒体'); button.onclick = () => { mediaIndex = (mediaIndex + direction + mediaItems.length) % mediaItems.length; renderKnowledge(); }; nav.append(button); }
      const counter = document.createElement('span'); counter.textContent = (mediaIndex + 1) + ' / ' + mediaItems.length; nav.append(counter); stage.append(nav);
    }
    refs.detail.append(stage);
  }
  async function save() {
    if (saving || !loaded || !dialog.open || !selection().size) return;
    saving = true; controls(); refs.status.textContent = '正在保存分类…';
    try {
      const chain = [], seen = new Set();
      for (const classId of selection()) {
        const branch = [], visited = new Set(); let item = classes.find((item) => item.id === classId);
        while (item && !visited.has(item.id)) { visited.add(item.id); branch.unshift(item.id); item = classes.find((other) => other.id === item.parent_id); }
        for (const id of branch) if (!seen.has(id)) { seen.add(id); chain.push(id); }
      }
      for (const id of chain) { await api('/api/kb/entity/class', {}, { entity_id: queue[index], class_id: id }); changed = true; }
      outcomes.set(queue[index], 'assigned'); updateTotals(); index++; saving = false; await show(1);
    } catch (error) { refs.status.textContent = `保存失败：${error.message}。仍停留在当前条，可重试或跳过。`; }
    finally { saving = false; controls(); }
  }
  function create() {
    dialog = document.createElement('dialog'); dialog.className = 'manual-classify-dialog'; dialog.setAttribute('aria-label', '人工快速分类');
    dialog.innerHTML = `
      <div class="manual-classify-workspace">
        <section class="manual-classify-preview" aria-label="知识预览"><div class="manual-classify-section-label"><span data-ref="position"></span><div><button type="button" class="btn" data-ref="previous">↑ 上一条</button><button type="button" class="btn" data-ref="next">↓ 下一条</button><button type="button" class="btn" data-ref="close" aria-label="关闭分类面板">×</button></div></div><main data-ref="detail"></main></section>
        <aside data-ref="footer" class="manual-classify-picker" aria-label="选择分类">
          <div class="manual-classify-heading"><strong>选择分类 · 可多选</strong><span data-ref="count"></span></div>
          <label class="manual-classify-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input data-ref="search" type="search" placeholder="搜索分类或路径" aria-label="搜索分类"></label>
          <div data-ref="choices" class="manual-classify-choices"></div>
          <div class="manual-classify-picker-footer"><div class="manual-classify-progress"><span data-ref="progress"></span><progress data-ref="meter" max="1" value="0" aria-label="分类完成进度"></progress><span class="manual-classify-stat">已分类 <b data-ref="assigned">0</b> · 跳过 <b data-ref="skipped">0</b></span></div><button type="button" class="btn primary" data-ref="save">保存并下一条</button><button type="button" class="btn" data-ref="skip">跳过此条 <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></div>
        </aside>
      </div>
      <footer class="manual-classify-status"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><p data-ref="status" role="status" aria-live="polite"></p><button type="button" class="btn" data-ref="retry" hidden>重新加载详情</button></footer>`;
    refs = Object.fromEntries(Array.from(dialog.querySelectorAll('[data-ref]')).map((el) => [el.dataset.ref, el])); document.body.append(dialog);
    refs.close.onclick = () => dialog.close(); refs.skip.onclick = () => { if (saving || loading || index >= queue.length) return; if (!outcomes.has(queue[index])) outcomes.set(queue[index], 'skipped'); updateTotals(); index++; void show(1); };
    refs.save.onclick = () => void save(); refs.previous.onclick = () => navigate(-1); refs.next.onclick = () => navigate(1);
    refs.detail.addEventListener('pointerdown', (event) => { if (saving || loading || event.target.closest('button,.manual-reel-caption.is-expanded')) return;
      const video = event.target.closest('video');
      if (video && event.clientY > video.getBoundingClientRect().bottom - 48) return;
      gesture = {x:event.clientX,y:event.clientY}; });
    refs.detail.addEventListener('pointerup', (event) => { if (!gesture) return; const dy = event.clientY - gesture.y, dx = event.clientX - gesture.x; gesture = null; if (Math.abs(dy) > 55 && Math.abs(dy) > Math.abs(dx)) navigate(dy < 0 ? 1 : -1); });
    refs.detail.addEventListener('pointercancel', () => { gesture = null; });
    refs.detail.addEventListener('wheel', (event) => { if (event.target.closest('input,button,.manual-reel-caption.is-expanded')) return; event.preventDefault(); if (Math.abs(event.deltaY) < 25 || Date.now() - wheelAt < 650) return; wheelAt = Date.now(); navigate(event.deltaY > 0 ? 1 : -1); }, {passive:false});
    dialog.addEventListener('keydown', (event) => { if (event.target.closest('input,textarea,button,video') || event.repeat) return; if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); navigate(event.key === 'ArrowDown' ? 1 : -1); } });
    refs.retry.onclick = () => void show(); refs.search.oninput = renderChoices;
    dialog.addEventListener('cancel', (event) => { if (saving) event.preventDefault(); });
    dialog.addEventListener('close', () => { version++; stopMedia(); if (changed) { changed = false; Promise.resolve(window.loadTablePage?.()).catch(() => {}); } });
  }
  button.onclick = async () => {
    if (dialog?.open) return;
    if (!dialog) create();
    const selected = Array.from(window.kbSelectedRowIds || []);
    queue = [...new Set((selected.length ? selected : window.kbTableNodes || []).map(idOf).filter(Boolean))];
    if (!queue.length) { window.alert('当前没有可分类的知识，请先加载表格或勾选知识。'); return; }
    scope = new URLSearchParams(location.search).get('db') || ''; index = assigned = skipped = 0; changed = loaded = false; loading = true; picks = new Map(); outcomes = new Map(); existingClasses = new Map();
    stopMedia(); refs.detail.replaceChildren(); refs.footer.hidden = false; refs.retry.hidden = true; dialog.classList.remove('is-complete');
    refs.search.value = ''; classes = []; renderChoices(); dialog.showModal(); refs.status.textContent = '正在加载分类…';
    const token = ++version;
    try { const data = await api('/api/kb/classes'); if (token !== version || !dialog.open) return; classes = flatten(Array.isArray(data) ? data : data.items || []); renderChoices(); await show(); }
    catch (error) { if (token === version) refs.status.textContent = `分类加载失败：${error.message}，请关闭后重试`; }
  };
})();
