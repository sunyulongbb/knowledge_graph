(function () {
  const brand = document.getElementById('homeSidebarBrandToggle');
  const media = window.matchMedia('(max-width: 1000px)');
  let preference = '';
  try { preference = localStorage.getItem('kb:home-sidebar') || ''; } catch {}
  function apply() {
    const collapsed = preference ? preference === 'collapsed' : media.matches;
    document.documentElement.dataset.homeSidebar = collapsed ? 'collapsed' : 'expanded';
    document.body.dataset.homeSidebar = document.documentElement.dataset.homeSidebar;
    if (brand) {
      brand.setAttribute('aria-expanded', String(!collapsed));
      const label = `${collapsed ? '展开' : '收起'}菜单；双击切换应用`;
      brand.title = `单击${label}`; brand.setAttribute('aria-label', label);
    }
  }
  function toggle(event) {
    event?.preventDefault();
    event?.stopPropagation();
    preference = document.body.dataset.homeSidebar === 'collapsed' ? 'expanded' : 'collapsed';
    try { localStorage.setItem('kb:home-sidebar', preference); } catch {}
    apply();
  }
  let clickTimer = 0;
  brand?.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation();
    clearTimeout(clickTimer);
    if (event.detail > 1) return;
    if (event.detail === 0) { toggle(); return; }
    clickTimer = setTimeout(() => { clickTimer = 0; toggle(); }, 450);
  });
  brand?.addEventListener('dblclick', event => {
    event.preventDefault(); event.stopPropagation();
    clearTimeout(clickTimer); clickTimer = 0;
    void window.showAppLogoSwitcher?.();
  });
  media.addEventListener('change', () => { if (!preference) apply(); });
  apply();
})();
