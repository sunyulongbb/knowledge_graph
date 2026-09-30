(function () {
  window.bindBannerUpload = function (input, preview) {
    const zone = document.createElement('div');
    zone.className = 'banner-upload-zone'; zone.tabIndex = 0;
    zone.setAttribute('aria-label', 'Banner 背景图片，点击此处后粘贴图片');
    zone.innerHTML = '<span>点击此处后粘贴图片（Ctrl / ⌘ + V）</span><div><label class="btn">选择图片<input type="file" accept="image/*" hidden></label> <button type="button" class="btn" data-clear>移除背景</button></div><small role="status"></small>';
    input.after(zone);
    const fileInput = zone.querySelector('input'), status = zone.querySelector('[role=status]');
    let version = 0, controller;
    const render = () => { const url = input.value.trim(); const valid = /^(https?:\/\/|\/(?!\/))/i.test(url); preview.hidden = !valid; if (valid) preview.src = url; else preview.removeAttribute('src'); };
    const buttons = () => Array.from(input.form?.querySelectorAll('[type=submit]') || []);
    const finish = () => { input.dataset.uploading = ''; buttons().forEach((button) => { button.disabled = false; }); };
    const reset = () => { version++; controller?.abort(); finish(); status.textContent = ''; fileInput.value = ''; render(); };
    async function upload(file) {
      if (!file) return;
      if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) { status.textContent = '请选择不超过 20MB 的图片'; return; }
      controller?.abort(); controller = new AbortController(); const token = ++version;
      input.dataset.uploading = 'true'; buttons().forEach((button) => { button.disabled = true; }); status.textContent = '图片上传中…';
      try {
        const form = new FormData(); form.append('file', file);
        const url = new URL('/api/kb/upload-image', location.origin);
        url.searchParams.set('db', new URLSearchParams(location.search).get('db') || 'default');
        const response = await fetch(url, { method: 'POST', body: form, signal: controller.signal });
        if (!response.ok) throw Error('图片上传失败，请重试');
        const data = await response.json(); if (!data.url) throw Error('上传未返回图片地址');
        if (token !== version) return;
        input.value = data.url; render(); input.dispatchEvent(new Event('input', { bubbles: true })); status.textContent = '已上传，点击保存后生效';
      } catch (error) { if (token === version && error.name !== 'AbortError') status.textContent = error.message; }
      finally { if (token === version) finish(); }
    }
    zone.addEventListener('paste', (event) => {
      const file = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith('image/'))?.getAsFile();
      if (!file) return; event.preventDefault(); event.stopPropagation(); void upload(file);
    });
    fileInput.onchange = () => void upload(fileInput.files?.[0]);
    zone.querySelector('[data-clear]').onclick = () => { reset(); input.value = ''; render(); input.dispatchEvent(new Event('input', { bubbles: true })); };
    input.addEventListener('input', render); preview.onerror = () => { preview.hidden = true; };
    return { reset };
  };
})();
