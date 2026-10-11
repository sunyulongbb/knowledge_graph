(function () {
  // Pointer Events cover mouse, touch and pen with the same gesture lifecycle.
  window.installGraphConnect = function (cy, container, createRelation) {
    const hint = document.createElement('div');
    hint.className = 'graph-connect-hint';
    hint.setAttribute('role', 'status');
    hint.textContent = '长按任意节点，拖到目标节点连线';
    const line = document.createElement('div');
    line.className = 'graph-connect-preview';
    line.hidden = true;
    container.append(hint, line);
    let gesture = null, timer = null, target = null;
    let suppressUntil = 0;
    let lastTap = null;
    const stop = e => { e.preventDefault(); e.stopImmediatePropagation(); };
    const point = e => {
      const rect = container.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    function hit(p, exclude, padding = 0) {
      let best = null, distance = Infinity;
      cy.nodes().forEach(node => {
        if (node.id() === exclude || !node.visible() || node.hasClass('eh-handle')) return;
        const pos = node.renderedPosition();
        const dx = p.x - pos.x, dy = p.y - pos.y;
        if (Math.abs(dx) <= node.renderedWidth() / 2 + padding && Math.abs(dy) <= node.renderedHeight() / 2 + padding) {
          const d = dx * dx + dy * dy;
          if (d < distance) { best = node; distance = d; }
        }
      });
      return best;
    }
    function updateLine() {
      if (!gesture || gesture.mode !== 'connect') return;
      const start = gesture.node.renderedPosition(), end = gesture.end;
      const dx = end.x - start.x, dy = end.y - start.y;
      line.style.left = `${start.x}px`;
      line.style.top = `${start.y}px`;
      line.style.width = `${Math.hypot(dx, dy)}px`;
      line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      const next = hit(end, gesture.node.id(), gesture.pointerType === 'mouse' ? 8 : 22);
      if (target) target.removeClass('edge-drop-target');
      target = next;
      if (target) target.addClass('edge-drop-target');
      line.classList.toggle('is-valid', Boolean(target));
      hint.textContent = target ? `松开连接到「${target.data('label') || target.id()}」` : '拖到目标节点后松开 · Esc 取消';
    }
    function clear() {
      clearTimeout(timer); timer = null;
      const previous = gesture;
      gesture = null;
      if (target) target.removeClass('edge-drop-target');
      target = null;
      line.hidden = true;
      hint.textContent = '长按任意节点，拖到目标节点连线';
      if (previous) {
        suppressUntil = Date.now() + 450;
        if (container.hasPointerCapture(previous.pointerId)) container.releasePointerCapture(previous.pointerId);
      }
      return previous;
    }
    function down(e) {
      if (gesture) { cancel(); stop(e); return; } // A second finger cancels the single-pointer gesture.
      if (e.button !== 0 || e.isPrimary === false) return;
      const start = point(e), node = hit(start);
      if (!node) return; // Canvas gestures remain native.
      stop(e);
      gesture = { node, start, end: start, pointerId: e.pointerId, pointerType: e.pointerType, mode: 'hold', origins: [] };
      const movingNodes = node.selected() ? cy.nodes(':selected') : [node];
      movingNodes.forEach(n => { if (!n.locked()) gesture.origins.push({ node: n, position: { ...n.position() } }); });
      container.setPointerCapture(e.pointerId);
      timer = setTimeout(() => {
        if (!gesture || gesture.mode !== 'hold') return;
        gesture.mode = 'connect';
        line.hidden = false;
        node.addClass('graph-connect-source');
        updateLine();
      }, 450);
    }
    function move(e) {
      if (!gesture || gesture.pointerId !== e.pointerId) return;
      stop(e);
      gesture.end = point(e);
      const dx = gesture.end.x - gesture.start.x, dy = gesture.end.y - gesture.start.y;
      if (gesture.mode === 'hold' && Math.hypot(dx, dy) > 8) {
        clearTimeout(timer);
        gesture.mode = 'move';
      }
      if (gesture.mode === 'move') {
        const zoom = cy.zoom();
        cy.batch(() => gesture.origins.forEach(item => item.node.position({ x: item.position.x + dx / zoom, y: item.position.y + dy / zoom })));
      } else updateLine();
    }
    function up(e) {
      if (!gesture || gesture.pointerId !== e.pointerId) return;
      stop(e);
      gesture.end = point(e);
      updateLine();
      const destination = target;
      const previous = clear();
      previous.node.removeClass('graph-connect-source');
      if (previous.mode === 'connect' && destination && !destination.removed() && !previous.node.removed()) {
        createRelation(previous.node.id(), destination.id(), null);
      } else if (previous.mode === 'move') {
        previous.node.emit('free');
        previous.node.emit('dragfree');
      }
      if (previous.mode === 'hold') {
        const now = Date.now();
        if (lastTap?.id === previous.node.id() && now - lastTap.at < 300) {
          lastTap = null;
          previous.node.emit('dbltap');
        } else {
          lastTap = { id: previous.node.id(), at: now };
          if (!previous.node.selected()) previous.node.emit('tap');
          else window.kbGraphDetails?.open(previous.node.id());
        }
      } else lastTap = null;
    }
    function cancel() {
      const previous = clear();
      if (previous) {
        previous.node.removeClass('graph-connect-source');
        if (previous.mode === 'move') previous.node.emit('free');
      }
    }
    function legacy(e) { if (gesture || Date.now() < suppressUntil) stop(e); }
    function key(e) { if (e.key === 'Escape' && gesture) { cancel(); e.preventDefault(); } }
    const bindings = [ ['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', cancel], ['lostpointercapture', cancel],
      ...['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'contextmenu', 'click'].map(name => [name, legacy]) ];
    bindings.forEach(([name, fn]) => container.addEventListener(name, fn, { capture: true, passive: false }));
    document.addEventListener('keydown', key);
    window.addEventListener('blur', cancel);
    cy.on('pan zoom resize', updateLine);
    cy.on('remove', 'node', e => { if (gesture && e.target.id() === gesture.node.id()) cancel(); });
    cy.on('destroy', () => {
      cancel();
      bindings.forEach(([name, fn]) => container.removeEventListener(name, fn, true));
      document.removeEventListener('keydown', key);
      window.removeEventListener('blur', cancel);
      hint.remove(); line.remove();
    });
    return { isActive: () => Boolean(gesture), cancel };
  };
})();
