(function () {
  const list = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : [parsed]; } catch { return [value]; }
  };
  function collectMedia(node) {
    const result = [], seen = new Set();
    for (const [kind, values] of [['image', [...list(node.images), ...list(node._attr_images), node.image]], ['video', [...list(node.videos), ...list(node._attr_videos), node.video]]]) {
      for (const value of values) {
        const url = typeof value === 'string' ? value : value?.url || value?.src || '';
        if (!/^(https?:\/\/|\/(?!\/))/i.test(url) || seen.has(kind + url)) continue;
        seen.add(kind + url); result.push({ kind, url });
      }
    }
    return result;
  }
  function textPages(text, size = 320) {
    const chars = Array.from(String(text || '暂无详细信息'));
    const pages = [];
    for (let i = 0; i < chars.length; i += size) pages.push(chars.slice(i, i + size).join(''));
    return pages;
  }
  let dialog, refs, node, media = [], mediaIndex = 0, version = 0, requestController;
  let history = [];
  let journey = null;
  let portrait = null;
  let feed = [], category = '', animations = [], departing = null;
  let scope = '', recent = [], busy = false, wheelAt = 0, wheelSum = 0, touchStart, muted = false;
  let focusBefore, oldOverflow, overlayMode = '', overlayPage = 0, comments = [], liked = false, actionBusy = false;
  const idOf = (item) => String(item?.id || item?._id || '').replace(/^entity\//, '');
  const currentScope = () => new URLSearchParams(location.search).get('db') || '';
  async function api(path, params = {}, options = {}) {
    const url = new URL(path, location.origin);
    if (scope) url.searchParams.set('db', scope);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    const response = await fetch(url, { signal: requestController?.signal, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.error || `请求失败（${response.status}）`);
    return data;
  }
  const message = (text) => { refs.status.textContent = text; };
  function stopMedia() { refs?.stage.querySelectorAll('video').forEach((video) => { video.pause(); video.removeAttribute('src'); video.load(); }); }
  function updateVideoControls() {
    const video = refs.stage.querySelector('video');
    refs.play.hidden = refs.mute.hidden = refs.seek.hidden = refs.playback.hidden = !video;
    refs.centerPlay.hidden = !video || !video.paused;
    if (video) {
      refs.play.textContent = video.paused ? '▶' : 'Ⅱ';
      refs.play.setAttribute('aria-label', video.paused ? '播放' : '暂停');
      refs.mute.textContent = video.muted ? '开启声音' : '关闭声音';
      refs.mute.setAttribute('aria-label', video.muted ? '开启声音' : '关闭声音');
      const time = (value) => { const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0; return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'); };
      refs.time.textContent = time(video.currentTime) + ' / ' + time(video.duration);
      refs.seek.disabled = !Number.isFinite(video.duration) || video.duration <= 0;
      refs.mute.setAttribute('aria-pressed', String(video.muted));
      refs.seek.value = Number.isFinite(video.duration) && video.duration > 0 ? video.currentTime / video.duration * 100 : 0;
    }
  }
  async function playVideo(video, { deferBlocked = false, allowMutedFallback = true } = {}) {
    const token = version;
    try {
      await video.play();
      if (token === version && video.parentNode === refs.stage && dialog.open) {
        video.dataset.playBlocked = ''; updateVideoControls();
        if (/点击.*播放|自动播放被浏览器|浏览器暂未允许/.test(refs.status.textContent)) message('');
      }
    } catch (error) {
      if (token !== version || video.parentNode !== refs.stage || !dialog.open || !video.paused) return;
      if (error.name === 'AbortError') return;
      updateVideoControls();
      if (error.name === 'NotAllowedError') {
        // Keep the feed moving when sound requires an explicit browser gesture.
        // Do not change the user's sound preference for subsequent videos.
        if (allowMutedFallback && !video.muted) {
          video.muted = true;
          return playVideo(video, { deferBlocked, allowMutedFallback: false });
        }
        video.dataset.playBlocked = 'true';
        if (!deferBlocked) message('浏览器暂未允许自动播放，请点击播放');
      } else if (error.name === 'NotSupportedError') message('此视频格式或编码不受浏览器支持');
      else message('视频播放失败，请检查网络后重试');
    }
  }
  function renderMedia() {
    stopMedia(); refs.stage.replaceChildren(); message('');
    const item = media[mediaIndex];
    refs.counter.textContent = media.length ? `${mediaIndex + 1} / ${media.length}` : '图文知识';
    refs.left.hidden = refs.right.hidden = media.length < 2;
    if (!item) {
      const empty = document.createElement('div'); empty.className = 'home-reel-empty';
      const title = document.createElement('strong'); title.textContent = node.name || node.label || '知识';
      const description = document.createElement('p'); description.textContent = node.description || node.desc_zh || '这条知识暂无图片或视频';
      empty.append(title, description); refs.stage.append(empty);
    } else {
      const element = document.createElement(item.kind === 'video' ? 'video' : 'img');
      element.src = item.url;
      if (item.kind === 'video') {
        element.muted = muted; element.defaultMuted = muted; element.autoplay = true; element.playsInline = true; element.loop = true; element.preload = 'metadata';
        element.addEventListener('playing', () => { if (element.parentNode === refs.stage && /点击.*播放|自动播放被浏览器|浏览器暂未允许/.test(refs.status.textContent)) message(''); });
        ['play', 'pause', 'timeupdate', 'loadedmetadata', 'volumechange'].forEach((event) => element.addEventListener(event, updateVideoControls));
      } else { element.alt = node.name || node.label || '知识图片'; element.draggable = false; }
      element.addEventListener('error', () => { if (element.parentNode === refs.stage) message('媒体加载失败，可左右切换媒体或上下翻页'); });
      refs.stage.append(element);
      if (item.kind === 'video') void playVideo(element, { deferBlocked: !!departing });
    }
    updateVideoControls();
  }
  function moveMedia(direction) {
    if (busy || overlayMode || media.length < 2) return;
    mediaIndex = (mediaIndex + direction + media.length) % media.length;
    renderMedia();
  }
  function counts(data) {
    liked = !!data.liked;
    refs.like.classList.toggle('is-active', liked);
    refs.like.setAttribute('aria-pressed', String(liked));
    refs.likeCount.textContent = String(data.likeCount || 0);
    refs.commentCount.textContent = String(data.commentCount || 0);
    refs.shareCount.textContent = String(data.shareCount || 0);
  }
  async function loadInteractions(token) {
    try {
      const data = await api(`/api/knowledge/${encodeURIComponent(idOf(node))}/comments`);
      if (token !== version || !dialog.open) return;
      comments = data.comments || []; counts(data);
      if (overlayMode === 'comments') renderOverlay();
    } catch (error) { if (token === version && dialog.open) message(error.message); }
  }
  function renderNode(data) {
    node = data; media = collectMedia(node); mediaIndex = 0; overlayMode = ''; refs.overlay.hidden = true;
    refs.title.textContent = node.name || node.label || idOf(node);
    refs.description.textContent = node.description || node.desc_zh || '';
    refs.identity.textContent = category + (node.creator_username ? ' · @' + node.creator_username : '');
    comments = []; counts({}); refs.commentInput.value = '';
    renderMedia();
    void loadInteractions(version);
    journey?.onNodeChange?.(idOf(node));
    portrait?.onNodeChange?.(node);
  }
  async function loadNode(id) {
    requestController?.abort(); requestController = new AbortController(); const token = ++version;
    busy = true; node = null; stopMedia(); refs.stage.replaceChildren(); message('正在加载知识…');
    try {
      const data = await api('/api/kb/node', { id });
      if (token !== version || !dialog.open || currentScope() !== scope) return;
      if (!data.node) throw Error('知识不存在或不可访问');
      renderNode(data.node);
    } catch (error) { if (token === version && error.name !== 'AbortError') message(error.message + '，可重新打开卡片重试'); }
    finally { if (token === version) busy = false; }
  }
  function clearTransition() {
    animations.forEach((animation) => animation.cancel()); animations = [];
    departing?.querySelectorAll('video').forEach((video) => { video.pause(); video.removeAttribute('src'); video.load(); });
    departing?.remove(); departing = null;
  }
  async function slideNode(data, direction, token) {
    clearTransition();
    const animate = refs.main.animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!animate) { renderNode(data); return; }
    const oldVideo = refs.stage.querySelector('video');
    oldVideo?.pause();
    departing = refs.main.cloneNode(true);
    departing.classList.add('home-reel-departing');
    departing.setAttribute('aria-hidden', 'true'); departing.inert = true;
    // Move the actual decoded media frame; cloning a video can flash or seek to a stale frame.
    departing.querySelector('[data-ref="stage"]').replaceChildren(...refs.stage.childNodes);
    refs.viewport.append(departing);
    renderNode(data);
    const options = { duration: 300, easing: 'cubic-bezier(.2,.65,.3,1)', fill: 'both' };
    animations = [
      departing.animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,' + (-direction * 100) + '%,0)' }], options),
      refs.main.animate([{ transform: 'translate3d(0,' + (direction * 100) + '%,0)' }, { transform: 'translate3d(0,0,0)' }], options),
    ];
    await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
    if (token === version) {
      clearTransition();
      const video = refs.stage.querySelector('video');
      if (video?.paused && video.dataset.playBlocked === 'true') void playVideo(video);
    }
  }
  async function randomPage(direction = 1) {
    if (busy || overlayMode || !node || !dialog.open) return;
    if (currentScope() !== scope) return close();
    if (journey) {
      const index = feed.findIndex(item => idOf(item) === idOf(node));
      const target = feed[index + direction];
      if (!target) {
        message(direction < 0 ? '已经到达起点站' : '已经到达终点站');
        if (direction > 0) journey.onFinish?.();
        return;
      }
      return goTo(idOf(target), direction);
    }
    let target;
    if (direction < 0) {
      if (!history.length) { message('已经是本次浏览的第一条知识'); return; }
      target = { id: history[history.length - 1] };
    } else {
      const others = feed.filter((item) => idOf(item) !== idOf(node));
      if (!others.length) { message('当前分类暂无其他知识'); return; }
      const unseen = others.filter((item) => !recent.includes(idOf(item)));
      const candidates = unseen.length ? unseen : others;
      target = candidates[Math.floor(Math.random() * candidates.length)];
    }
    busy = true; const token = ++version; message('');
    try {
      const data = await api('/api/kb/node', { id: idOf(target) });
      if (token !== version || !dialog.open) return;
      if (!data.node) throw Error('知识不存在或不可访问');
      if (direction < 0) history.pop(); else history.push(idOf(node));
      recent.push(idOf(node)); recent = recent.slice(-30);
      await slideNode(data.node, direction, token);
    } catch (error) { if (token === version && error.name !== 'AbortError') message(error.message); }
    finally { if (token === version) busy = false; }
  }
  async function goTo(id, direction = 1) {
    if (!journey || busy || overlayMode || !dialog.open || !feed.some(item => idOf(item) === id)) return;
    if (currentScope() !== scope) return close();
    if (idOf(node) === id) return;
    busy = true; const token = ++version; message('正在加载知识…');
    try {
      const data = await api('/api/kb/node', { id });
      if (token !== version || !dialog.open) return;
      if (!data.node) throw Error('知识不存在或不可访问');
      await slideNode(data.node, direction, token);
    } catch (error) { if (token === version && error.name !== 'AbortError') message(error.message); }
    finally { if (token === version) busy = false; }
  }
  function renderOverlay() {
    refs.overlay.hidden = !overlayMode;
    refs.overlayTitle.textContent = overlayMode === 'comments' ? '评论' : '知识信息';
    refs.commentForm.hidden = overlayMode !== 'comments';
    const pages = overlayMode === 'comments'
      ? (comments.length ? comments.flatMap((item) => textPages(`${item.username || '用户'}：${item.content}`, 260)) : ['暂无评论，来说两句吧。'])
      : textPages([node.name, node.description || node.desc_zh, node.wiki_md].filter(Boolean).join('\n\n'), 260);
    overlayPage = Math.max(0, Math.min(overlayPage, pages.length - 1));
    refs.overlayText.textContent = pages[overlayPage];
    refs.overlayCount.textContent = `${overlayPage + 1} / ${pages.length}`;
    refs.overlayPrev.disabled = overlayPage === 0; refs.overlayNext.disabled = overlayPage >= pages.length - 1;
  }
  async function action(kind) {
    if (busy || actionBusy || !node) return;
    if (kind === 'comment' || kind === 'info') { overlayMode = kind === 'comment' ? 'comments' : 'info'; overlayPage = 0; renderOverlay(); return; }
    const token = version; actionBusy = true;
    try {
      const data = await api(`/api/knowledge/${encodeURIComponent(idOf(node))}/${kind}`, {}, { method: kind === 'like' && liked ? 'DELETE' : 'POST' });
      if (token !== version || !dialog.open) return;
      counts(data);
      if (kind === 'share') {
        if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(data.shareUrl); message('分享链接已复制'); }
        else message(data.shareUrl || '已生成分享链接');
      }
    } catch (error) { if (token === version) message(error.message); }
    finally { actionBusy = false; }
  }
  function close() { if (document.fullscreenElement === dialog) void document.exitFullscreen().catch(() => {}); if (dialog?.open) dialog.close(); cleanup(); }
  function cleanup() {
    version++; requestController?.abort(); clearTransition(); stopMedia(); busy = false;
    if (oldOverflow !== undefined) { document.body.style.overflow = oldOverflow; oldOverflow = undefined; }
    if (focusBefore?.isConnected) focusBefore.focus({ preventScroll: true }); focusBefore = null;
    const endedJourney = journey; journey = null;
    dialog?.classList.toggle('is-knowledge-journey', false);
    endedJourney?.onClose?.();
    const endedPortrait = portrait; portrait = null;
    dialog?.classList.toggle('is-knowledge-portrait', false);
    endedPortrait?.onClose?.();
  }
  function create() {
    dialog = document.createElement('dialog'); dialog.id = 'homeMediaViewer'; dialog.setAttribute('aria-label', '知识媒体详情');
    dialog.innerHTML = `<div class="home-reel-viewport" data-ref="viewport"><div class="home-reel-main" data-ref="main">
      <div class="home-reel-stage" data-ref="stage"></div>
      <div class="home-reel-top"><span class="home-reel-brand">知识发现</span><div><button data-ref="fullscreen" aria-label="全屏">⛶</button><button data-ref="close" aria-label="关闭知识详情">×</button></div></div>
      <button class="home-reel-media-nav is-left" data-ref="left" aria-label="上一个媒体">‹</button><button class="home-reel-media-nav is-right" data-ref="right" aria-label="下一个媒体">›</button>
      <div class="home-reel-caption"><span data-ref="identity"></span><h2 data-ref="title"></h2><p data-ref="description"></p><button data-action="info" class="home-reel-more">查看完整信息</button></div>
      <div class="home-reel-bottom"><span data-ref="counter"></span><span>← → 切媒体 · ↑ 历史 · ↓ 随机</span></div>
      <button class="home-reel-center-play" data-ref="centerPlay" aria-label="播放视频" hidden>▶</button>
      <div class="home-reel-playback" data-ref="playback" hidden><button data-ref="play" aria-label="播放">▶</button><button data-ref="mute" aria-label="关闭声音">关闭声音</button><span data-ref="time" class="home-reel-time">0:00 / 0:00</span></div>
      <input data-ref="seek" class="home-reel-seek" type="range" min="0" max="100" step="0.1" value="0" aria-label="视频进度">
      <section class="home-reel-overlay" data-ref="overlay" hidden><header><strong data-ref="overlayTitle"></strong><button data-ref="overlayClose" aria-label="关闭信息">×</button></header><p data-ref="overlayText"></p><div class="home-reel-pages"><button data-ref="overlayPrev">上一页</button><span data-ref="overlayCount"></span><button data-ref="overlayNext">下一页</button></div><form data-ref="commentForm"><textarea data-ref="commentInput" maxlength="2000" rows="2" placeholder="写下评论…" aria-label="评论内容"></textarea><button type="submit">发送评论</button></form></section>
    </div></div><aside class="home-reel-rail"><button data-action="like" data-ref="like" aria-label="点赞"><i class="fa-regular fa-heart" aria-hidden="true"></i><b data-ref="likeCount">0</b></button><button data-action="comment" aria-label="评论"><i class="fa-regular fa-comment" aria-hidden="true"></i><b data-ref="commentCount">0</b></button><button data-action="share" aria-label="分享"><i class="fa-solid fa-share" aria-hidden="true"></i><b data-ref="shareCount">0</b></button><button data-ref="up" aria-label="返回上一条浏览历史"><i class="fa-solid fa-chevron-up" aria-hidden="true"></i><small>上一条历史</small></button><button data-ref="down" aria-label="向下随机翻页"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i><small>随机下一条</small></button></aside><div class="home-reel-status" data-ref="status" role="status" aria-live="polite"></div>`;
    refs = Object.fromEntries(Array.from(dialog.querySelectorAll('[data-ref]')).map((el) => [el.dataset.ref, el]));
    dialog.querySelectorAll('button').forEach((button) => { if (button.type !== 'submit' || !button.closest('form')) button.type = 'button'; });
    document.body.append(dialog);
    refs.close.onclick = close; dialog.addEventListener('close', () => { if (!dialog.open) cleanup(); });
    refs.left.onclick = () => moveMedia(-1); refs.right.onclick = () => moveMedia(1);
    refs.up.onclick = () => randomPage(-1); refs.down.onclick = () => randomPage(1);
    refs.play.onclick = refs.centerPlay.onclick = () => { message(''); const video = refs.stage.querySelector('video'); if (video) video.paused ? void playVideo(video) : video.pause(); };
    refs.mute.onclick = () => {
      const video = refs.stage.querySelector('video');
      muted = video ? !video.muted : !muted;
      if (video) {
        video.muted = muted;
        if (!muted) void playVideo(video);
      }
      updateVideoControls();
    };
    refs.seek.oninput = () => { const video = refs.stage.querySelector('video'); if (video && Number.isFinite(video.duration)) video.currentTime = Number(refs.seek.value) / 100 * video.duration; };
    refs.fullscreen.onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await dialog.requestFullscreen(); } catch { message('当前浏览器不支持全屏'); } };
    refs.overlayClose.onclick = () => { overlayMode = ''; renderOverlay(); };
    refs.overlayPrev.onclick = () => { overlayPage--; renderOverlay(); }; refs.overlayNext.onclick = () => { overlayPage++; renderOverlay(); };
    refs.commentForm.onsubmit = async (event) => {
      event.preventDefault(); const content = refs.commentInput.value.trim(); if (!content || actionBusy) return;
      const token = version; actionBusy = true;
      try { await api(`/api/knowledge/${encodeURIComponent(idOf(node))}/comments`, {}, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) }); if (token === version) { refs.commentInput.value = ''; await loadInteractions(token); message('评论已发送'); } }
      catch (error) { if (token === version) message(error.message); } finally { actionBusy = false; }
    };
    dialog.addEventListener('click', (event) => { const button = event.target.closest('[data-action]'); if (button) void action(button.dataset.action); });
    dialog.addEventListener('keydown', (event) => {
      if (event.target.closest('[data-portrait-content]')) return;
      if (event.target.closest('input,textarea,select') || event.altKey || event.ctrlKey || event.metaKey) return;
      if (overlayMode) { if (event.key === 'Escape') { event.preventDefault(); overlayMode = ''; renderOverlay(); } return; }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault(); if (event.repeat) return;
        if (event.key === 'ArrowLeft') moveMedia(-1); else if (event.key === 'ArrowRight') moveMedia(1); else void randomPage(event.key === 'ArrowUp' ? -1 : 1);
      }
    });
    dialog.addEventListener('wheel', (event) => {
      if (event.target.closest('[data-journey-sidebar],[data-portrait-content]')) return;
      event.preventDefault(); if (overlayMode || busy || Date.now() - wheelAt < 800) return;
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const delta = horizontal ? event.deltaX : event.deltaY;
      wheelSum += delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      if (Math.abs(wheelSum) < 55) return;
      const direction = Math.sign(wheelSum); wheelSum = 0; wheelAt = Date.now();
      if (horizontal) moveMedia(direction); else void randomPage(direction);
    }, { passive: false });
    dialog.addEventListener('pointerdown', (event) => { if (!event.target.closest('button,input,textarea,.home-reel-overlay,[data-journey-sidebar],[data-portrait-content]')) touchStart = { x: event.clientX, y: event.clientY }; });
    dialog.addEventListener('pointerup', (event) => { if (!touchStart) return; const dx = event.clientX - touchStart.x, dy = event.clientY - touchStart.y; touchStart = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 50) return; if (Math.abs(dx) > Math.abs(dy)) moveMedia(dx < 0 ? 1 : -1); else void randomPage(dy < 0 ? 1 : -1); });
    dialog.addEventListener('pointercancel', () => { touchStart = null; });
    window.addEventListener('hashchange', close); window.addEventListener('popstate', close);
  }
  function open(id, options = {}) {
    clearTransition();
    feed = Array.from(new Map((options.nodes || []).filter((item) => idOf(item)).map((item) => [idOf(item), item])).values());
    category = options.category || '当前分类';
    if (!dialog) create();
    journey = options.journey || null;
    portrait?.onClose?.();
    portrait = options.portrait || null;
    dialog.classList.toggle('is-knowledge-portrait', !!portrait);
    if (portrait?.element) dialog.append(portrait.element);
    dialog.classList.toggle('is-knowledge-journey', !!journey);
    if (journey?.sidebar) dialog.append(journey.sidebar);
    refs.up.setAttribute('aria-label', journey ? '上一站' : '返回上一条浏览历史');
    refs.down.setAttribute('aria-label', journey ? '下一站，终点继续滑动完成旅程' : '向下随机翻页');
    const upLabel = refs.up.querySelector('small'), downLabel = refs.down.querySelector('small');
    if (upLabel) upLabel.textContent = journey ? '上一站' : '上一条历史';
    if (downLabel) downLabel.textContent = journey ? '下一站' : '随机下一条';
    const hint = dialog.querySelector('.home-reel-bottom > span:last-child');
    if (hint) hint.textContent = journey ? '← → 切媒体 · ↑ ↓ 沿线路漫游' : '← → 切媒体 · ↑ 历史 · ↓ 随机';
    if (!dialog.open) { focusBefore = document.activeElement; oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; dialog.showModal(); }
    muted = false;
    scope = currentScope(); recent = []; history = []; overlayMode = ''; refs.overlay.hidden = true; wheelAt = Date.now(); wheelSum = 0;
    void loadNode(id);
  }
  // Restore only an actively open standard detail panel after a browser reload.
  let reloadDetail = null;
  try {
    if (window.performance?.getEntriesByType('navigation')[0]?.type === 'reload') reloadDetail = JSON.parse(sessionStorage.getItem('kb-home-detail-reload') || 'null');
    sessionStorage.removeItem('kb-home-detail-reload');
  } catch {}
  window.addEventListener('pagehide', () => {
    try {
      if (dialog?.open && node && !journey && !portrait) sessionStorage.setItem('kb-home-detail-reload', JSON.stringify({ id: idOf(node), scope, category, nodes: feed.map((item) => ({id:idOf(item)})) }));
      else sessionStorage.removeItem('kb-home-detail-reload');
    } catch {}
  });
  window.addEventListener('load', () => {
    if (reloadDetail && reloadDetail.scope === currentScope()) open(reloadDetail.id, {nodes:reloadDetail.nodes || [],category:reloadDetail.category});
    reloadDetail = null;
  }, {once:true});
  window.homeKnowledgeMediaViewer = { open, close, goTo, collectMedia, textPages };
})();
