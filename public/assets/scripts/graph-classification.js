(() => {
  let entityId = '', scope = '', ids = new Set(), seq = 0, ready = false, pending = false, loading = false;
  const currentScope = () => new URLSearchParams(location.search).get('db') || '';
  const normalize = (id) => String(id || '').replace(/^entity\//, '');
  function publish(message = '', error = false) {
    window.dispatchEvent(new CustomEvent('kb:graph-classification', {
      detail: { entityId, ids: [...ids], loading, pending, message, error },
    }));
  }
  async function sync(id, force = false) {
    const next = normalize(id), nextScope = currentScope();
    if (!force && next === entityId && nextScope === scope && (ready || loading)) return;
    entityId = next; scope = nextScope; ids = new Set(); ready = false;
    loading = !!next;
    const token = ++seq;
    publish();
    if (!next) { ready = true; return; }
    try {
      const url = new URL('/api/kb/entity/class', location.origin);
      if (scope) url.searchParams.set('db', scope);
      url.searchParams.set('id', `entity/${next}`);
      const response = await fetch(url);
      const data = await response.json();
      if (token !== seq || scope !== currentScope()) return;
      if (!response.ok) throw Error(data.error || `HTTP ${response.status}`);
      ids = new Set((data.items || []).map((item) => String(item.id)));
      ready = true;
      loading = false;
      publish();
    } catch (error) {
      if (token === seq) { loading = false; publish(`读取分类失败：${error.message}`, true); }
    }
  }
  async function toggle(classId) {
    if (!entityId) { publish('请先选中一个画布节点'); return; }
    if (!ready || pending || window.kbViewMode !== 'vis') return;
    if (scope !== currentScope()) { void sync(''); return; }
    const target = entityId, targetScope = scope;
    const assigned = ids.has(String(classId));
    pending = true; publish();
    try {
      const action = assigned ? window.clearEntityClass : window.setEntityClass;
      if (typeof action !== 'function') throw Error('分类服务尚未就绪，请稍后重试');
      await action(`entity/${target}`, String(classId));
      if (entityId === target && scope === targetScope && scope === currentScope()) {
        await sync(target, true);
        if (ready) publish(assigned ? '已取消分类' : '已设置分类');
        // Refresh the entity manager only if it still edits this same knowledge.
        if (normalize(document.getElementById('fId')?.value) === target) void window.loadEntityClass?.(`entity/${target}`);
      }
    } catch (error) {
      if (entityId === target && scope === targetScope) publish(`设置分类失败：${error.message}`, true);
    } finally { pending = false; publish(); }
  }
  window.kbGraphClassification = { sync, toggle, has: (id) => ids.has(String(id)), assignedIds: () => [...ids] };
})();
