(() => {
  var __defProp = Object.defineProperty;
  var __returnValue = (v) => v;
  function __exportSetter(name, newValue) {
    this[name] = __returnValue.bind(null, newValue);
  }
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, {
        get: all[name],
        enumerable: true,
        configurable: true,
        set: __exportSetter.bind(all, name)
      });
  };

  // src/shared/wikidata.ts
  var exports_wikidata = {};
  __export(exports_wikidata, {
    valueTypeFor: () => valueTypeFor,
    uiDatatype: () => uiDatatype,
    parseTimeValue: () => parseTimeValue,
    normalizeValue: () => normalizeValue,
    normalizeStatement: () => normalizeStatement,
    normalizeDatatype: () => normalizeDatatype,
    datatypeValueTypes: () => datatypeValueTypes
  });
  var datatypeValueTypes = {
    "wikibase-item": "wikibase-entityid",
    "wikibase-property": "wikibase-entityid",
    "wikibase-lexeme": "wikibase-entityid",
    "wikibase-form": "wikibase-entityid",
    "wikibase-sense": "wikibase-entityid",
    string: "string",
    "external-id": "string",
    url: "string",
    commonsMedia: "string",
    math: "string",
    "musical-notation": "string",
    "geo-shape": "string",
    "tabular-data": "string",
    quantity: "quantity",
    time: "time",
    "globe-coordinate": "globecoordinate",
    monolingualtext: "monolingualtext"
  };
  function normalizeDatatype(datatype, legacyValueType = "") {
    let dt = String(datatype || "").trim();
    const legacy = String(legacyValueType || "").trim();
    if ((!dt || dt === "string") && legacy === "wikibase-entityid")
      dt = "wikibase-item";
    if ((!dt || dt === "string") && legacy === "globecoordinate")
      dt = "globe-coordinate";
    if ((!dt || dt === "string" || dt === "wikibase-entityid") && legacy && legacy !== "string" && datatypeValueTypes[legacy])
      dt = legacy;
    if (dt === "wikibase-entityid")
      return "wikibase-item";
    if (dt === "globecoordinate")
      return "globe-coordinate";
    if (dt.toLowerCase() === "commonsmedia")
      return "commonsMedia";
    return dt || "string";
  }
  function valueTypeFor(datatype) {
    return datatypeValueTypes[normalizeDatatype(datatype)] || "string";
  }
  function uiDatatype(datatype, legacyValueType = "") {
    const dt = normalizeDatatype(datatype, legacyValueType);
    if (valueTypeFor(dt) === "wikibase-entityid")
      return "wikibase-entityid";
    if (dt === "globe-coordinate")
      return "globecoordinate";
    if (["url", "commonsMedia", "time", "quantity", "monolingualtext"].includes(dt))
      return dt;
    return "string";
  }
  function normalizeValue(datatype, value) {
    if (Array.isArray(value))
      return value.map((item) => normalizeValue(datatype, item));
    const dt = normalizeDatatype(datatype);
    if (dt === "time") {
      if (!value || typeof value !== "object")
        throw new Error("时间值必须包含 time 和 precision");
      if (value.time) {
        if (!/^[+-]\d{4,}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value.time))
          throw new Error("Wikibase time 格式无效");
        return { timezone: 0, before: 0, after: 0, precision: 11, calendarmodel: "http://www.wikidata.org/entity/Q1985727", ...value };
      }
      const date = String(value.date || "");
      if (!date)
        throw new Error("时间值缺少 time");
      const { date: _date, ...rest } = value;
      return { ...parseTimeValue(date), ...rest };
    }
    if (dt === "quantity") {
      if (!value || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(value.amount ?? "")))
        throw new Error("数量格式无效");
      return { ...value, amount: String(value.amount), unit: value.unit || "1" };
    }
    if (dt === "globe-coordinate") {
      if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) || Math.abs(value.latitude) > 90 || Math.abs(value.longitude) > 180)
        throw new Error("经纬度超出有效范围");
      return { altitude: null, precision: null, globe: "http://www.wikidata.org/entity/Q2", ...value };
    }
    if (valueTypeFor(dt) === "wikibase-entityid") {
      if (!value || typeof value !== "object" || !String(value.id || "").trim())
        throw new Error("实体引用必须包含 id");
      const entityType = dt.slice("wikibase-".length);
      return { ...value, "entity-type": entityType };
    }
    if (dt === "monolingualtext") {
      if (!value || typeof value.text !== "string" || !value.language)
        throw new Error("单语文本必须包含 text 和 language");
      return value;
    }
    if (typeof value !== "string")
      throw new Error("该数据类型的值必须是字符串");
    return value;
  }
  function normalizeStatement(input, previous = {}) {
    const datatype = normalizeDatatype(input.datatype || previous.datatype);
    if (!datatypeValueTypes[datatype])
      throw new Error("不支持的数据类型");
    const snaktype = input.snaktype || previous.snaktype || "value";
    if (!["value", "somevalue", "novalue"].includes(snaktype))
      throw new Error("无效的值状态");
    const rank = input.rank ?? previous.rank ?? "normal";
    if (!["normal", "preferred", "deprecated"].includes(rank))
      throw new Error("无效的 rank");
    const qualifiers = input.qualifiers ?? previous.qualifiers ?? {};
    const references = input.references ?? previous.references ?? [];
    if (!qualifiers || typeof qualifiers !== "object" || Array.isArray(qualifiers) || !Array.isArray(references))
      throw new Error("限定符或来源格式无效");
    const result = { property: input.property || previous.property, datatype, snaktype, rank, qualifiers, references };
    if (snaktype === "value") {
      if (input.datavalue?.type && input.datavalue.type !== valueTypeFor(datatype))
        throw new Error("数值类型与数据类型不匹配");
      result.datavalue = { type: valueTypeFor(datatype), value: normalizeValue(datatype, input.datavalue?.value ?? input.value) };
    }
    return result;
  }
  function parseTimeValue(input) {
    let text = String(input || "").trim().normalize("NFKC").replace(/年|月/g, "-").replace(/[日号]/g, " ").replace(/时|点/g, ":").replace(/分/g, ":").replace(/秒/g, "").trim().replace(/[-:]$/, "");
    text = text.replace(/^(\d{4})(\d{2})(\d{2})(?=$|[ T])/, "$1-$2-$3");
    const match = text.match(/^([+-]?\d{4,})[-/.]?(?:(\d{1,2})(?:[-/.](\d{1,2}))?)?(?:[ T]+(\d{1,2}):(\d{1,2})(?::(\d{1,2})(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?)?$/i);
    if (!match)
      throw new Error("时间格式无效");
    const [, y = "", m, d, h, min, sec, fraction, zone] = match;
    const year = Number(y), month = Number(m || 1), day = Number(d || 1);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || h !== undefined && (!d || Number(h) > 23 || Number(min) > 59 || Number(sec || 0) > 59))
      throw new Error("时间超出有效范围");
    const pad = (v) => String(v).padStart(2, "0");
    let timezone = 0;
    if (zone && zone.toUpperCase() !== "Z") {
      const offset = zone.slice(1).replace(":", "");
      const hours = Number(offset.slice(0, 2)), minutes = Number(offset.slice(2));
      if (hours > 23 || minutes > 59)
        throw new Error("时区格式无效");
      timezone = (hours * 60 + minutes) * (zone[0] === "-" ? -1 : 1);
    }
    return {
      time: `${year < 0 ? "-" : "+"}${String(Math.abs(year)).padStart(4, "0")}-${m ? pad(month) : "00"}-${d ? pad(day) : "00"}T${pad(h || 0)}:${pad(min || 0)}:${pad(sec || 0)}${fraction || ""}Z`,
      timezone,
      before: 0,
      after: 0,
      precision: sec !== undefined ? 14 : min !== undefined ? 13 : d ? 11 : m ? 10 : 9,
      calendarmodel: "http://www.wikidata.org/entity/Q1985727"
    };
  }

  // public/assets/scripts/wikidata-model.ts
  window.KbWikidata = exports_wikidata;
})();
