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
      const db = new URLSearchParams(window.location.search).get('db');
      if (db) url.searchParams.set('db', db);
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || '导入失败');
      if (status) status.textContent = `导入成功：${result.attributesCreated} 个属性值`;
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
