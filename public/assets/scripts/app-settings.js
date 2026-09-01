// 应用设置面板：读取当前项目信息并保存到项目表
(function () {
  const DEFAULT_THEME_COLOR = '#4f46e5';

  function normalizeThemeColor(value, fallback = DEFAULT_THEME_COLOR) {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
  }

  function applyAppThemeColor(color) {
    const normalized = normalizeThemeColor(color);
    document.documentElement.style.setProperty('--accent', normalized);
    document.documentElement.dataset.appThemeColor = normalized;
    window.dispatchEvent(new CustomEvent('kb-app-theme-change', { detail: { color: normalized } }));
    return normalized;
  }

  function restoreSavedThemeColor(modal) {
    applyAppThemeColor(modal?.dataset.initialThemeColor || DEFAULT_THEME_COLOR);
  }

  function getUrlParam(name) {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get(name);
    } catch (e) {
      return null;
    }
  }

  function getCurrentDbSlug() {
    return (getUrlParam('db') || '').trim();
  }

  async function fetchCurrentProjectInfo() {
    const currentDb = getCurrentDbSlug();
    if (!currentDb) return null;
    try {
      const resp = await fetch('/api/kb/list_projects');
      if (!resp.ok) return null;
      const data = await resp.json();
      const projects = Array.isArray(data.projects) ? data.projects : [];
      return projects.find((project) => project.slug === currentDb || project.name === currentDb) || null;
    } catch (e) {
      return null;
    }
  }

  function createModal() {
    const modal = document.createElement('div');
    modal.id = 'appSettingsModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>应用设置</h2>
        <form id="appSettingsForm">
          <div class="form-group">
            <label for="appName">应用名称</label>
            <input type="text" id="appName" name="appName" maxlength="64" required />
          </div>
          <div class="form-group">
            <label for="appDesc">应用描述</label>
            <textarea id="appDesc" name="appDesc" maxlength="200"></textarea>
          </div>
          <div class="form-group" style="display:flex;flex-direction:column;gap:6px;">
            <label for="appThemeColor">应用主题色</label>
            <div style="display:flex;align-items:center;gap:10px;">
              <input type="color" id="appThemeColor" name="appThemeColor" value="#4f46e5" style="width:42px;height:32px;padding:2px;cursor:pointer;" />
              <output id="appThemeColorValue" style="font:500 13px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;color:var(--muted, #64748b);">#4F46E5</output>
            </div>
          </div>
          <div class="form-group" style="display:flex;flex-direction:column;gap:4px;">
            <label for="appLink" style="font-weight:500;">外部链接</label>
            <input type="url" id="appLink" name="appLink" maxlength="300" placeholder="https://example.com"
              style="padding:7px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:15px;outline:none;transition:border-color .2s;width:100%;box-sizing:border-box;"
              onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#d1d5db'"
            />
            <small style="color:#888;font-size:12px;">请填写以 http(s) 开头的完整链接</small>
          </div>
          <div class="form-group">
            <label for="appLogo">Logo 上传</label>
            <input type="file" id="appLogo" name="appLogo" accept="image/*" />
            <div id="appLogoPreview" class="logo-preview"></div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn primary">保存</button>
            <button type="button" class="btn" id="closeAppSettingsModal">取消</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    const closeBtn = modal.querySelector('#closeAppSettingsModal');
    if (closeBtn) closeBtn.onclick = () => {
      restoreSavedThemeColor(modal);
      modal.style.display = 'none';
    };
    const themeColorInput = modal.querySelector('#appThemeColor');
    const themeColorValue = modal.querySelector('#appThemeColorValue');
    if (themeColorInput) {
      themeColorInput.oninput = () => {
        const color = applyAppThemeColor(themeColorInput.value);
        if (themeColorValue) themeColorValue.textContent = color.toUpperCase();
      };
    }
    const logoInput = modal.querySelector('#appLogo');
    const preview = modal.querySelector('#appLogoPreview');
    if (logoInput && preview) {
      logoInput.onchange = (e) => {
        const file = e.target.files ? e.target.files[0] : null;
        preview.innerHTML = '';
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            preview.innerHTML = `<img src="${ev.target.result}" />`;
          };
          reader.readAsDataURL(file);
        }
      };
    }
    // Add paste event to the entire modal for logo upload
    modal.addEventListener('paste', function(e) {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (logoInput) {
            const dt = new DataTransfer();
            dt.items.add(file);
            logoInput.files = dt.files;
            logoInput.dispatchEvent(new Event('change'));
          }
          e.preventDefault(); // Prevent default paste behavior
          break;
        }
      }
    });
    const form = modal.querySelector('#appSettingsForm');
    if (form) {
      form.onsubmit = async function (e) {
        e.preventDefault();
        if (await submitSettings()) modal.style.display = 'none';
      };
    }
    return modal;
  }

  async function submitSettings() {
    const currentDb = getCurrentDbSlug();
    if (!currentDb) {
      alert('当前未选择应用，请先在页面顶部选择一个应用。');
      return false;
    }
    const nameInput = document.getElementById('appName');
    const descInput = document.getElementById('appDesc');
    const logoInput = document.getElementById('appLogo');
    const linkInput = document.getElementById('appLink');
    const themeColorInput = document.getElementById('appThemeColor');
    if (!nameInput || !descInput || !logoInput || !linkInput || !themeColorInput) return false;
    const name = nameInput.value.trim();
    const desc = descInput.value.trim();
    const link = linkInput.value.trim();
    const themeColor = normalizeThemeColor(themeColorInput.value);
    let image = '';
    const currentProject = await fetchCurrentProjectInfo();
    if (logoInput.files && logoInput.files[0]) {
      image = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.readAsDataURL(logoInput.files[0]);
      });
    } else {
      image = currentProject?.image || '';
    }
    try {
      const resp = await fetch('/api/kb/update_project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: currentDb,
          title: name,
          description: desc,
          image,
          link,
          theme_color: themeColor,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        alert(data.message || '保存失败，请稍后重试。');
        return false;
      }
      const project = data.project || {};
      if (window.updateHeaderProjectInfo) {
        window.updateHeaderProjectInfo(
          currentDb,
          project.title || name,
          project.image || image,
          project.description || desc,
        );
      }
      if (window.updateProjectEntryInUI) {
        window.updateProjectEntryInUI(currentDb, project.title || name, project.description || desc, project.image || image, project.link || link);
      }
      const savedThemeColor = applyAppThemeColor(project.theme_color || themeColor);
      const modal = document.getElementById('appSettingsModal');
      if (modal) modal.dataset.initialThemeColor = savedThemeColor;
      return true;
    } catch (err) {
      console.error(err);
      alert('保存失败，请检查网络或服务器状态。');
    }
  }

  async function openAppSettingsModal() {
    const currentDb = getCurrentDbSlug();
    if (!currentDb) {
      alert('当前未选择应用，请先在页面顶部选择一个应用。');
      return;
    }
    let modal = document.getElementById('appSettingsModal');
    if (!modal) modal = createModal();
    const project = await fetchCurrentProjectInfo();
    const nameInput = document.getElementById('appName');
    const descInput = document.getElementById('appDesc');
    const linkInput = document.getElementById('appLink');
    const themeColorInput = document.getElementById('appThemeColor');
    const themeColorValue = document.getElementById('appThemeColorValue');
    const preview = document.getElementById('appLogoPreview');
    if (nameInput) {
      nameInput.value = project?.title || currentDb;
    }
    if (descInput) {
      descInput.value = project?.description || '';
    }
    if (linkInput) {
      linkInput.value = project?.link || '';
    }
    const themeColor = applyAppThemeColor(project?.theme_color || DEFAULT_THEME_COLOR);
    if (themeColorInput) themeColorInput.value = themeColor;
    if (themeColorValue) themeColorValue.textContent = themeColor.toUpperCase();
    modal.dataset.initialThemeColor = themeColor;
    if (preview) {
      preview.innerHTML = project?.image
        ? `<img src="${project.image}" />`
        : '';
    }
    modal.style.display = 'flex';
  }

  window.openAppSettingsModal = openAppSettingsModal;
  window.applyAppThemeColor = applyAppThemeColor;

  function initCurrentProjectTheme() {
    fetchCurrentProjectInfo().then((project) => {
      applyAppThemeColor(project?.theme_color || DEFAULT_THEME_COLOR);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCurrentProjectTheme, { once: true });
  } else {
    initCurrentProjectTheme();
  }
})();
