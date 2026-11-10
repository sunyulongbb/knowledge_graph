(function () {
  function masonryPositions(heights, width, gap = 16, minWidth = 260) {
    const columns = Math.max(1, Math.min(4, Math.floor((width + gap) / (minWidth + gap))));
    const cardWidth = Math.max(0, (width - gap * (columns - 1)) / columns);
    const bottoms = Array(columns).fill(0);
    const positions = heights.map(height => {
      const column = bottoms.indexOf(Math.min(...bottoms));
      const position = { x: column * (cardWidth + gap), y: bottoms[column], width: cardWidth };
      bottoms[column] += height + gap;
      return position;
    });
    return { positions, width: cardWidth, height: Math.max(0, ...bottoms) - (heights.length ? gap : 0) };
  }
  let current = null;
  window.homeWaterfall = {
    mount({ container, root, sentinel, onMore }) {
      this.destroy();
      if (!container || !root || !sentinel) return;
      let frame = 0, stopped = false;
      const check = () => {
        if (stopped || !root.getClientRects().length || window.kbViewMode !== 'app_home') return;
        if (sentinel.getBoundingClientRect().top < root.getBoundingClientRect().bottom + 500) onMore();
      };
      const layout = () => {
        frame = 0;
        if (stopped || !container.clientWidth) return;
        const cards = Array.from(container.children);
        const width = masonryPositions([], container.clientWidth).width;
        cards.forEach(card => { card.style.width = `${width}px`; });
        const result = masonryPositions(cards.map(card => card.offsetHeight), container.clientWidth);
        cards.forEach((card, index) => { card.style.transform = `translate(${result.positions[index].x}px, ${result.positions[index].y}px)`; });
        container.style.height = `${result.height}px`;
        container.classList.add('is-masonry-ready');
        check();
      };
      const schedule = () => { if (!frame && !stopped) frame = requestAnimationFrame(layout); };
      const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
      const observe = () => { resize?.observe(container); Array.from(container.children).forEach(card => resize?.observe(card)); schedule(); };
      const intersection = typeof IntersectionObserver === 'function' ? new IntersectionObserver(check, { root, rootMargin: '500px 0px' }) : null;
      intersection?.observe(sentinel);
      container.addEventListener('load', schedule, true);
      container.addEventListener('loadedmetadata', schedule, true);
      root.addEventListener('scroll', check, { passive: true });
      window.addEventListener('resize', schedule);
      current = {
        append(html) { container.insertAdjacentHTML('beforeend', html); observe(); },
        update: schedule,
        destroy() {
          stopped = true; cancelAnimationFrame(frame); resize?.disconnect(); intersection?.disconnect();
          container.removeEventListener('load', schedule, true); container.removeEventListener('loadedmetadata', schedule, true);
          root.removeEventListener('scroll', check); window.removeEventListener('resize', schedule);
        },
      };
      observe();
    },
    append(html) { current?.append(html); },
    update() { current?.update(); },
    destroy() { current?.destroy(); current = null; },
  };
})();
