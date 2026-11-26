(function () {
  const button = document.getElementById('btnEntityImport');
  const input = document.getElementById('entityImportFile');
  const status = document.getElementById('addMsg');
  const avatar = document.getElementById('composerUserAvatar');
  const avatarImage = document.getElementById('composerUserAvatarImage');
  const avatarFallback = document.getElementById('composerUserAvatarFallback');
  const isImageAvatar = (value) => /^(?:https?:\/\/|\/|data:image\/|blob:)/i.test(String(value || '').trim());
  const syncComposerAvatar = (user) => {
    if (!avatar) return;
    avatar.hidden = !user;
    avatar.setAttribute('aria-hidden', user ? 'false' : 'true');
    if (!user) {
      if (avatarImage) { avatarImage.hidden = true; avatarImage.removeAttribute('src'); }
      if (avatarFallback) avatarFallback.textContent = '';
      return;
    }
    const avatarValue = String(user.avatar || '').trim();
    const label = String(user.displayName || user.username || '用户').trim();
    avatar.classList.toggle('is-emoji', Boolean(avatarValue) && !isImageAvatar(avatarValue));
    avatar.title = label;
    if (avatarImage && isImageAvatar(avatarValue)) {
      avatarImage.src = avatarValue;
      avatarImage.alt = `${label}的头像`;
      avatarImage.hidden = false;
      avatarImage.onerror = () => {
        avatarImage.hidden = true;
        if (avatarFallback) avatarFallback.textContent = label.replace(/\s+/g, '').slice(0, 2).toUpperCase() || '用户';
      };
      if (avatarFallback) avatarFallback.textContent = '';
      return;
    }
    if (avatarImage) { avatarImage.hidden = true; avatarImage.removeAttribute('src'); }
    if (avatarFallback) avatarFallback.textContent = avatarValue || label.replace(/\s+/g, '').slice(0, 2).toUpperCase() || '用户';
  };
  syncComposerAvatar(window.authUser);
  window.addEventListener('kb-auth-change', (event) => syncComposerAvatar(event.detail?.user));
  document.getElementById('btnCancelEdit')?.addEventListener('click', () => {
    window.resetFormToAdd?.();
    document.getElementById('entityDisplayName')?.focus();
  });
  if (!button || !input) return;

  button.addEventListener('click', () => input.click());
  const wikidataButton = document.createElement('button');
  wikidataButton.type = 'button';
  wikidataButton.title = '从 Wikidata 导入';
  wikidataButton.setAttribute('aria-label', '从 Wikidata 导入');
  wikidataButton.innerHTML = '<i class="fa-solid fa-cloud-arrow-down" aria-hidden="true"></i>';
  button.after(wikidataButton);
  const modal = document.createElement('dialog');
  modal.setAttribute('aria-label', 'Wikidata 知识导入');
  modal.style.cssText = 'width:min(560px,90vw);border:1px solid #ddd;border-radius:16px;padding:24px';
  modal.innerHTML = `<form><h3>从 Wikidata 导入知识</h3><label>实体 ID <input name="id" required pattern="[Qq][1-9][0-9]*" placeholder="Q305177" autocomplete="off"></label><p><label><input type="checkbox" name="downloadMedia" checked> 下载图片和视频到本地知识库</label></p><p>查询知识 → 入库 → 导入一层关系实体 → 查询媒体 → 下载媒体</p><progress max="100" value="0" style="width:100%" aria-label="导入进度"></progress><pre role="log" aria-live="polite" style="white-space:pre-wrap;max-height:280px;overflow:auto;font-size:13px"></pre><div><button type="submit">开始导入</button> <button type="button" data-close>关闭</button> <a hidden data-result>查看知识</a></div></form>`;
  document.body.append(modal);
  let running = false;
  modal.querySelector('[data-close]').onclick = () => modal.close();
  wikidataButton.onclick = () => { modal.showModal(); modal.querySelector('input').focus(); };
  modal.querySelector('form').onsubmit = async event => {
    event.preventDefault();
    if (running) return;
    running = true;
    const submit = modal.querySelector('[type=submit]'), progress = modal.querySelector('progress'), logs = modal.querySelector('pre'), link = modal.querySelector('[data-result]');
    submit.disabled = true; link.hidden = true; logs.textContent = ''; progress.value = 0;
    const append = message => { logs.textContent += new Date().toLocaleTimeString() + ' ' + message + '\n'; logs.scrollTop = logs.scrollHeight; };
    try {
      const url = new URL('/api/kb/entity/import-wikidata', location.origin);
      const db = window.getCurrentDbParam();
      if (db) url.searchParams.set('db', db);
      append('开始导入');
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: modal.querySelector('[name=id]').value.trim(), downloadMedia: modal.querySelector('[name=downloadMedia]').checked }) });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || '导入失败'); }
      if (!response.headers.get('content-type')?.includes('ndjson')) { const result = await response.json(); progress.value = 100; append('导入完成'); showResult(result.entityId); return; }
      function showResult(id) { if (!id) return; const next = new URL(location.href); next.searchParams.set('node', id); link.href = next; link.hidden = false; link.textContent = '查看知识'; }
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n'); buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          const entry = JSON.parse(line);
          if (!entry.error) progress.value = Math.max(progress.value, entry.progress);
          append(entry.message); showResult(entry.entityId);
          if (entry.error) throw new Error('导入未完成，请查看上方日志');
        }
        if (done) break;
      }
    } catch (error) { append('错误：' + error.message); }
    finally { running = false; submit.disabled = false; }
  };
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      if (status) status.textContent = 'JSON 文件不能超过 2MB';
      return;
    }
    button.disabled = true;
    if (status) status.textContent = '正在同步远程文件并导入实体，请稍候…';
    try {
      const text = await file.text();
      let payload;
      try { payload = JSON.parse(text); } catch { throw new Error('文件不是有效的 JSON'); }
      const url = new URL('/api/kb/entity/import', window.location.origin);
      const db = window.getCurrentDbParam();
      if (db) url.searchParams.set('db', db);
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || '导入失败');
      if (status) status.textContent = result.batch
        ? `批量导入成功：新增 ${result.created} 个、更新 ${result.updated} 个实体，共 ${result.attributesCreated + result.attributesUpdated} 个属性值`
        : `导入成功：${result.attributesCreated + result.attributesUpdated} 个属性值`;
      if (result.sync === 'pending') {
        if (status) status.textContent += '。实体已保存，搜索索引正在更新，系统将自动重试。';
        return;
      }
      const next = new URL(window.location.href);
      next.searchParams.set('node', result.entityId);
      window.location.href = next.toString();
    } catch (error) {
      if (status) status.textContent = `导入失败：${error?.message || error}`;
    } finally {
      button.disabled = false;
    }
  });

  button.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    window.open('/examples/entity-import-format.md', '_blank', 'noopener');
  });
})();
