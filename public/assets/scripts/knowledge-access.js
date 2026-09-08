(function () {
  const byId = (id) => document.getElementById(id);
  const normalizeId = (id) => String(id || '').replace(/^entity\//, '');
  const activeId = () => normalizeId(byId('detailPanel')?.dataset.entityId || window.kbActiveDetailNodeId);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let editorNode = null;
  let generation = 0;
  const canCreate = () => !!window.authUser && (!window.kbApplicationScope || (window.kbApplicationProjects || []).some((project) => project.slug === window.kbApplicationScope && project.member));
  const canEditCurrent = () => !!window.authUser && (byId('fId')?.value ? !!editorNode?.can_edit : canCreate());
  window.canEditCurrentKnowledge = canEditCurrent;
  const nodeForId = (id) => (window.kbTableNodes || []).find((node) => normalizeId(node.id || node._id) === normalizeId(id));
  window.canOperateKnowledgeSelection = (ids, mode = 'edit') => !!window.authUser && ids.length > 0 && ids.every((id) => !!nodeForId(id)?.[mode === 'manage' ? 'can_manage' : 'can_edit']);
  const editControls = '#btnAddOntologyChip,#composerTypeSelect,#btnEntityImageUpload,#btnEntityVideoUpload,#btnEntityPdfUpload,#btnShowAttrForm,#btnAttrEditSelected,#btnAttrDeleteSelected,#btnSubmit,.attr-row-del-btn,.attr-quick-add-btn';
  const adminControls = '#btnOntologyAddRoot,#btnOntologyImport,#btnPropertyAdd,#btnPropertyDeleteSelected,#btnClsAdd,#btnClsDelete,#btnTagAdd,#btnSparqlConfirmImport,#btnSparqlImport';
  const permissionDisabled = new WeakSet();
  function lock(element, denied) {
    if (denied) {
      if (!element.disabled) { permissionDisabled.add(element); element.disabled = true; }
      if (element.getAttribute('aria-disabled') !== 'true') element.setAttribute('aria-disabled', 'true');
    } else {
      if (permissionDisabled.has(element)) { element.disabled = false; permissionDisabled.delete(element); }
      if (element.hasAttribute('aria-disabled')) element.removeAttribute('aria-disabled');
    }
  }
  function syncControls() {
    const allowed = canEditCurrent();
    document.querySelectorAll(`${editControls},#nodeForm input,#nodeForm textarea,#nodeForm select:not(#knowledgeVisibility),#nodeForm button:not(#btnCancelEdit),#attrForm input,#attrForm textarea,#attrForm select,#attrForm button:not(#btnAttrReset)`).forEach((element) => lock(element, !allowed));
    if (byId('knowledgeVisibility')) lock(byId('knowledgeVisibility'), !window.authUser || (!!byId('fId')?.value && !editorNode?.can_manage));
    document.querySelectorAll('#entityDisplayName,#entityDisplayDesc,#entityDisplayAliases').forEach((element) => {
      if (!allowed && element.contentEditable !== 'false') element.contentEditable = 'false';
    });
    document.querySelectorAll('#btnTableAdd').forEach((element) => lock(element, !canCreate()));
    document.querySelectorAll(adminControls).forEach((element) => lock(element, window.authUser?.role !== 'admin'));
    window.ensureTableSelectedButtonsState?.();
  }
  for (const type of ['click', 'dblclick', 'beforeinput', 'paste', 'drop', 'submit']) {
    document.addEventListener(type, (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('#btnCancelEdit,#btnAttrReset')) return;
      const denied = (!canEditCurrent() && target.closest(`#nodeForm,#attrForm,${editControls}`)) ||
        (!canCreate() && target.closest('#btnTableAdd')) ||
        (window.authUser?.role !== 'admin' && target.closest(adminControls));
      if (denied) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
  }
  let pendingSync = false;
  new MutationObserver(() => {
    if (pendingSync) return;
    pendingSync = true;
    queueMicrotask(() => { pendingSync = false; syncControls(); });
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'contenteditable'] });
  async function request(path, body) {
    const url = new URL(path, location.origin);
    const scope = new URLSearchParams(location.search).get('db');
    if (scope) url.searchParams.set('db', scope);
    const response = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '请求失败');
    return data;
  }
  function syncEditor(node) {
    editorNode = node;
    const canEdit = !!window.authUser && (node ? !!node.can_edit : !byId('fId')?.value);
    const select = byId('knowledgeVisibility');
    if (select) {
      select.value = node?.visibility === 'private' ? 'private' : 'public';
      select.disabled = node ? !node.can_manage : !window.authUser;
      select.title = node && !node.can_manage ? '仅创建者可以修改访问级别' : '公开：所有人可读；私有：仅创建者和维护者可读';
    }
    if (byId('entityDisplayName')) byId('entityDisplayName').contentEditable = String(canEdit);
    if (byId('btnSubmit')) {
      byId('btnSubmit').disabled = !canEdit;
      byId('btnSubmit').title = canEdit ? '保存知识' : window.authUser ? '申请成为维护者后可编辑' : '请先登录';
    }
    syncControls();
  }
  function section() {
    let element = byId('knowledgeMaintainers');
    if (!element && byId('detailInner')) {
      element = document.createElement('section');
      element.id = 'knowledgeMaintainers';
      element.className = 'knowledge-maintainers';
      byId('detailInner').appendChild(element);
    }
    return element;
  }
  const identity = (user) => `${escape(user.display_name || user.username)} <span class="muted">@${escape(user.username)}</span>`;
  async function load() {
    const id = activeId(), token = ++generation, target = section();
    if (!id || !target) return;
    target.innerHTML = '<p class="muted">加载维护信息…</p>';
    try {
      const data = await request(`/api/kb/knowledge-access?id=${encodeURIComponent(id)}`);
      if (generation !== token || activeId() !== id) return;
      if (byId('btnEditWiki')) byId('btnEditWiki').style.display = data.canEdit ? 'inline-flex' : 'none';
      if (normalizeId(byId('fId')?.value) === id) syncEditor({ ...editorNode, visibility: data.visibility, can_edit: data.canEdit, can_manage: data.canManage });
      const owner = data.owner ? `<li>${identity(data.owner)} <span class="knowledge-role">创建者</span></li>` : '<li class="muted">历史知识：创建者未记录</li>';
      const maintainers = data.maintainers.map((user) => `<li>${identity(user)} <span class="knowledge-role">维护者</span>${data.canManage ? `<button type="button" class="btn sm" data-remove="${user.id}">移除</button>` : ''}</li>`).join('');
      const pending = data.ownRequest?.status === 'pending';
      target.innerHTML = `<div class="knowledge-maintainers-head"><h3>知识维护者</h3><span class="knowledge-role">${data.visibility === 'private' ? '私有' : '公开'}</span></div>
        <ul class="knowledge-maintainer-list">${owner}${maintainers}</ul>
        ${data.canRequest ? pending ? '<p class="muted">维护申请已提交，等待创建者审批。</p>' : '<div class="knowledge-maintenance-apply"><textarea id="knowledgeMaintenanceMessage" rows="2" maxlength="1000" placeholder="维护申请说明（选填）"></textarea><button type="button" class="btn primary" data-apply>申请维护</button></div>' : !window.authUser ? '<p class="muted">登录后可以申请维护此知识。</p>' : ''}
        ${data.canManage && data.requests.length ? `<h4>待审批的维护申请</h4><ul class="knowledge-maintainer-list">${data.requests.map((item) => `<li><div>${identity(item)}<p>${escape(item.message || '未填写说明')}</p></div><button type="button" class="btn sm primary" data-review="approve" data-user="${item.user_id}">批准</button><button type="button" class="btn sm" data-review="reject" data-user="${item.user_id}">拒绝</button></li>`).join('')}</ul>` : ''}
        <p id="knowledgeMaintenanceStatus" class="muted" role="status"></p>`;
    } catch (error) {
      if (generation === token) target.textContent = error.message;
    }
  }
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('#knowledgeMaintainers button');
    if (!button) return;
    const id = activeId();
    if (!id) return;
    button.disabled = true;
    try {
      if (button.hasAttribute('data-apply')) await request('/api/kb/knowledge-maintenance/request', { id, message: byId('knowledgeMaintenanceMessage')?.value || '' });
      else if (button.dataset.review) await request('/api/kb/knowledge-maintenance/review', { id, user_id: Number(button.dataset.user), decision: button.dataset.review });
      else if (button.dataset.remove) await request('/api/kb/knowledge-maintenance/remove', { id, user_id: Number(button.dataset.remove) });
      if (activeId() === id) await load();
    } catch (error) {
      if (activeId() === id && byId('knowledgeMaintenanceStatus')) byId('knowledgeMaintenanceStatus').textContent = error.message;
    } finally { button.disabled = false; }
  });
  window.addEventListener('kb-editor-access', (event) => syncEditor(event.detail?.node || null));
  window.addEventListener('kb-application-access-change', () => syncEditor(editorNode));
  window.addEventListener('kb-detail-loaded', load);
  let previousUser = window.authUser?.username || '';
  window.addEventListener('kb-auth-change', () => {
    const nextUser = window.authUser?.username || '';
    if (previousUser && nextUser !== previousUser) {
      // Reload discards in-flight requests, editor buffers and every layout cache.
      location.reload();
      return;
    }
    previousUser = nextUser;
    syncEditor(editorNode);
    if (activeId()) load();
    window.loadTablePage?.({ resetPage: true });
  });
  syncEditor(byId('fId')?.value ? window.kbCurrentNodePayload : null);
})();
