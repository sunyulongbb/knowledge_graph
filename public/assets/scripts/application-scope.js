(function () {
  function getCurrentDbParam() {
    try {
      const currentUrl = new URL(window.location.href);
      const legacy = currentUrl.searchParams.get("db");
      if (legacy) return legacy.trim();
      const match = currentUrl.pathname.match(/^\/([A-Za-z0-9_-]+)(?:\/[A-Za-z0-9_-]+){0,2}\/?$/);
      return match && !['kb', 'sparql', 'product', 'chat'].includes(match[1]) ? match[1] : '';
    } catch {
      return "";
    }
  }

  function appendCurrentDbParam(input) {
    try {
      const db = getCurrentDbParam();
      const url =
        input instanceof URL
          ? new URL(input.toString())
          : new URL(String(input), window.location.origin);
      if (db) {
        url.searchParams.set("db", db);
      } else {
        url.searchParams.delete("db");
      }
      return url;
    } catch {
      return input;
    }
  }

  const homeViews = new Set(['app_home','app_search','app_explore','joined_type','shorts','learning','big_bang','knowledge_graph','knowledge_detail','profile']);
  window.getPageSpace = view => homeViews.has(view) ? 'home' : 'workspace';
  window.resolveSpaceView = (from, to, allowCrossSpace = false) => {
    if (allowCrossSpace || !from) return to;
    if (to === 'detail' || to === 'knowledge_detail') return window.getPageSpace(from) === 'home' ? 'knowledge_detail' : 'detail';
    return window.getPageSpace(from) === window.getPageSpace(to) ? to : '';
  };
  let navigationClick = false;
  window.isSpaceNavigationClick = () => navigationClick;
  if (typeof document !== 'undefined') document.addEventListener('click', event => {
    navigationClick = Boolean(event.target?.closest?.('.home-discovery-nav,.home-discovery-tools,.home-discovery-footer,.nav-item,#headerProjectName,#homeSidebarBrandToggle'));
    queueMicrotask(() => { navigationClick = false; });
  }, true);
  const pageNames = { app_home:'home', app_explore:'explore', joined_type:'type', app_search:'search', shorts:'shorts', learning:'learning', table:'table', vis:'graph', applications:'applications', profile:'profile', knowledge_detail:'knowledge' };
  window.getProjectPageRoute = function () {
    const segments = window.location.pathname.split('/');
    const page = ['home','workspace'].includes(segments[2]) ? (segments[3] || (segments[2] === 'home' ? 'home' : 'table')) : segments[2] || '';
    if (['popular', 'news'].includes(page)) return { view:'app_home', feed:page };
    const view = Object.keys(pageNames).find(key => pageNames[key] === page) || page;
    return { view, feed:'for-you' };
  };
  window.projectViewUrl = function (view, input = window.location.href, feed) {
    const url = new URL(input, window.location.origin);
    const db = url.searchParams.get('db') || getCurrentDbParam() || 'default';
    const selectedFeed = feed || url.searchParams.get('home_feed') || (window.getProjectPageRoute().feed);
    const page = view === 'app_home' && ['popular','news'].includes(selectedFeed) ? selectedFeed : (pageNames[view] || view);
    url.pathname = '/' + encodeURIComponent(db) + '/' + window.getPageSpace(view) + (view === 'app_home' && page === 'home' ? '' : '/' + encodeURIComponent(page || 'home'));
    url.searchParams.delete('db');
    if (view !== 'joined_type') url.searchParams.delete('type_id');
    if (view === 'app_home') url.searchParams.delete('home_feed');
    const params = new URLSearchParams(url.hash.slice(1));
    params.delete('view');
    url.hash = params.toString();
    return url;
  };
  window.projectSwitchUrl = function (db, space) {
    const current = window.getProjectPageRoute().view || window.kbViewMode;
    const source = space || window.getPageSpace(current || 'app_home');
    const view = source === 'workspace' ? 'table' : 'app_home';
    const url = new URL('/' + encodeURIComponent(db || 'default') + '/' + (view === 'table' ? 'workspace/table' : 'home'), window.location.origin);
    return url;
  };
  window.projectPageUrl = function (db, input = window.location.href) {
    const url = new URL(input, window.location.origin);
    url.pathname = '/' + encodeURIComponent(db || 'default');
    url.searchParams.delete('db');
    return url;
  };
  // Keep presentation state and inactive-page filters out of page URLs.
  window.cleanProjectPageUrl = function (input) {
    let url = new URL(input, window.location.origin);
    const hash = new URLSearchParams(url.hash.slice(1));
    const legacyView = hash.get('view') || (/^#[a-z_]+$/.test(url.hash) ? url.hash.slice(1) : '');
    if (legacyView) {
      if (!hash.has('view')) url.hash = '';
      url = window.projectViewUrl(legacyView, url);
    }
    for (const key of ['leftSidebar','rightSidebar']) url.searchParams.delete(key);
    const defaults = { limit:'20', page:'1', prop_limit:'20', prop_page:'1', order:'modified_desc' };
    for (const [key, value] of Object.entries(defaults)) {
      if (url.searchParams.get(key) === value) url.searchParams.delete(key);
    }
    const segments = url.pathname.split('/');
    let page = segments[2] || 'home';
    if (page === 'workspace' || page === 'home') page = segments[3] || (page === 'home' ? 'home' : 'table');
    else if (segments[2]) {
      const view = ['popular','news'].includes(page) ? 'app_home' : Object.keys(pageNames).find(key => pageNames[key] === page) || page;
      url.pathname = '/' + segments[1] + '/' + window.getPageSpace(view) + '/' + page;
    }

    if (page !== 'explore' && page !== 'big_bang') {
      for (const key of ['explore_category','explore_tag','explore_page']) url.searchParams.delete(key);
    }
    if (page !== 'table' && page !== 'attr') {
      for (const key of ['limit','page','order','prop_limit','prop_page']) url.searchParams.delete(key);
    }
    return url;
  };
  if (window.history) {
    for (const method of ['pushState','replaceState']) {
      const original = window.history[method].bind(window.history);
      window.history[method] = function (state, title, input) {
        if (input == null) return original(state, title, input);
        const url = new URL(input, window.location.href);
        return original(state, title, url.origin === window.location.origin ? window.cleanProjectPageUrl(url).href : input);
      };
    }
    window.history.replaceState(window.history.state, '', window.location.href);
  }
  window.getCurrentDbParam = getCurrentDbParam;
  window.appendCurrentDbParam = appendCurrentDbParam;
})();
