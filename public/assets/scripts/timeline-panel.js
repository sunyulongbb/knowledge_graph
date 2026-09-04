(function () {
  let timeline = null;
  let items = null;
  let groups = null;
  let currentNodes = [];
  let initialized = false;

  const DATE_KEY_RE =
    /(date|time|year|start|end|birth|death|founded|established|dissolved|成立|解散|出生|去世|开始|结束|发生|发布时间|任职|服役|退役|研制|获奖|时间|日期)/i;
  const TYPE_LABELS = new Map([
    ["person", "人物"],
    ["organization", "机构"],
    ["equipment", "装备"],
    ["facility", "设施"],
    ["event", "事件"],
    ["work", "作品"],
  ]);

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const text = String(value ?? "").trim();
    if (!text) return null;
    const yearOnly = text.match(/^(\d{4})$/);
    if (yearOnly) return new Date(`${yearOnly[1]}-01-01T00:00:00`);
    const normalized = text
      .replace(/[年/.]/g, "-")
      .replace(/月/g, "-")
      .replace(/日/g, "");
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function displayType(node) {
    const raw = String(
      node?.typeLabel || node?.classLabel || node?.type || "未分类",
    ).trim();
    return TYPE_LABELS.get(raw.toLowerCase()) || raw || "未分类";
  }

  function resolveImage(node) {
    const candidates = [
      node?.image,
      node?.images,
      node?.data?.image,
      node?.data?.images,
    ];
    for (const candidate of candidates) {
      let value = Array.isArray(candidate) ? candidate[0] : candidate;
      if (typeof value === "string") {
        const text = value.trim();
        if (text.startsWith("[")) {
          try {
            const parsed = JSON.parse(text);
            value = Array.isArray(parsed) ? parsed[0] : value;
          } catch {}
        }
      }
      const source = String(value || "").trim();
      if (!source) continue;
      try {
        return new URL(source, window.location.origin).toString();
      } catch {
        return source;
      }
    }
    return "";
  }

  function formatChineseDate(value) {
    const date = value instanceof Date ? value : parseDate(value);
    if (!date) return "";
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function collectDateEvents(node) {
    const source = {
      ...(node?.data && typeof node.data === "object" ? node.data : {}),
      ...node,
    };
    const entries = [];
    const attributes = Array.isArray(node?._timeline_attributes)
      ? node._timeline_attributes
      : [];
    attributes.forEach((attr) => {
      entries.push({
        key: attr.property_name_snapshot || attr.key,
        value: attr.value,
      });
    });
    Object.entries(source).forEach(([key, value]) => {
      if (
        key === "data" ||
        key === "_timeline_attributes" ||
        !DATE_KEY_RE.test(key)
      )
        return;
      entries.push({ key, value });
    });

    const events = [];
    const seen = new Set();
    entries.forEach(({ key, value }) => {
      const values = Array.isArray(value) ? value : [value];
      values.forEach((entry) => {
        if (entry && typeof entry === "object" && !Array.isArray(entry)) {
          const start = parseDate(
            entry.start || entry.from || entry.date || entry.time,
          );
          const end = parseDate(entry.end || entry.to);
          if (start) events.push({ key, start, end });
          return;
        }
        const text = String(entry ?? "").trim();
        if (!text) return;
        const range = text.match(
          /(\d{4}(?:[-/.年]\d{1,2})?(?:[-/.月]\d{1,2}日?)?)\s*(?:至|到|[-~])\s*(\d{4}(?:[-/.年]\d{1,2})?(?:[-/.月]\d{1,2}日?)?)/,
        );
        const start = parseDate(range ? range[1] : text);
        const end = range ? parseDate(range[2]) : null;
        if (!start) return;
        const signature = `${key}|${start.toISOString()}|${end?.toISOString() || ""}`;
        if (seen.has(signature)) return;
        seen.add(signature);
        events.push({ key, start, end });
      });
    });
    return events;
  }

  function toItems(nodes) {
    const result = [];
    (Array.isArray(nodes) ? nodes : []).forEach((node) => {
      const entityId = String(node?._id || node?.id || "").trim();
      if (!entityId) return;
      const name = node?.label_zh || node?.label || node?.name || entityId;
      const group = displayType(node);
      const image = resolveImage(node);
      collectDateEvents(node).forEach((event, index) => {
        const id = `${entityId}-${event.key || "date"}-${index}`.replace(
          /[^\w\u4e00-\u9fff-]+/g,
          "-",
        );
        const imageHtml = image
          ? `<span class="timeline-card-image-frame"><img class="timeline-card-image" src="${escapeHtml(image)}" alt="" width="36" height="36" loading="lazy"></span>`
          : '<span class="timeline-card-image timeline-card-image--empty"><i class="fa-solid fa-cube" aria-hidden="true"></i></span>';
        result.push({
          id,
          entityId,
          content: `<article class="timeline-card">${imageHtml}<span class="timeline-card-body"><strong class="timeline-card-name" title="${escapeHtml(name)}">${escapeHtml(name)}</strong></span></article>`,
          start: event.start,
          end: event.end || undefined,
          // Ranges are shown as event cards as well: vis range items set an
          // inline duration width, which makes content cards stretch.
          type: "box",
          group,
          className: "timeline-card-item timeline-card-item--point",
          title: escapeHtml(name),
        });
      });
    });
    return result;
  }

  function getFilterValues() {
    return {
      type: document.getElementById("timelineTypeFilter")?.value || "",
      from: document.getElementById("timelineFrom")?.value || "",
      to: document.getElementById("timelineTo")?.value || "",
    };
  }

  function applyFilters() {
    const filter = getFilterValues();
    const from = filter.from ? parseDate(filter.from) : null;
    const to = filter.to ? parseDate(filter.to) : null;
    const filtered = toItems(currentNodes).filter((item) => {
      if (filter.type && item.group !== filter.type) return false;
      if (from && new Date(item.end || item.start) < from) return false;
      if (to && new Date(item.start) > new Date(`${filter.to}T23:59:59`))
        return false;
      return true;
    });
    if (!timeline) return;
    items.clear();
    items.add(filtered);
    const visibleGroups = [
      ...new Set(filtered.map((item) => item.group)),
    ].sort();
    groups.clear();
    groups.add(
      visibleGroups.map((id) => ({
        id,
        content: `<span class="timeline-group-label">${escapeHtml(id)}</span>`,
      })),
    );
    const host = document.getElementById("timelineView");
    host?.classList.toggle("timeline-view--empty", filtered.length === 0);
  }

  function updateTypeOptions(nodes) {
    const select = document.getElementById("timelineTypeFilter");
    if (!select) return;
    const selected = select.value;
    const types = [...new Set((nodes || []).map(displayType))].sort((a, b) =>
      a.localeCompare(b),
    );
    select.replaceChildren(new Option("全部类型", ""));
    types.forEach((type) => select.appendChild(new Option(type, type)));
    select.value = types.includes(selected) ? selected : "";
  }

  function openEntity(entityId) {
    if (!entityId) return;
    window.setTableSelection?.(entityId, false, {
      skipDetailRefresh: true,
      skipSidebarSync: true,
    });
    window.setViewMode?.("detail", { targetNodeId: entityId });
  }

  async function init() {
    const host = document.getElementById("timelineView");
    if (!host || initialized) return;
    const vis = window.vis;
    if (!vis?.DataSet || !vis?.Timeline) {
      throw new Error("vis-timeline 组件未加载");
    }
    const DataSet = vis.DataSet;
    const Timeline = vis.Timeline;
    items = new DataSet();
    groups = new DataSet();
    timeline = new Timeline(host, items, groups, {
      stack: true,
      zoomable: true,
      moveable: true,
      selectable: true,
      orientation: "top",
      locale: "zh-cn",
      locales: {
        "zh-cn": {
          current: "当前",
          time: "时间",
        },
      },
      format: {
        minorLabels: {
          millisecond: "SSS毫秒",
          second: "s秒",
          minute: "HH:mm",
          hour: "HH:mm",
          weekday: "M月D日",
          day: "D日",
          week: "第w周",
          month: "M月",
          year: "YYYY年",
        },
        majorLabels: {
          millisecond: "YYYY年M月D日",
          second: "YYYY年M月D日",
          minute: "YYYY年M月D日",
          hour: "YYYY年M月D日",
          weekday: "YYYY年M月",
          day: "YYYY年M月",
          week: "YYYY年M月",
          month: "YYYY年",
          year: "",
        },
      },
      tooltip: { followMouse: true, overflowMethod: "cap" },
      maxHeight: "100%",
      groupOrder: "content",
      verticalScroll: true,
      showCurrentTime: true,
      zoomMin: 24 * 60 * 60 * 1000,
      zoomMax: 1000 * 365 * 24 * 60 * 60 * 1000,
      margin: { item: { horizontal: 12, vertical: 10 }, axis: 8 },
      editable: false,
    });
    timeline.on("select", (event) => {
      const item = event.items?.[0] ? items.get(event.items[0]) : null;
      if (item?.entityId) openEntity(item.entityId);
    });
    initialized = true;
    document
      .getElementById("timelineTypeFilter")
      ?.addEventListener("change", applyFilters);
    document
      .getElementById("timelineFrom")
      ?.addEventListener("change", applyFilters);
    document
      .getElementById("timelineTo")
      ?.addEventListener("change", applyFilters);
  }

  window.kbTimeline = {
    init,
    update(nodes) {
      currentNodes = Array.isArray(nodes) ? nodes : [];
      updateTypeOptions(currentNodes);
      if (!initialized) return init().then(applyFilters);
      applyFilters();
    },
    clear() {
      items?.clear();
      groups?.clear();
    },
  };
})();
