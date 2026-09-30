(function () {
  const trigger = document.getElementById('btnTableMore');
  if (!trigger) return;
  const menu = document.createElement('div');
  menu.id = 'knowledgeContextMenu'; menu.className = 'knowledge-context-menu';
  menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', '知识操作'); menu.hidden = true;
  const summary = document.createElement('div'); summary.className = 'knowledge-context-summary';
  menu.append(summary);
  for (const [id, label, icon, danger] of [
    ['btnManualClassify', '人工快速分类', 'fa-tags'],
    ['btnJevClassify', 'JEV 自动分类', 'fa-wand-magic-sparkles'],
    ['btnDeleteSelected', '删除选中知识', 'fa-trash-can', true],
    ['btnClearAllNodes', '清空知识列表', 'fa-eraser', true],
  ]) {
    const button = document.getElementById(id);
    if (!button) continue;
    button.className = danger ? 'knowledge-menu-item is-danger' : 'knowledge-menu-item';
    button.setAttribute('role', 'menuitem');
    button.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><span>${label}</span>`;
    menu.append(button);
  }
  document.body.append(menu);
  let returnFocus = trigger;
  function close(restore = false) {
    if (menu.hidden) return;
    menu.hidden = true; trigger.setAttribute('aria-expanded', 'false');
    if (restore) returnFocus?.focus({ preventScroll: true });
  }
  function open(x, y, origin) {
    returnFocus = origin;
    window.ensureTableSelectedButtonsState?.();
    const count = window.kbSelectedRowIds?.size || 0;
    summary.textContent = count ? `已选 ${count} 条知识` : '未选择知识 · 人工分类处理当前页';
    menu.hidden = false; trigger.setAttribute('aria-expanded', 'true');
    menu.style.left = `${Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8))}px`;
    menu.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }
  trigger.addEventListener('click', () => {
    if (!menu.hidden) { close(true); return; }
    const rect = trigger.getBoundingClientRect(); open(rect.right - 240, rect.bottom + 6, trigger);
  });
  for (const host of [document.getElementById('entityManageRows')]) {
    if (!host) continue;
    host.addEventListener('contextmenu', (event) => {
      if (event.target.closest('input:not([type="checkbox"]), textarea, video, a, [contenteditable="true"]')) return;
      const row = event.target.closest('[data-id], .dhx_grid-row[data-dhx-id]');
      const id = row && host.contains(row) ? row.dataset.id || row.dataset.dhxId : '';
      event.preventDefault();
      // Grid widgets may consume contextmenu before it reaches a bubble listener.
      event.stopPropagation();
      if (id) window.selectEntityManageContextRow?.(id);
      const origin = id ? row : host;
      origin.tabIndex = -1;
      const rect = origin.getBoundingClientRect();
      open(event.clientX || rect.left + 20, event.clientY || rect.top + 20, origin);
    }, true);
  }
  // Close before the existing action handler can open a modal and move focus.
  menu.addEventListener('click', (event) => { if (event.target.closest('button:not(:disabled)')) close(true); }, true);
  menu.addEventListener('keydown', (event) => {
    const items = [...menu.querySelectorAll('button:not(:disabled)')];
    const index = items.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    else if (event.key === 'Tab') close(true);
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  });
  document.addEventListener('pointerdown', (event) => { if (!menu.contains(event.target) && !trigger.contains(event.target)) close(); });
  document.addEventListener('focusin', (event) => { if (!menu.contains(event.target) && !trigger.contains(event.target)) close(); });
  document.addEventListener('scroll', (event) => { if (!menu.contains(event.target)) close(); }, true);
  window.addEventListener('resize', () => close());
  window.addEventListener('hashchange', () => close());
})();
