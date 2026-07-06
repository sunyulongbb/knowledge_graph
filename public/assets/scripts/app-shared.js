(function () {
  const root = window;
  const app = (root.kbApp = root.kbApp || {});
  const store = (app.store = app.store || Object.create(null));

  function cloneDefault(value) {
    if (typeof value === "function") return value();
    if (Array.isArray(value)) return value.slice();
    if (value && typeof value === "object") {
      if (value instanceof Set) return new Set(value);
      if (value instanceof Map) return new Map(value);
      return { ...value };
    }
    return value;
  }

  function ensure(key, defaultValue) {
    if (!(key in store)) {
      store[key] = cloneDefault(defaultValue);
    }
    return store[key];
  }

  function get(key, fallback) {
    return key in store ? store[key] : fallback;
  }

  function set(key, value) {
    store[key] = value;
    return value;
  }

  function patch(values) {
    if (!values || typeof values !== "object") return store;
    Object.keys(values).forEach((key) => {
      store[key] = values[key];
    });
    return store;
  }

  function bindAlias(alias, key, defaultValue) {
    ensure(key, defaultValue);
    const desc = Object.getOwnPropertyDescriptor(root, alias);
    if (desc && !desc.configurable) return;

    Object.defineProperty(root, alias, {
      configurable: true,
      enumerable: true,
      get() {
        return store[key];
      },
      set(value) {
        store[key] = value;
      },
    });
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function qs(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function qsa(selector, scope) {
    return Array.from((scope || document).querySelectorAll(selector));
  }

  app.state = {
    ensure,
    get,
    set,
    patch,
    bindAlias,
  };

  app.dom = {
    byId,
    qs,
    qsa,
  };

  const kbVidstackTags = [
    "media-player",
    "media-provider",
    "media-poster",
    "media-video-layout",
  ];
  let kbVidstackReadyPromise = null;

  function setBooleanAttr(target, name, enabled) {
    if (!target) return;
    if (enabled) target.setAttribute(name, "");
    else target.removeAttribute(name);
  }

  function ensureVidstackReady() {
    if (root.kbVidstackElementsReady) return root.kbVidstackElementsReady;
    if (kbVidstackReadyPromise) return kbVidstackReadyPromise;
    if (
      !root.customElements ||
      typeof root.customElements.whenDefined !== "function"
    ) {
      kbVidstackReadyPromise = Promise.resolve(false);
      return kbVidstackReadyPromise;
    }
    kbVidstackReadyPromise = Promise.all(
      kbVidstackTags.map((tagName) => root.customElements.whenDefined(tagName)),
    )
      .then(() => true)
      .catch(() => false);
    return kbVidstackReadyPromise;
  }

  function destroyVideoPlayer(target) {
    if (!target) return null;
    try {
      if (typeof target.pause === "function") {
        target.pause();
      }
    } catch {}
    return null;
  }

  function createVideoPlayer(options) {
    const settings = options && typeof options === "object" ? options : {};
    if (
      !root.customElements ||
      !root.customElements.get("media-player") ||
      !root.customElements.get("media-provider") ||
      !root.customElements.get("media-video-layout")
    ) {
      const nativeVideo = document.createElement("video");
      nativeVideo.className = settings.className || "kb-video-player";
      nativeVideo.controls = settings.controls !== false;
      nativeVideo.preload = settings.preload || "metadata";
      nativeVideo.playsInline = settings.playsInline !== false;
      nativeVideo.autoplay = settings.autoplay === true;
      nativeVideo.muted = settings.muted === true;
      nativeVideo.loop = settings.loop === true;
      nativeVideo.crossOrigin = settings.crossOrigin || null;
      if (settings.poster) nativeVideo.poster = settings.poster;
      if (settings.title) nativeVideo.title = settings.title;
      if (settings.src) nativeVideo.src = settings.src;
      if (settings.attributes && typeof settings.attributes === "object") {
        Object.keys(settings.attributes).forEach((name) => {
          const value = settings.attributes[name];
          if (value === false || value == null) return;
          if (value === true) nativeVideo.setAttribute(name, "");
          else nativeVideo.setAttribute(name, String(value));
        });
      }
      if (settings.style && typeof settings.style === "object") {
        Object.assign(nativeVideo.style, settings.style);
      }
      return nativeVideo;
    }
    const playerEl = document.createElement("media-player");
    playerEl.className = settings.className || "kb-video-player";
    playerEl.setAttribute("load", settings.load || "eager");
    playerEl.setAttribute("view-type", settings.viewType || "video");
    playerEl.setAttribute("stream-type", settings.streamType || "on-demand");
    playerEl.setAttribute("aspect-ratio", settings.aspectRatio || "16/9");
    playerEl.setAttribute("log-level", settings.logLevel || "warn");
    playerEl.setAttribute("preload", settings.preload || "metadata");
    if (settings.crossOrigin) {
      playerEl.setAttribute(
        "crossorigin",
        settings.crossOrigin === true ? "" : String(settings.crossOrigin),
      );
    }
    if (settings.poster) playerEl.setAttribute("poster", settings.poster);
    if (settings.title) playerEl.setAttribute("title", settings.title);
    if (settings.src) {
      playerEl.setAttribute("src", settings.src);
      if (settings.type) playerEl.setAttribute("type", settings.type);
    }
    setBooleanAttr(playerEl, "playsinline", settings.playsInline !== false);
    setBooleanAttr(playerEl, "autoplay", settings.autoplay === true);
    setBooleanAttr(playerEl, "muted", settings.muted === true);
    setBooleanAttr(playerEl, "loop", settings.loop === true);
    if (settings.attributes && typeof settings.attributes === "object") {
      Object.keys(settings.attributes).forEach((name) => {
        const value = settings.attributes[name];
        if (value === false || value == null) return;
        if (value === true) playerEl.setAttribute(name, "");
        else playerEl.setAttribute(name, String(value));
      });
    }
    if (settings.style && typeof settings.style === "object") {
      Object.assign(playerEl.style, settings.style);
    }

    const providerEl = document.createElement("media-provider");
    if (settings.poster) {
      const posterEl = document.createElement("media-poster");
      posterEl.className = "vds-poster";
      providerEl.appendChild(posterEl);
    }

    const videoLayoutEl = document.createElement("media-video-layout");
    if (settings.thumbnails) {
      videoLayoutEl.setAttribute("thumbnails", String(settings.thumbnails));
    }
    if (settings.layoutMenuGroup) {
      videoLayoutEl.setAttribute("menu-group", String(settings.layoutMenuGroup));
    }
    if (settings.noGestures) {
      setBooleanAttr(videoLayoutEl, "no-gestures", true);
    }

    playerEl.appendChild(providerEl);
    playerEl.appendChild(videoLayoutEl);
    return playerEl;
  }

  root.kbEnsureVidstackReady = ensureVidstackReady;
  root.kbCreateVideoPlayer = createVideoPlayer;
  root.kbDestroyVideoPlayer = destroyVideoPlayer;

  bindAlias("kbSelectedRowId", "selectedRowId", "");
  bindAlias("kbSelectedRowIds", "selectedRowIds", () => new Set());
  bindAlias("kbLastAnchorRowId", "lastAnchorRowId", "");
  bindAlias("kbSelectionHydrated", "selectionHydrated", false);
  bindAlias("kbSelectedAttrIds", "selectedAttrIds", () => new Set());
  bindAlias("kbLastAttrAnchorId", "lastAttrAnchorId", "");
  bindAlias("kbAttrCache", "attrCache", () => new Map());
  bindAlias("kbPropertySuggestionCache", "propertySuggestionCache", () => new Map());
  bindAlias("kbSelectedClassId", "selectedClassId", null);
  bindAlias("kbClasses", "classes", () => []);
  bindAlias("kbEntityClasses", "entityClasses", () => []);
  bindAlias("kbSchemaByClassId", "schemaByClassId", () => Object.create(null));
  bindAlias("kbSelectedSchemaPropId", "selectedSchemaPropId", "");
  bindAlias("kbSelectedSchemaPropLabel", "selectedSchemaPropLabel", "");
  bindAlias("kbSchemaRemovalSelection", "schemaRemovalSelection", () => new Set());
  bindAlias("kbSchemaRemovalLastIndex", "schemaRemovalLastIndex", -1);
  bindAlias("kbCollapsedClassIds", "collapsedClassIds", () => new Set());
  bindAlias("kbClassTreeInitiallyCollapsed", "classTreeInitiallyCollapsed", true);
  bindAlias("kbClassMeta", "classMeta", null);
  bindAlias("kbClassDragSourceId", "classDragSourceId", null);
  bindAlias("kbPropertyRecommendationsCache", "propertyRecommendationsCache", () => new Map());
  bindAlias("kbPickMode", "pickMode", null);
  bindAlias("kbActiveDetailNodeId", "activeDetailNodeId", "");
  bindAlias("kbActiveDetailRouteId", "activeDetailRouteId", "");
  bindAlias("kbActiveVisNodeId", "activeVisNodeId", "");
  bindAlias("kbTableNodes", "tableNodes", () => []);
  bindAlias("propertySelectedIds", "propertySelectedIds", () => new Set());
})();
