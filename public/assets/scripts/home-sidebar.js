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
      brand.title = collapsed ? '\u5c55\u5f00\u83dc\u5355' : '\u6536\u8d77\u83dc\u5355';
    }
  }
  function toggle(event) {
    event?.preventDefault();
    event?.stopPropagation();
    preference = document.body.dataset.homeSidebar === 'collapsed' ? 'expanded' : 'collapsed';
    try { localStorage.setItem('kb:home-sidebar', preference); } catch {}
    apply();
  }
  brand?.addEventListener('click', toggle);
  media.addEventListener('change', () => { if (!preference) apply(); });
  apply();
})();
