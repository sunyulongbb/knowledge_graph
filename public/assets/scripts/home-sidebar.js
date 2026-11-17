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
    void window.showAppLogoSwitcher?.({ space: 'home' });
  });
  media.addEventListener('change', () => { if (!preference) apply(); });
  const settings = document.querySelector('.home-settings');
  const settingsTrigger = settings?.querySelector('summary');
  const settingsMenu = settings?.querySelector('.home-settings-menu');
  function positionSettings() {
    if (!settings?.open || !settingsMenu) return;
    const rect = settingsTrigger.getBoundingClientRect();
    const sidebarRect = document.getElementById('homeDiscoverySidebar').getBoundingClientRect();
    const width = Math.min(220, window.innerWidth - 24);
    settingsMenu.style.width = width + 'px';
    settingsMenu.style.left = Math.max(12, Math.min(sidebarRect.right + 8, window.innerWidth - width - 12)) + 'px';
    settingsMenu.style.top = Math.max(12, Math.min(rect.top, window.innerHeight - settingsMenu.offsetHeight - 12)) + 'px';
  }
  settings?.addEventListener('toggle', () => {
    settingsTrigger.setAttribute('aria-expanded', String(settings.open));
    positionSettings();
  });
  settings?.querySelector('.home-discovery-tools')?.addEventListener('toggle', positionSettings);
  document.addEventListener('click', event => { if (settings?.open && !settings.contains(event.target)) settings.open = false; });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && settings?.open) {
      event.preventDefault(); settings.open = false; settingsTrigger.focus();
    }
  });
  window.addEventListener('resize', positionSettings);
  document.getElementById('homeDiscoverySidebar')?.addEventListener('scroll', positionSettings, {passive:true});
  apply();
})();
