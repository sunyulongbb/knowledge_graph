(function () {
  function newsTimelinePositions(heights, gap = 12, stagger = 24) {
    const bottoms = [0, 0];
    let previousTop = -stagger;
    const positions = heights.map((height, index) => {
      const lane = index % 2, top = Math.max(bottoms[lane], previousTop + stagger);
      bottoms[lane] = top + height + gap; previousTop = top;
      return { lane, top };
    });
    return { positions, height: heights.length ? Math.max(...bottoms) - gap : 0 };
  }
  let active = null;
  window.newsTimelineLayout = {
    mount(root) {
      this.destroy();
      if (!root) return;
      let frame = 0, stopped = false;
      const lists = Array.from(root.querySelectorAll('.home-news-day > ol'));
      const clear = list => {
        list.classList.remove('is-compact-timeline'); list.style.height = '';
        Array.from(list.children).forEach(item => { item.style.width = ''; item.style.transform = ''; });
      };
      const layout = () => {
        frame = 0;
        if (stopped) return;
        const desktop = window.matchMedia('(min-width: 701px)').matches;
        lists.forEach(list => {
          if (!desktop) { clear(list); return; }
          if (!list.clientWidth) return;
          list.classList.add('is-compact-timeline');
          const width = Math.max(0, (list.clientWidth - 64) / 2), items = Array.from(list.children);
          items.forEach(item => { item.style.width = `${width}px`; });
          const result = newsTimelinePositions(items.map(item => item.offsetHeight));
          items.forEach((item, index) => {
            const position = result.positions[index];
            item.style.transform = `translate(${position.lane * (width + 64)}px, ${position.top}px)`;
          });
          list.style.height = `${result.height}px`;
        });
      };
      const schedule = () => { if (!frame && !stopped) frame = requestAnimationFrame(layout); };
      const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
      lists.forEach(list => { resize?.observe(list); Array.from(list.children).forEach(item => resize?.observe(item)); });
      root.addEventListener('load', schedule, true); window.addEventListener('resize', schedule);
      active = () => {
        stopped = true; cancelAnimationFrame(frame); resize?.disconnect();
        root.removeEventListener('load', schedule, true); window.removeEventListener('resize', schedule);
        lists.forEach(clear);
      };
      schedule();
    },
    destroy() { active?.(); active = null; },
  };
})();
