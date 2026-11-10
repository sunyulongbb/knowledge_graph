(function () {
  const button = document.getElementById('homeSidebarToggle');
  const media = window.matchMedia('(max-width: 1000px)');
  let preference = '';
  try { preference = localStorage.getItem('kb:home-sidebar') || ''; } catch {}
  function apply() {
    const collapsed = preference ? preference === 'collapsed' : media.matches;
    document.body.dataset.homeSidebar = collapsed ? 'collapsed' : 'expanded';
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', collapsed ? '展开菜单' : '收起菜单');
    button.title = collapsed ? '展开菜单' : '收起菜单';
  }
  button.addEventListener('click', () => {
    preference = document.body.dataset.homeSidebar === 'collapsed' ? 'expanded' : 'collapsed';
    try { localStorage.setItem('kb:home-sidebar', preference); } catch {}
    apply();
  });
  media.addEventListener('change', () => { if (!preference) apply(); });
  apply();
})();
