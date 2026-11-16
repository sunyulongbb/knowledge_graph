// @bun
// src/server/tag-order.ts
function sortTags(values) {
  const unique = new Map;
  for (const value of values) {
    if (typeof value !== "string")
      continue;
    const tag = value.trim();
    if (tag && !unique.has(tag.toLowerCase()))
      unique.set(tag.toLowerCase(), tag);
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

// src/server/entity-media-images.ts
import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { resolve } from "path";
var EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/heif": "heif"
};
var MAX_IMAGE_BYTES = 20 * 1024 * 1024;
var ENTITY_UPLOADS_ROOT = resolve(import.meta.dir, "..", "..", "uploads");
async function prepareEntityImageValues(input, projectId, uploadsRoot = ENTITY_UPLOADS_ROOT) {
  if (!Number.isSafeInteger(projectId) || projectId <= 0)
    throw new TypeError("\u65E0\u6548\u7684\u5E94\u7528 ID");
  const result = { ...input };
  for (const field of ["images", "covers"]) {
    if (input[field] === undefined)
      continue;
    if (!Array.isArray(input[field]) || input[field].some((value) => typeof value !== "string"))
      throw new TypeError(`${field} \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
    const prepared = [];
    for (const raw of input[field]) {
      const value = raw.trim();
      if (!value.startsWith("data:image/")) {
        prepared.push(value);
        continue;
      }
      const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(value);
      const extension = match && EXTENSIONS[match[1].toLowerCase()];
      if (!match || !extension)
        throw new TypeError("\u65E0\u6548\u6216\u4E0D\u652F\u6301\u7684\u56FE\u7247\u6570\u636E");
      const encoded = match[2].replace(/[\r\n]/g, "");
      if (encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4)
        throw new RangeError("\u56FE\u7247\u5927\u5C0F\u8D85\u8FC7\u9650\u5236\uFF1A20MB");
      const buffer = Buffer.from(encoded, "base64");
      if (!buffer.length || buffer.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, ""))
        throw new TypeError("\u65E0\u6548\u7684\u56FE\u7247\u7F16\u7801");
      if (buffer.length > MAX_IMAGE_BYTES)
        throw new RangeError("\u56FE\u7247\u5927\u5C0F\u8D85\u8FC7\u9650\u5236\uFF1A20MB");
      const filename = `${createHash("sha256").update(buffer).digest("hex")}.${extension}`;
      const directory = resolve(uploadsRoot, String(projectId), "node-images");
      await mkdir(directory, { recursive: true });
      await writeFile(resolve(directory, filename), buffer, { flag: "wx" }).catch((error) => {
        if (error.code !== "EEXIST")
          throw error;
      });
      prepared.push(`/static/uploads/${projectId}/node-images/${filename}`);
    }
    result[field] = prepared;
  }
  return result;
}

// node_modules/marked/lib/marked.esm.js
function L() {
  return { async: false, breaks: false, extensions: null, gfm: true, hooks: null, pedantic: false, renderer: null, silent: false, tokenizer: null, walkTokens: null };
}
var T = L();
function Z(u) {
  T = u;
}
var C = { exec: () => null };
function k(u, e = "") {
  let t = typeof u == "string" ? u : u.source, n = { replace: (r, i) => {
    let s = typeof i == "string" ? i : i.source;
    return s = s.replace(m.caret, "$1"), t = t.replace(r, s), n;
  }, getRegex: () => new RegExp(t, e) };
  return n;
}
var me = (() => {
  try {
    return !!new RegExp("(?<=1)(?<!1)");
  } catch {
    return false;
  }
})();
var m = { codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceTabs: /^\t+/, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] +\S/, listReplaceTask: /^\[[ xX]\] +/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (u) => new RegExp(`^( {0,3}${u})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: (u) => new RegExp(`^ {0,${Math.min(3, u - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`), hrRegex: (u) => new RegExp(`^ {0,${Math.min(3, u - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`), fencesBeginRegex: (u) => new RegExp(`^ {0,${Math.min(3, u - 1)}}(?:\`\`\`|~~~)`), headingBeginRegex: (u) => new RegExp(`^ {0,${Math.min(3, u - 1)}}#`), htmlBeginRegex: (u) => new RegExp(`^ {0,${Math.min(3, u - 1)}}<(?:[a-z].*>|!--)`, "i") };
var xe = /^(?:[ \t]*(?:\n|$))+/;
var be = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var Re = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var I = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var Te = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var N = /(?:[*+-]|\d{1,9}[.)])/;
var re = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var se = k(re).replace(/bull/g, N).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var Oe = k(re).replace(/bull/g, N).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var Q = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
var we = /^[^\n]+/;
var F = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/;
var ye = k(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", F).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var Pe = k(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, N).getRegex();
var v = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var j = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var Se = k("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$))", "i").replace("comment", j).replace("tag", v).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var ie = k(Q).replace("hr", I).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", v).getRegex();
var $e = k(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", ie).getRegex();
var U = { blockquote: $e, code: be, def: ye, fences: Re, heading: Te, hr: I, html: Se, lheading: se, list: Pe, newline: xe, paragraph: ie, table: C, text: we };
var te = k("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", I).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}\t)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", v).getRegex();
var _e = { ...U, lheading: Oe, table: te, paragraph: k(Q).replace("hr", I).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", te).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", v).getRegex() };
var Le = { ...U, html: k(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", j).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: C, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: k(Q).replace("hr", I).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", se).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() };
var Me = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var ze = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var oe = /^( {2,}|\\)\n(?!\s*$)/;
var Ae = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var D = /[\p{P}\p{S}]/u;
var K = /[\s\p{P}\p{S}]/u;
var ae = /[^\s\p{P}\p{S}]/u;
var Ce = k(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, K).getRegex();
var le = /(?!~)[\p{P}\p{S}]/u;
var Ie = /(?!~)[\s\p{P}\p{S}]/u;
var Ee = /(?:[^\s\p{P}\p{S}]|~)/u;
var Be = k(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", me ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex();
var ue = /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/;
var qe = k(ue, "u").replace(/punct/g, D).getRegex();
var ve = k(ue, "u").replace(/punct/g, le).getRegex();
var pe = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var De = k(pe, "gu").replace(/notPunctSpace/g, ae).replace(/punctSpace/g, K).replace(/punct/g, D).getRegex();
var He = k(pe, "gu").replace(/notPunctSpace/g, Ee).replace(/punctSpace/g, Ie).replace(/punct/g, le).getRegex();
var Ze = k("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, ae).replace(/punctSpace/g, K).replace(/punct/g, D).getRegex();
var Ge = k(/\\(punct)/, "gu").replace(/punct/g, D).getRegex();
var Ne = k(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var Qe = k(j).replace("(?:-->|$)", "-->").getRegex();
var Fe = k("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", Qe).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var q = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+[^`]*?`+(?!`)|[^\[\]\\`])*?/;
var je = k(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label", q).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var ce = k(/^!?\[(label)\]\[(ref)\]/).replace("label", q).replace("ref", F).getRegex();
var he = k(/^!?\[(ref)\](?:\[\])?/).replace("ref", F).getRegex();
var Ue = k("reflink|nolink(?!\\()", "g").replace("reflink", ce).replace("nolink", he).getRegex();
var ne = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;
var W = { _backpedal: C, anyPunctuation: Ge, autolink: Ne, blockSkip: Be, br: oe, code: ze, del: C, emStrongLDelim: qe, emStrongRDelimAst: De, emStrongRDelimUnd: Ze, escape: Me, link: je, nolink: he, punctuation: Ce, reflink: ce, reflinkSearch: Ue, tag: Fe, text: Ae, url: C };
var Ke = { ...W, link: k(/^!?\[(label)\]\((.*?)\)/).replace("label", q).getRegex(), reflink: k(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", q).getRegex() };
var G = { ...W, emStrongRDelimAst: He, emStrongLDelim: ve, url: k(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol", ne).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: k(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol", ne).getRegex() };
var We = { ...G, br: k(oe).replace("{2,}", "*").getRegex(), text: k(G.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() };
var E = { normal: U, gfm: _e, pedantic: Le };
var M = { normal: W, gfm: G, breaks: We, pedantic: Ke };
var Xe = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
var ke = (u) => Xe[u];
function w(u, e) {
  if (e) {
    if (m.escapeTest.test(u))
      return u.replace(m.escapeReplace, ke);
  } else if (m.escapeTestNoEncode.test(u))
    return u.replace(m.escapeReplaceNoEncode, ke);
  return u;
}
function X(u) {
  try {
    u = encodeURI(u).replace(m.percentDecode, "%");
  } catch {
    return null;
  }
  return u;
}
function J(u, e) {
  let t = u.replace(m.findPipe, (i, s, a) => {
    let o = false, l = s;
    for (;--l >= 0 && a[l] === "\\"; )
      o = !o;
    return o ? "|" : " |";
  }), n = t.split(m.splitPipe), r = 0;
  if (n[0].trim() || n.shift(), n.length > 0 && !n.at(-1)?.trim() && n.pop(), e)
    if (n.length > e)
      n.splice(e);
    else
      for (;n.length < e; )
        n.push("");
  for (;r < n.length; r++)
    n[r] = n[r].trim().replace(m.slashPipe, "|");
  return n;
}
function z(u, e, t) {
  let n = u.length;
  if (n === 0)
    return "";
  let r = 0;
  for (;r < n; ) {
    let i = u.charAt(n - r - 1);
    if (i === e && !t)
      r++;
    else if (i !== e && t)
      r++;
    else
      break;
  }
  return u.slice(0, n - r);
}
function de(u, e) {
  if (u.indexOf(e[1]) === -1)
    return -1;
  let t = 0;
  for (let n = 0;n < u.length; n++)
    if (u[n] === "\\")
      n++;
    else if (u[n] === e[0])
      t++;
    else if (u[n] === e[1] && (t--, t < 0))
      return n;
  return t > 0 ? -2 : -1;
}
function ge(u, e, t, n, r) {
  let i = e.href, s = e.title || null, a = u[1].replace(r.other.outputLinkReplace, "$1");
  n.state.inLink = true;
  let o = { type: u[0].charAt(0) === "!" ? "image" : "link", raw: t, href: i, title: s, text: a, tokens: n.inlineTokens(a) };
  return n.state.inLink = false, o;
}
function Je(u, e, t) {
  let n = u.match(t.other.indentCodeCompensation);
  if (n === null)
    return e;
  let r = n[1];
  return e.split(`
`).map((i) => {
    let s = i.match(t.other.beginningSpace);
    if (s === null)
      return i;
    let [a] = s;
    return a.length >= r.length ? i.slice(r.length) : i;
  }).join(`
`);
}
var y = class {
  options;
  rules;
  lexer;
  constructor(e) {
    this.options = e || T;
  }
  space(e) {
    let t = this.rules.block.newline.exec(e);
    if (t && t[0].length > 0)
      return { type: "space", raw: t[0] };
  }
  code(e) {
    let t = this.rules.block.code.exec(e);
    if (t) {
      let n = t[0].replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: t[0], codeBlockStyle: "indented", text: this.options.pedantic ? n : z(n, `
`) };
    }
  }
  fences(e) {
    let t = this.rules.block.fences.exec(e);
    if (t) {
      let n = t[0], r = Je(n, t[3] || "", this.rules);
      return { type: "code", raw: n, lang: t[2] ? t[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : t[2], text: r };
    }
  }
  heading(e) {
    let t = this.rules.block.heading.exec(e);
    if (t) {
      let n = t[2].trim();
      if (this.rules.other.endingHash.test(n)) {
        let r = z(n, "#");
        (this.options.pedantic || !r || this.rules.other.endingSpaceChar.test(r)) && (n = r.trim());
      }
      return { type: "heading", raw: t[0], depth: t[1].length, text: n, tokens: this.lexer.inline(n) };
    }
  }
  hr(e) {
    let t = this.rules.block.hr.exec(e);
    if (t)
      return { type: "hr", raw: z(t[0], `
`) };
  }
  blockquote(e) {
    let t = this.rules.block.blockquote.exec(e);
    if (t) {
      let n = z(t[0], `
`).split(`
`), r = "", i = "", s = [];
      for (;n.length > 0; ) {
        let a = false, o = [], l;
        for (l = 0;l < n.length; l++)
          if (this.rules.other.blockquoteStart.test(n[l]))
            o.push(n[l]), a = true;
          else if (!a)
            o.push(n[l]);
          else
            break;
        n = n.slice(l);
        let p = o.join(`
`), c = p.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        r = r ? `${r}
${p}` : p, i = i ? `${i}
${c}` : c;
        let g = this.lexer.state.top;
        if (this.lexer.state.top = true, this.lexer.blockTokens(c, s, true), this.lexer.state.top = g, n.length === 0)
          break;
        let h = s.at(-1);
        if (h?.type === "code")
          break;
        if (h?.type === "blockquote") {
          let R = h, f = R.raw + `
` + n.join(`
`), O = this.blockquote(f);
          s[s.length - 1] = O, r = r.substring(0, r.length - R.raw.length) + O.raw, i = i.substring(0, i.length - R.text.length) + O.text;
          break;
        } else if (h?.type === "list") {
          let R = h, f = R.raw + `
` + n.join(`
`), O = this.list(f);
          s[s.length - 1] = O, r = r.substring(0, r.length - h.raw.length) + O.raw, i = i.substring(0, i.length - R.raw.length) + O.raw, n = f.substring(s.at(-1).raw.length).split(`
`);
          continue;
        }
      }
      return { type: "blockquote", raw: r, tokens: s, text: i };
    }
  }
  list(e) {
    let t = this.rules.block.list.exec(e);
    if (t) {
      let n = t[1].trim(), r = n.length > 1, i = { type: "list", raw: "", ordered: r, start: r ? +n.slice(0, -1) : "", loose: false, items: [] };
      n = r ? `\\d{1,9}\\${n.slice(-1)}` : `\\${n}`, this.options.pedantic && (n = r ? n : "[*+-]");
      let s = this.rules.other.listItemRegex(n), a = false;
      for (;e; ) {
        let l = false, p = "", c = "";
        if (!(t = s.exec(e)) || this.rules.block.hr.test(e))
          break;
        p = t[0], e = e.substring(p.length);
        let g = t[2].split(`
`, 1)[0].replace(this.rules.other.listReplaceTabs, (O) => " ".repeat(3 * O.length)), h = e.split(`
`, 1)[0], R = !g.trim(), f = 0;
        if (this.options.pedantic ? (f = 2, c = g.trimStart()) : R ? f = t[1].length + 1 : (f = t[2].search(this.rules.other.nonSpaceChar), f = f > 4 ? 1 : f, c = g.slice(f), f += t[1].length), R && this.rules.other.blankLine.test(h) && (p += h + `
`, e = e.substring(h.length + 1), l = true), !l) {
          let O = this.rules.other.nextBulletRegex(f), V = this.rules.other.hrRegex(f), Y = this.rules.other.fencesBeginRegex(f), ee = this.rules.other.headingBeginRegex(f), fe = this.rules.other.htmlBeginRegex(f);
          for (;e; ) {
            let H = e.split(`
`, 1)[0], A;
            if (h = H, this.options.pedantic ? (h = h.replace(this.rules.other.listReplaceNesting, "  "), A = h) : A = h.replace(this.rules.other.tabCharGlobal, "    "), Y.test(h) || ee.test(h) || fe.test(h) || O.test(h) || V.test(h))
              break;
            if (A.search(this.rules.other.nonSpaceChar) >= f || !h.trim())
              c += `
` + A.slice(f);
            else {
              if (R || g.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || Y.test(g) || ee.test(g) || V.test(g))
                break;
              c += `
` + h;
            }
            !R && !h.trim() && (R = true), p += H + `
`, e = e.substring(H.length + 1), g = A.slice(f);
          }
        }
        i.loose || (a ? i.loose = true : this.rules.other.doubleBlankLine.test(p) && (a = true)), i.items.push({ type: "list_item", raw: p, task: !!this.options.gfm && this.rules.other.listIsTask.test(c), loose: false, text: c, tokens: [] }), i.raw += p;
      }
      let o = i.items.at(-1);
      if (o)
        o.raw = o.raw.trimEnd(), o.text = o.text.trimEnd();
      else
        return;
      i.raw = i.raw.trimEnd();
      for (let l of i.items) {
        if (this.lexer.state.top = false, l.tokens = this.lexer.blockTokens(l.text, []), l.task) {
          if (l.text = l.text.replace(this.rules.other.listReplaceTask, ""), l.tokens[0]?.type === "text" || l.tokens[0]?.type === "paragraph") {
            l.tokens[0].raw = l.tokens[0].raw.replace(this.rules.other.listReplaceTask, ""), l.tokens[0].text = l.tokens[0].text.replace(this.rules.other.listReplaceTask, "");
            for (let c = this.lexer.inlineQueue.length - 1;c >= 0; c--)
              if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[c].src)) {
                this.lexer.inlineQueue[c].src = this.lexer.inlineQueue[c].src.replace(this.rules.other.listReplaceTask, "");
                break;
              }
          }
          let p = this.rules.other.listTaskCheckbox.exec(l.raw);
          if (p) {
            let c = { type: "checkbox", raw: p[0] + " ", checked: p[0] !== "[ ]" };
            l.checked = c.checked, i.loose ? l.tokens[0] && ["paragraph", "text"].includes(l.tokens[0].type) && "tokens" in l.tokens[0] && l.tokens[0].tokens ? (l.tokens[0].raw = c.raw + l.tokens[0].raw, l.tokens[0].text = c.raw + l.tokens[0].text, l.tokens[0].tokens.unshift(c)) : l.tokens.unshift({ type: "paragraph", raw: c.raw, text: c.raw, tokens: [c] }) : l.tokens.unshift(c);
          }
        }
        if (!i.loose) {
          let p = l.tokens.filter((g) => g.type === "space"), c = p.length > 0 && p.some((g) => this.rules.other.anyLine.test(g.raw));
          i.loose = c;
        }
      }
      if (i.loose)
        for (let l of i.items) {
          l.loose = true;
          for (let p of l.tokens)
            p.type === "text" && (p.type = "paragraph");
        }
      return i;
    }
  }
  html(e) {
    let t = this.rules.block.html.exec(e);
    if (t)
      return { type: "html", block: true, raw: t[0], pre: t[1] === "pre" || t[1] === "script" || t[1] === "style", text: t[0] };
  }
  def(e) {
    let t = this.rules.block.def.exec(e);
    if (t) {
      let n = t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " "), r = t[2] ? t[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", i = t[3] ? t[3].substring(1, t[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : t[3];
      return { type: "def", tag: n, raw: t[0], href: r, title: i };
    }
  }
  table(e) {
    let t = this.rules.block.table.exec(e);
    if (!t || !this.rules.other.tableDelimiter.test(t[2]))
      return;
    let n = J(t[1]), r = t[2].replace(this.rules.other.tableAlignChars, "").split("|"), i = t[3]?.trim() ? t[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], s = { type: "table", raw: t[0], header: [], align: [], rows: [] };
    if (n.length === r.length) {
      for (let a of r)
        this.rules.other.tableAlignRight.test(a) ? s.align.push("right") : this.rules.other.tableAlignCenter.test(a) ? s.align.push("center") : this.rules.other.tableAlignLeft.test(a) ? s.align.push("left") : s.align.push(null);
      for (let a = 0;a < n.length; a++)
        s.header.push({ text: n[a], tokens: this.lexer.inline(n[a]), header: true, align: s.align[a] });
      for (let a of i)
        s.rows.push(J(a, s.header.length).map((o, l) => ({ text: o, tokens: this.lexer.inline(o), header: false, align: s.align[l] })));
      return s;
    }
  }
  lheading(e) {
    let t = this.rules.block.lheading.exec(e);
    if (t)
      return { type: "heading", raw: t[0], depth: t[2].charAt(0) === "=" ? 1 : 2, text: t[1], tokens: this.lexer.inline(t[1]) };
  }
  paragraph(e) {
    let t = this.rules.block.paragraph.exec(e);
    if (t) {
      let n = t[1].charAt(t[1].length - 1) === `
` ? t[1].slice(0, -1) : t[1];
      return { type: "paragraph", raw: t[0], text: n, tokens: this.lexer.inline(n) };
    }
  }
  text(e) {
    let t = this.rules.block.text.exec(e);
    if (t)
      return { type: "text", raw: t[0], text: t[0], tokens: this.lexer.inline(t[0]) };
  }
  escape(e) {
    let t = this.rules.inline.escape.exec(e);
    if (t)
      return { type: "escape", raw: t[0], text: t[1] };
  }
  tag(e) {
    let t = this.rules.inline.tag.exec(e);
    if (t)
      return !this.lexer.state.inLink && this.rules.other.startATag.test(t[0]) ? this.lexer.state.inLink = true : this.lexer.state.inLink && this.rules.other.endATag.test(t[0]) && (this.lexer.state.inLink = false), !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(t[0]) ? this.lexer.state.inRawBlock = true : this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(t[0]) && (this.lexer.state.inRawBlock = false), { type: "html", raw: t[0], inLink: this.lexer.state.inLink, inRawBlock: this.lexer.state.inRawBlock, block: false, text: t[0] };
  }
  link(e) {
    let t = this.rules.inline.link.exec(e);
    if (t) {
      let n = t[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(n)) {
        if (!this.rules.other.endAngleBracket.test(n))
          return;
        let s = z(n.slice(0, -1), "\\");
        if ((n.length - s.length) % 2 === 0)
          return;
      } else {
        let s = de(t[2], "()");
        if (s === -2)
          return;
        if (s > -1) {
          let o = (t[0].indexOf("!") === 0 ? 5 : 4) + t[1].length + s;
          t[2] = t[2].substring(0, s), t[0] = t[0].substring(0, o).trim(), t[3] = "";
        }
      }
      let r = t[2], i = "";
      if (this.options.pedantic) {
        let s = this.rules.other.pedanticHrefTitle.exec(r);
        s && (r = s[1], i = s[3]);
      } else
        i = t[3] ? t[3].slice(1, -1) : "";
      return r = r.trim(), this.rules.other.startAngleBracket.test(r) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(n) ? r = r.slice(1) : r = r.slice(1, -1)), ge(t, { href: r && r.replace(this.rules.inline.anyPunctuation, "$1"), title: i && i.replace(this.rules.inline.anyPunctuation, "$1") }, t[0], this.lexer, this.rules);
    }
  }
  reflink(e, t) {
    let n;
    if ((n = this.rules.inline.reflink.exec(e)) || (n = this.rules.inline.nolink.exec(e))) {
      let r = (n[2] || n[1]).replace(this.rules.other.multipleSpaceGlobal, " "), i = t[r.toLowerCase()];
      if (!i) {
        let s = n[0].charAt(0);
        return { type: "text", raw: s, text: s };
      }
      return ge(n, i, n[0], this.lexer, this.rules);
    }
  }
  emStrong(e, t, n = "") {
    let r = this.rules.inline.emStrongLDelim.exec(e);
    if (!r || r[3] && n.match(this.rules.other.unicodeAlphaNumeric))
      return;
    if (!(r[1] || r[2] || "") || !n || this.rules.inline.punctuation.exec(n)) {
      let s = [...r[0]].length - 1, a, o, l = s, p = 0, c = r[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      for (c.lastIndex = 0, t = t.slice(-1 * e.length + s);(r = c.exec(t)) != null; ) {
        if (a = r[1] || r[2] || r[3] || r[4] || r[5] || r[6], !a)
          continue;
        if (o = [...a].length, r[3] || r[4]) {
          l += o;
          continue;
        } else if ((r[5] || r[6]) && s % 3 && !((s + o) % 3)) {
          p += o;
          continue;
        }
        if (l -= o, l > 0)
          continue;
        o = Math.min(o, o + l + p);
        let g = [...r[0]][0].length, h = e.slice(0, s + r.index + g + o);
        if (Math.min(s, o) % 2) {
          let f = h.slice(1, -1);
          return { type: "em", raw: h, text: f, tokens: this.lexer.inlineTokens(f) };
        }
        let R = h.slice(2, -2);
        return { type: "strong", raw: h, text: R, tokens: this.lexer.inlineTokens(R) };
      }
    }
  }
  codespan(e) {
    let t = this.rules.inline.code.exec(e);
    if (t) {
      let n = t[2].replace(this.rules.other.newLineCharGlobal, " "), r = this.rules.other.nonSpaceChar.test(n), i = this.rules.other.startingSpaceChar.test(n) && this.rules.other.endingSpaceChar.test(n);
      return r && i && (n = n.substring(1, n.length - 1)), { type: "codespan", raw: t[0], text: n };
    }
  }
  br(e) {
    let t = this.rules.inline.br.exec(e);
    if (t)
      return { type: "br", raw: t[0] };
  }
  del(e) {
    let t = this.rules.inline.del.exec(e);
    if (t)
      return { type: "del", raw: t[0], text: t[2], tokens: this.lexer.inlineTokens(t[2]) };
  }
  autolink(e) {
    let t = this.rules.inline.autolink.exec(e);
    if (t) {
      let n, r;
      return t[2] === "@" ? (n = t[1], r = "mailto:" + n) : (n = t[1], r = n), { type: "link", raw: t[0], text: n, href: r, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  url(e) {
    let t;
    if (t = this.rules.inline.url.exec(e)) {
      let n, r;
      if (t[2] === "@")
        n = t[0], r = "mailto:" + n;
      else {
        let i;
        do
          i = t[0], t[0] = this.rules.inline._backpedal.exec(t[0])?.[0] ?? "";
        while (i !== t[0]);
        n = t[0], t[1] === "www." ? r = "http://" + t[0] : r = t[0];
      }
      return { type: "link", raw: t[0], text: n, href: r, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  inlineText(e) {
    let t = this.rules.inline.text.exec(e);
    if (t) {
      let n = this.lexer.state.inRawBlock;
      return { type: "text", raw: t[0], text: t[0], escaped: n };
    }
  }
};
var x = class u {
  tokens;
  options;
  state;
  inlineQueue;
  tokenizer;
  constructor(e) {
    this.tokens = [], this.tokens.links = Object.create(null), this.options = e || T, this.options.tokenizer = this.options.tokenizer || new y, this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: false, inRawBlock: false, top: true };
    let t = { other: m, block: E.normal, inline: M.normal };
    this.options.pedantic ? (t.block = E.pedantic, t.inline = M.pedantic) : this.options.gfm && (t.block = E.gfm, this.options.breaks ? t.inline = M.breaks : t.inline = M.gfm), this.tokenizer.rules = t;
  }
  static get rules() {
    return { block: E, inline: M };
  }
  static lex(e, t) {
    return new u(t).lex(e);
  }
  static lexInline(e, t) {
    return new u(t).inlineTokens(e);
  }
  lex(e) {
    e = e.replace(m.carriageReturn, `
`), this.blockTokens(e, this.tokens);
    for (let t = 0;t < this.inlineQueue.length; t++) {
      let n = this.inlineQueue[t];
      this.inlineTokens(n.src, n.tokens);
    }
    return this.inlineQueue = [], this.tokens;
  }
  blockTokens(e, t = [], n = false) {
    for (this.options.pedantic && (e = e.replace(m.tabCharGlobal, "    ").replace(m.spaceLine, ""));e; ) {
      let r;
      if (this.options.extensions?.block?.some((s) => (r = s.call({ lexer: this }, e, t)) ? (e = e.substring(r.raw.length), t.push(r), true) : false))
        continue;
      if (r = this.tokenizer.space(e)) {
        e = e.substring(r.raw.length);
        let s = t.at(-1);
        r.raw.length === 1 && s !== undefined ? s.raw += `
` : t.push(r);
        continue;
      }
      if (r = this.tokenizer.code(e)) {
        e = e.substring(r.raw.length);
        let s = t.at(-1);
        s?.type === "paragraph" || s?.type === "text" ? (s.raw += (s.raw.endsWith(`
`) ? "" : `
`) + r.raw, s.text += `
` + r.text, this.inlineQueue.at(-1).src = s.text) : t.push(r);
        continue;
      }
      if (r = this.tokenizer.fences(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.heading(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.hr(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.blockquote(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.list(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.html(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.def(e)) {
        e = e.substring(r.raw.length);
        let s = t.at(-1);
        s?.type === "paragraph" || s?.type === "text" ? (s.raw += (s.raw.endsWith(`
`) ? "" : `
`) + r.raw, s.text += `
` + r.raw, this.inlineQueue.at(-1).src = s.text) : this.tokens.links[r.tag] || (this.tokens.links[r.tag] = { href: r.href, title: r.title }, t.push(r));
        continue;
      }
      if (r = this.tokenizer.table(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.lheading(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      let i = e;
      if (this.options.extensions?.startBlock) {
        let s = 1 / 0, a = e.slice(1), o;
        this.options.extensions.startBlock.forEach((l) => {
          o = l.call({ lexer: this }, a), typeof o == "number" && o >= 0 && (s = Math.min(s, o));
        }), s < 1 / 0 && s >= 0 && (i = e.substring(0, s + 1));
      }
      if (this.state.top && (r = this.tokenizer.paragraph(i))) {
        let s = t.at(-1);
        n && s?.type === "paragraph" ? (s.raw += (s.raw.endsWith(`
`) ? "" : `
`) + r.raw, s.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = s.text) : t.push(r), n = i.length !== e.length, e = e.substring(r.raw.length);
        continue;
      }
      if (r = this.tokenizer.text(e)) {
        e = e.substring(r.raw.length);
        let s = t.at(-1);
        s?.type === "text" ? (s.raw += (s.raw.endsWith(`
`) ? "" : `
`) + r.raw, s.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = s.text) : t.push(r);
        continue;
      }
      if (e) {
        let s = "Infinite loop on byte: " + e.charCodeAt(0);
        if (this.options.silent) {
          console.error(s);
          break;
        } else
          throw new Error(s);
      }
    }
    return this.state.top = true, t;
  }
  inline(e, t = []) {
    return this.inlineQueue.push({ src: e, tokens: t }), t;
  }
  inlineTokens(e, t = []) {
    let n = e, r = null;
    if (this.tokens.links) {
      let o = Object.keys(this.tokens.links);
      if (o.length > 0)
        for (;(r = this.tokenizer.rules.inline.reflinkSearch.exec(n)) != null; )
          o.includes(r[0].slice(r[0].lastIndexOf("[") + 1, -1)) && (n = n.slice(0, r.index) + "[" + "a".repeat(r[0].length - 2) + "]" + n.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex));
    }
    for (;(r = this.tokenizer.rules.inline.anyPunctuation.exec(n)) != null; )
      n = n.slice(0, r.index) + "++" + n.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    let i;
    for (;(r = this.tokenizer.rules.inline.blockSkip.exec(n)) != null; )
      i = r[2] ? r[2].length : 0, n = n.slice(0, r.index + i) + "[" + "a".repeat(r[0].length - i - 2) + "]" + n.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    n = this.options.hooks?.emStrongMask?.call({ lexer: this }, n) ?? n;
    let s = false, a = "";
    for (;e; ) {
      s || (a = ""), s = false;
      let o;
      if (this.options.extensions?.inline?.some((p) => (o = p.call({ lexer: this }, e, t)) ? (e = e.substring(o.raw.length), t.push(o), true) : false))
        continue;
      if (o = this.tokenizer.escape(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.tag(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.link(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.reflink(e, this.tokens.links)) {
        e = e.substring(o.raw.length);
        let p = t.at(-1);
        o.type === "text" && p?.type === "text" ? (p.raw += o.raw, p.text += o.text) : t.push(o);
        continue;
      }
      if (o = this.tokenizer.emStrong(e, n, a)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.codespan(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.br(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.del(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.autolink(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (!this.state.inLink && (o = this.tokenizer.url(e))) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      let l = e;
      if (this.options.extensions?.startInline) {
        let p = 1 / 0, c = e.slice(1), g;
        this.options.extensions.startInline.forEach((h) => {
          g = h.call({ lexer: this }, c), typeof g == "number" && g >= 0 && (p = Math.min(p, g));
        }), p < 1 / 0 && p >= 0 && (l = e.substring(0, p + 1));
      }
      if (o = this.tokenizer.inlineText(l)) {
        e = e.substring(o.raw.length), o.raw.slice(-1) !== "_" && (a = o.raw.slice(-1)), s = true;
        let p = t.at(-1);
        p?.type === "text" ? (p.raw += o.raw, p.text += o.text) : t.push(o);
        continue;
      }
      if (e) {
        let p = "Infinite loop on byte: " + e.charCodeAt(0);
        if (this.options.silent) {
          console.error(p);
          break;
        } else
          throw new Error(p);
      }
    }
    return t;
  }
};
var P = class {
  options;
  parser;
  constructor(e) {
    this.options = e || T;
  }
  space(e) {
    return "";
  }
  code({ text: e, lang: t, escaped: n }) {
    let r = (t || "").match(m.notSpaceStart)?.[0], i = e.replace(m.endingNewline, "") + `
`;
    return r ? '<pre><code class="language-' + w(r) + '">' + (n ? i : w(i, true)) + `</code></pre>
` : "<pre><code>" + (n ? i : w(i, true)) + `</code></pre>
`;
  }
  blockquote({ tokens: e }) {
    return `<blockquote>
${this.parser.parse(e)}</blockquote>
`;
  }
  html({ text: e }) {
    return e;
  }
  def(e) {
    return "";
  }
  heading({ tokens: e, depth: t }) {
    return `<h${t}>${this.parser.parseInline(e)}</h${t}>
`;
  }
  hr(e) {
    return `<hr>
`;
  }
  list(e) {
    let { ordered: t, start: n } = e, r = "";
    for (let a = 0;a < e.items.length; a++) {
      let o = e.items[a];
      r += this.listitem(o);
    }
    let i = t ? "ol" : "ul", s = t && n !== 1 ? ' start="' + n + '"' : "";
    return "<" + i + s + `>
` + r + "</" + i + `>
`;
  }
  listitem(e) {
    return `<li>${this.parser.parse(e.tokens)}</li>
`;
  }
  checkbox({ checked: e }) {
    return "<input " + (e ? 'checked="" ' : "") + 'disabled="" type="checkbox"> ';
  }
  paragraph({ tokens: e }) {
    return `<p>${this.parser.parseInline(e)}</p>
`;
  }
  table(e) {
    let t = "", n = "";
    for (let i = 0;i < e.header.length; i++)
      n += this.tablecell(e.header[i]);
    t += this.tablerow({ text: n });
    let r = "";
    for (let i = 0;i < e.rows.length; i++) {
      let s = e.rows[i];
      n = "";
      for (let a = 0;a < s.length; a++)
        n += this.tablecell(s[a]);
      r += this.tablerow({ text: n });
    }
    return r && (r = `<tbody>${r}</tbody>`), `<table>
<thead>
` + t + `</thead>
` + r + `</table>
`;
  }
  tablerow({ text: e }) {
    return `<tr>
${e}</tr>
`;
  }
  tablecell(e) {
    let t = this.parser.parseInline(e.tokens), n = e.header ? "th" : "td";
    return (e.align ? `<${n} align="${e.align}">` : `<${n}>`) + t + `</${n}>
`;
  }
  strong({ tokens: e }) {
    return `<strong>${this.parser.parseInline(e)}</strong>`;
  }
  em({ tokens: e }) {
    return `<em>${this.parser.parseInline(e)}</em>`;
  }
  codespan({ text: e }) {
    return `<code>${w(e, true)}</code>`;
  }
  br(e) {
    return "<br>";
  }
  del({ tokens: e }) {
    return `<del>${this.parser.parseInline(e)}</del>`;
  }
  link({ href: e, title: t, tokens: n }) {
    let r = this.parser.parseInline(n), i = X(e);
    if (i === null)
      return r;
    e = i;
    let s = '<a href="' + e + '"';
    return t && (s += ' title="' + w(t) + '"'), s += ">" + r + "</a>", s;
  }
  image({ href: e, title: t, text: n, tokens: r }) {
    r && (n = this.parser.parseInline(r, this.parser.textRenderer));
    let i = X(e);
    if (i === null)
      return w(n);
    e = i;
    let s = `<img src="${e}" alt="${n}"`;
    return t && (s += ` title="${w(t)}"`), s += ">", s;
  }
  text(e) {
    return "tokens" in e && e.tokens ? this.parser.parseInline(e.tokens) : ("escaped" in e) && e.escaped ? e.text : w(e.text);
  }
};
var $ = class {
  strong({ text: e }) {
    return e;
  }
  em({ text: e }) {
    return e;
  }
  codespan({ text: e }) {
    return e;
  }
  del({ text: e }) {
    return e;
  }
  html({ text: e }) {
    return e;
  }
  text({ text: e }) {
    return e;
  }
  link({ text: e }) {
    return "" + e;
  }
  image({ text: e }) {
    return "" + e;
  }
  br() {
    return "";
  }
  checkbox({ raw: e }) {
    return e;
  }
};
var b = class u2 {
  options;
  renderer;
  textRenderer;
  constructor(e) {
    this.options = e || T, this.options.renderer = this.options.renderer || new P, this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new $;
  }
  static parse(e, t) {
    return new u2(t).parse(e);
  }
  static parseInline(e, t) {
    return new u2(t).parseInline(e);
  }
  parse(e) {
    let t = "";
    for (let n = 0;n < e.length; n++) {
      let r = e[n];
      if (this.options.extensions?.renderers?.[r.type]) {
        let s = r, a = this.options.extensions.renderers[s.type].call({ parser: this }, s);
        if (a !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "def", "paragraph", "text"].includes(s.type)) {
          t += a || "";
          continue;
        }
      }
      let i = r;
      switch (i.type) {
        case "space": {
          t += this.renderer.space(i);
          break;
        }
        case "hr": {
          t += this.renderer.hr(i);
          break;
        }
        case "heading": {
          t += this.renderer.heading(i);
          break;
        }
        case "code": {
          t += this.renderer.code(i);
          break;
        }
        case "table": {
          t += this.renderer.table(i);
          break;
        }
        case "blockquote": {
          t += this.renderer.blockquote(i);
          break;
        }
        case "list": {
          t += this.renderer.list(i);
          break;
        }
        case "checkbox": {
          t += this.renderer.checkbox(i);
          break;
        }
        case "html": {
          t += this.renderer.html(i);
          break;
        }
        case "def": {
          t += this.renderer.def(i);
          break;
        }
        case "paragraph": {
          t += this.renderer.paragraph(i);
          break;
        }
        case "text": {
          t += this.renderer.text(i);
          break;
        }
        default: {
          let s = 'Token with "' + i.type + '" type was not found.';
          if (this.options.silent)
            return console.error(s), "";
          throw new Error(s);
        }
      }
    }
    return t;
  }
  parseInline(e, t = this.renderer) {
    let n = "";
    for (let r = 0;r < e.length; r++) {
      let i = e[r];
      if (this.options.extensions?.renderers?.[i.type]) {
        let a = this.options.extensions.renderers[i.type].call({ parser: this }, i);
        if (a !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(i.type)) {
          n += a || "";
          continue;
        }
      }
      let s = i;
      switch (s.type) {
        case "escape": {
          n += t.text(s);
          break;
        }
        case "html": {
          n += t.html(s);
          break;
        }
        case "link": {
          n += t.link(s);
          break;
        }
        case "image": {
          n += t.image(s);
          break;
        }
        case "checkbox": {
          n += t.checkbox(s);
          break;
        }
        case "strong": {
          n += t.strong(s);
          break;
        }
        case "em": {
          n += t.em(s);
          break;
        }
        case "codespan": {
          n += t.codespan(s);
          break;
        }
        case "br": {
          n += t.br(s);
          break;
        }
        case "del": {
          n += t.del(s);
          break;
        }
        case "text": {
          n += t.text(s);
          break;
        }
        default: {
          let a = 'Token with "' + s.type + '" type was not found.';
          if (this.options.silent)
            return console.error(a), "";
          throw new Error(a);
        }
      }
    }
    return n;
  }
};
var S = class {
  options;
  block;
  constructor(e) {
    this.options = e || T;
  }
  static passThroughHooks = new Set(["preprocess", "postprocess", "processAllTokens", "emStrongMask"]);
  static passThroughHooksRespectAsync = new Set(["preprocess", "postprocess", "processAllTokens"]);
  preprocess(e) {
    return e;
  }
  postprocess(e) {
    return e;
  }
  processAllTokens(e) {
    return e;
  }
  emStrongMask(e) {
    return e;
  }
  provideLexer() {
    return this.block ? x.lex : x.lexInline;
  }
  provideParser() {
    return this.block ? b.parse : b.parseInline;
  }
};
var B = class {
  defaults = L();
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = b;
  Renderer = P;
  TextRenderer = $;
  Lexer = x;
  Tokenizer = y;
  Hooks = S;
  constructor(...e) {
    this.use(...e);
  }
  walkTokens(e, t) {
    let n = [];
    for (let r of e)
      switch (n = n.concat(t.call(this, r)), r.type) {
        case "table": {
          let i = r;
          for (let s of i.header)
            n = n.concat(this.walkTokens(s.tokens, t));
          for (let s of i.rows)
            for (let a of s)
              n = n.concat(this.walkTokens(a.tokens, t));
          break;
        }
        case "list": {
          let i = r;
          n = n.concat(this.walkTokens(i.items, t));
          break;
        }
        default: {
          let i = r;
          this.defaults.extensions?.childTokens?.[i.type] ? this.defaults.extensions.childTokens[i.type].forEach((s) => {
            let a = i[s].flat(1 / 0);
            n = n.concat(this.walkTokens(a, t));
          }) : i.tokens && (n = n.concat(this.walkTokens(i.tokens, t)));
        }
      }
    return n;
  }
  use(...e) {
    let t = this.defaults.extensions || { renderers: {}, childTokens: {} };
    return e.forEach((n) => {
      let r = { ...n };
      if (r.async = this.defaults.async || r.async || false, n.extensions && (n.extensions.forEach((i) => {
        if (!i.name)
          throw new Error("extension name required");
        if ("renderer" in i) {
          let s = t.renderers[i.name];
          s ? t.renderers[i.name] = function(...a) {
            let o = i.renderer.apply(this, a);
            return o === false && (o = s.apply(this, a)), o;
          } : t.renderers[i.name] = i.renderer;
        }
        if ("tokenizer" in i) {
          if (!i.level || i.level !== "block" && i.level !== "inline")
            throw new Error("extension level must be 'block' or 'inline'");
          let s = t[i.level];
          s ? s.unshift(i.tokenizer) : t[i.level] = [i.tokenizer], i.start && (i.level === "block" ? t.startBlock ? t.startBlock.push(i.start) : t.startBlock = [i.start] : i.level === "inline" && (t.startInline ? t.startInline.push(i.start) : t.startInline = [i.start]));
        }
        "childTokens" in i && i.childTokens && (t.childTokens[i.name] = i.childTokens);
      }), r.extensions = t), n.renderer) {
        let i = this.defaults.renderer || new P(this.defaults);
        for (let s in n.renderer) {
          if (!(s in i))
            throw new Error(`renderer '${s}' does not exist`);
          if (["options", "parser"].includes(s))
            continue;
          let a = s, o = n.renderer[a], l = i[a];
          i[a] = (...p) => {
            let c = o.apply(i, p);
            return c === false && (c = l.apply(i, p)), c || "";
          };
        }
        r.renderer = i;
      }
      if (n.tokenizer) {
        let i = this.defaults.tokenizer || new y(this.defaults);
        for (let s in n.tokenizer) {
          if (!(s in i))
            throw new Error(`tokenizer '${s}' does not exist`);
          if (["options", "rules", "lexer"].includes(s))
            continue;
          let a = s, o = n.tokenizer[a], l = i[a];
          i[a] = (...p) => {
            let c = o.apply(i, p);
            return c === false && (c = l.apply(i, p)), c;
          };
        }
        r.tokenizer = i;
      }
      if (n.hooks) {
        let i = this.defaults.hooks || new S;
        for (let s in n.hooks) {
          if (!(s in i))
            throw new Error(`hook '${s}' does not exist`);
          if (["options", "block"].includes(s))
            continue;
          let a = s, o = n.hooks[a], l = i[a];
          S.passThroughHooks.has(s) ? i[a] = (p) => {
            if (this.defaults.async && S.passThroughHooksRespectAsync.has(s))
              return (async () => {
                let g = await o.call(i, p);
                return l.call(i, g);
              })();
            let c = o.call(i, p);
            return l.call(i, c);
          } : i[a] = (...p) => {
            if (this.defaults.async)
              return (async () => {
                let g = await o.apply(i, p);
                return g === false && (g = await l.apply(i, p)), g;
              })();
            let c = o.apply(i, p);
            return c === false && (c = l.apply(i, p)), c;
          };
        }
        r.hooks = i;
      }
      if (n.walkTokens) {
        let i = this.defaults.walkTokens, s = n.walkTokens;
        r.walkTokens = function(a) {
          let o = [];
          return o.push(s.call(this, a)), i && (o = o.concat(i.call(this, a))), o;
        };
      }
      this.defaults = { ...this.defaults, ...r };
    }), this;
  }
  setOptions(e) {
    return this.defaults = { ...this.defaults, ...e }, this;
  }
  lexer(e, t) {
    return x.lex(e, t ?? this.defaults);
  }
  parser(e, t) {
    return b.parse(e, t ?? this.defaults);
  }
  parseMarkdown(e) {
    return (n, r) => {
      let i = { ...r }, s = { ...this.defaults, ...i }, a = this.onError(!!s.silent, !!s.async);
      if (this.defaults.async === true && i.async === false)
        return a(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof n > "u" || n === null)
        return a(new Error("marked(): input parameter is undefined or null"));
      if (typeof n != "string")
        return a(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(n) + ", string expected"));
      if (s.hooks && (s.hooks.options = s, s.hooks.block = e), s.async)
        return (async () => {
          let o = s.hooks ? await s.hooks.preprocess(n) : n, p = await (s.hooks ? await s.hooks.provideLexer() : e ? x.lex : x.lexInline)(o, s), c = s.hooks ? await s.hooks.processAllTokens(p) : p;
          s.walkTokens && await Promise.all(this.walkTokens(c, s.walkTokens));
          let h = await (s.hooks ? await s.hooks.provideParser() : e ? b.parse : b.parseInline)(c, s);
          return s.hooks ? await s.hooks.postprocess(h) : h;
        })().catch(a);
      try {
        s.hooks && (n = s.hooks.preprocess(n));
        let l = (s.hooks ? s.hooks.provideLexer() : e ? x.lex : x.lexInline)(n, s);
        s.hooks && (l = s.hooks.processAllTokens(l)), s.walkTokens && this.walkTokens(l, s.walkTokens);
        let c = (s.hooks ? s.hooks.provideParser() : e ? b.parse : b.parseInline)(l, s);
        return s.hooks && (c = s.hooks.postprocess(c)), c;
      } catch (o) {
        return a(o);
      }
    };
  }
  onError(e, t) {
    return (n) => {
      if (n.message += `
Please report this to https://github.com/markedjs/marked.`, e) {
        let r = "<p>An error occurred:</p><pre>" + w(n.message + "", true) + "</pre>";
        return t ? Promise.resolve(r) : r;
      }
      if (t)
        return Promise.reject(n);
      throw n;
    };
  }
};
var _ = new B;
function d(u3, e) {
  return _.parse(u3, e);
}
d.options = d.setOptions = function(u3) {
  return _.setOptions(u3), d.defaults = _.defaults, Z(d.defaults), d;
};
d.getDefaults = L;
d.defaults = T;
d.use = function(...u3) {
  return _.use(...u3), d.defaults = _.defaults, Z(d.defaults), d;
};
d.walkTokens = function(u3, e) {
  return _.walkTokens(u3, e);
};
d.parseInline = _.parseInline;
d.Parser = b;
d.parser = b.parse;
d.Renderer = P;
d.TextRenderer = $;
d.Lexer = x;
d.lexer = x.lex;
d.Tokenizer = y;
d.Hooks = S;
d.parse = d;
var Dt = d.options;
var Ht = d.setOptions;
var Zt = d.use;
var Gt = d.walkTokens;
var Nt = d.parseInline;
var Ft = b.parse;
var jt = x.lex;

// src/server/knowledge-mode.ts
function enterpriseKnowledgeEnabled(env = process.env) {
  const backend = env.KNOWLEDGE_STORAGE_BACKEND?.trim().toLowerCase();
  if (backend && !["sqlite", "arangodb"].includes(backend)) {
    throw new Error("KNOWLEDGE_STORAGE_BACKEND must be sqlite or arangodb");
  }
  return backend ? backend === "arangodb" : Boolean(env.ARANGO_URL?.trim());
}

// src/server/video-cover-pairing.ts
var cleanSlots = (values) => (Array.isArray(values) ? values : []).map((value) => String(value ?? "").trim());
function appendVideoCoverPairs(existingVideos, existingCovers, incomingVideos, incomingCovers) {
  const videos = cleanSlots(existingVideos).filter(Boolean);
  const covers = cleanSlots(existingCovers).slice(0, videos.length);
  while (covers.length < videos.length)
    covers.push("");
  const nextVideos = cleanSlots(incomingVideos);
  const nextCovers = cleanSlots(incomingCovers);
  for (let index = 0;index < nextVideos.length; index += 1) {
    const video = nextVideos[index];
    if (!video)
      continue;
    const cover = nextCovers[index] || "";
    const existingIndex = videos.indexOf(video);
    if (existingIndex >= 0) {
      if (cover)
        covers[existingIndex] = cover;
      continue;
    }
    videos.push(video);
    covers.push(cover);
  }
  return { videos, covers };
}

// src/shared/knowledge-media.ts
var decode = (value) => {
  if (typeof value !== "string")
    return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
function list(value) {
  const parsed = decode(value);
  return (Array.isArray(parsed) ? parsed : parsed == null ? [] : [parsed]).map((item) => typeof item === "string" ? item.trim() : String(item?.url || item?.src || "").trim());
}
function knowledgeMedia(node, attributes = []) {
  const parsed = decode(node.data);
  const data = parsed && typeof parsed === "object" ? parsed : {};
  const merge = (field, singular) => [...new Set([
    ...list(node[field]),
    ...list(node[singular]),
    ...list(data[field]),
    ...list(data[singular])
  ].filter(Boolean))];
  const images = merge("images", "image"), videos = merge("videos", "video");
  const imagePattern = /\.(jpe?g|png|gif|webp|avif|bmp|svg|heic)(?:[?#].*)?$|^data:image\/|\/node-images\//i;
  const videoPattern = /\.(mp4|webm|ogg|m4v|mov)(?:[?#].*)?$|^data:video\/|\/node-videos\//i;
  for (const attribute of attributes) {
    const values = list(attribute.value ?? attribute.attribute?.value ?? attribute.value_text);
    for (const value of values.filter(Boolean)) {
      if (imagePattern.test(value) && !images.includes(value))
        images.push(value);
      if (videoPattern.test(value) && !videos.includes(value))
        videos.push(value);
    }
  }
  const covers = list(node.covers).length ? list(node.covers) : list(data.covers).length ? list(data.covers) : list(node.cover || data.cover);
  return { images, videos, covers };
}

// src/server/enterprise-knowledge.ts
import { randomUUID as randomUUID2 } from "crypto";

// src/server/arangodb.ts
import { createHash as createHash2, randomUUID } from "crypto";

// src/shared/geography.ts
function earthPoint(value) {
  if (!value || typeof value !== "object")
    return null;
  const { latitude, longitude, globe } = value;
  if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
    return null;
  if (globe && !["earth", "Q2", "http://www.wikidata.org/entity/Q2", "https://www.wikidata.org/entity/Q2"].includes(globe))
    return null;
  return { type: "Point", coordinates: [longitude, latitude] };
}
function attributeEarthPoint(value, datatype = "") {
  return ["globe-coordinate", "globecoordinate"].includes(datatype.toLowerCase()) ? earthPoint(value) : null;
}

// src/server/arangodb.ts
function configFromEnvironment() {
  const url = process.env.ARANGO_URL?.trim();
  const username = process.env.ARANGO_USERNAME?.trim();
  const password = process.env.ARANGO_PASSWORD;
  if (!url && !username && !password)
    return null;
  if (!url || !username || !password) {
    throw new Error("Enterprise ArangoDB configuration requires ARANGO_URL, ARANGO_USERNAME, and ARANGO_PASSWORD");
  }
  return { url: url.replace(/\/+$/, ""), username, password };
}

class ArangoClient {
  config;
  request;
  authorization;
  constructor(config, request = fetch) {
    this.config = config;
    this.request = request;
    this.authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
  }
  async system(path, init = {}) {
    return this.send(`${this.config.url}/_db/_system${path}`, init);
  }
  async database(database, path, init = {}) {
    return this.send(`${this.config.url}/_db/${encodeURIComponent(database)}${path}`, init);
  }
  async user(path, init = {}) {
    return this.send(`${this.config.url}/_api/user${path}`, init);
  }
  async send(url, init) {
    let response;
    try {
      response = await this.request(url, {
        ...init,
        headers: {
          Authorization: this.authorization,
          ...init.body instanceof Blob ? {} : { "Content-Type": "application/json" },
          ...init.headers
        },
        signal: init.signal || AbortSignal.timeout(30000)
      });
    } catch (error) {
      throw new Error(`ArangoDB request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    if (!response.ok) {
      const detail = body?.errorMessage || body?.message || response.statusText;
      throw Object.assign(new Error(`ArangoDB HTTP ${response.status}: ${detail || "request failed"} (${init.method || "GET"} ${new URL(url).pathname})`), {
        status: response.status,
        body
      });
    }
    return { response, body };
  }
}
function arangoDatabaseName(projectName) {
  const name = String(projectName || "").trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(name)) {
    throw new Error(`Project name "${name}" cannot be used as an ArangoDB database name; use 1\u201364 letters, digits, underscores, or hyphens, starting with a letter`);
  }
  return name;
}
function elasticsearchEntityIndexName(projectName) {
  const name = String(projectName || "").trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(name)) {
    throw new Error(`Project name "${name}" cannot be used to create an Elasticsearch entity index`);
  }
  return `entity-${name.toLowerCase().replace(/_/g, "-")}`;
}
function documentKey(id) {
  return createHash2("sha256").update(String(id)).digest("hex");
}
function parseJson(value) {
  if (typeof value !== "string" || !value)
    return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
function parseLocalizedInput(value) {
  const parsed = parseJson(value);
  return typeof value === "string" && (parsed === null || typeof parsed !== "object") ? value : parsed;
}
function localizedEntry(value, language) {
  if (typeof value === "string") {
    const text2 = value.trim();
    return text2 ? { language, value: text2 } : null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    return null;
  const entry = value;
  const text = String(entry.value ?? "").trim();
  if (!text)
    return null;
  const entryLanguage = String(entry.language || language).trim() || language;
  return { language: entryLanguage, value: text };
}
function localizedValueMap(raw, defaultLanguage = "zh") {
  const parsed = parseLocalizedInput(raw);
  const result = {};
  const add = (value, language) => {
    const entry = localizedEntry(value, language);
    if (entry)
      result[entry.language] = entry;
  };
  if (typeof parsed === "string") {
    add(parsed, defaultLanguage);
  } else if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const record = item;
        if ("value" in record)
          add(record, defaultLanguage);
      }
    }
  } else if (parsed && typeof parsed === "object") {
    const record = parsed;
    if ("value" in record) {
      add(record, defaultLanguage);
    } else {
      for (const [language, value] of Object.entries(record))
        add(value, language);
    }
  }
  return result;
}
function localizedAliasMap(raw, defaultLanguage = "zh") {
  const parsed = parseLocalizedInput(raw);
  const result = {};
  const seen = new Set;
  const add = (value, language) => {
    const entry = localizedEntry(value, language);
    if (!entry)
      return;
    const key = `${entry.language}\x00${entry.value}`;
    if (seen.has(key))
      return;
    seen.add(key);
    (result[entry.language] ||= []).push(entry);
  };
  if (typeof parsed === "string") {
    add(parsed, defaultLanguage);
  } else if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (typeof item === "string") {
        add(item, defaultLanguage);
      } else if (item && typeof item === "object" && !Array.isArray(item)) {
        const record = item;
        if ("value" in record)
          add(record, defaultLanguage);
        else {
          for (const [language, values] of Object.entries(record)) {
            if (Array.isArray(values))
              values.forEach((value) => add(value, language));
            else
              add(values, language);
          }
        }
      }
    }
  } else if (parsed && typeof parsed === "object") {
    const record = parsed;
    if ("value" in record) {
      add(record, defaultLanguage);
    } else {
      for (const [language, values] of Object.entries(record)) {
        if (Array.isArray(values))
          values.forEach((value) => add(value, language));
        else
          add(values, language);
      }
    }
  }
  return result;
}
function referencedEntityIds(value) {
  if (Array.isArray(value))
    return value.flatMap(referencedEntityIds);
  if (!value || typeof value !== "object")
    return [];
  const object = value;
  const id = object.id ?? object.entity_id ?? object.entityId ?? object["entity-id"];
  const normalized = String(id ?? "").trim().replace(/^entity\//, "");
  const nested = object.value === undefined ? [] : referencedEntityIds(object.value);
  return normalized ? [normalized, ...nested] : nested;
}
function entityDocument(node, syncVersion, classIds = []) {
  const { name, description, aliases, ...fields } = node;
  const labels = localizedValueMap(name), descriptions = localizedValueMap(description), aliasMap = localizedAliasMap(aliases);
  return {
    ...fields,
    _key: documentKey(fields.id),
    sqlite_id: String(fields.id),
    class_ids: classIds,
    labels,
    descriptions,
    aliases: aliasMap,
    search_text: [...Object.values(labels), ...Object.values(descriptions), ...Object.values(aliasMap).flat()].map((value) => value?.value || "").join(" "),
    created_at_sort: sortableDate(fields.created_at),
    updated_at_sort: sortableDate(fields.updated_at || fields.created_at),
    ...syncVersion ? { sync_version: syncVersion } : {}
  };
}
function sortableDate(value) {
  const raw = String(value ?? "").trim();
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : raw;
}
function elasticsearchNotFound(error) {
  return Boolean(error && typeof error === "object" && "status" in error && error.status === 404);
}
async function ensureElasticsearchEntityIndex(client, projectName, preserveExisting = false) {
  const index = elasticsearchEntityIndexName(projectName);
  let recreate = false;
  try {
    await client.send(`/${encodeURIComponent(index)}`, { method: "HEAD" });
  } catch (error) {
    if (!elasticsearchNotFound(error))
      throw error;
    recreate = true;
  }
  if (!recreate && preserveExisting)
    return index;
  if (!recreate) {
    const { body } = await client.send(`/${encodeURIComponent(index)}/_mapping`);
    const mapping = body?.[index]?.mappings;
    recreate = mapping?.dynamic !== "false" || mapping?._meta?.entitySyncSchema !== 3;
  }
  if (recreate) {
    try {
      await client.send(`/${encodeURIComponent(index)}`, { method: "DELETE" });
    } catch (error) {
      if (!elasticsearchNotFound(error))
        throw error;
    }
    await client.send(`/${encodeURIComponent(index)}`, {
      method: "PUT",
      body: JSON.stringify({
        mappings: {
          _meta: { entitySyncSchema: 3 },
          dynamic: "false",
          properties: {
            id: { type: "keyword" },
            sqlite_id: { type: "keyword" },
            type: { type: "keyword" },
            class_ids: { type: "keyword" },
            project_id: { type: "long" },
            created_at_sort: { type: "keyword" },
            updated_at_sort: { type: "keyword" },
            labels: {
              type: "object",
              dynamic: true,
              properties: {
                language: { type: "keyword" },
                value: { type: "text", fields: { keyword: { type: "keyword", ignore_above: 256 } } }
              }
            },
            descriptions: {
              type: "object",
              dynamic: true,
              properties: {
                language: { type: "keyword" },
                value: { type: "text", fields: { keyword: { type: "keyword", ignore_above: 256 } } }
              }
            },
            aliases: {
              type: "object",
              dynamic: true,
              properties: {
                language: { type: "keyword" },
                value: { type: "text", fields: { keyword: { type: "keyword", ignore_above: 256 } } }
              }
            }
          }
        }
      })
    });
  }
  return index;
}
function claimStatement(attribute) {
  const parsed = parseJson(attribute.statement_json);
  const statement = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const datatype = String(statement.mainsnak?.datatype || statement.datatype || attribute.datatype || "").toLowerCase();
  const normalizedDatatype = datatype === "wikibase-entityid" ? "wikibase-item" : datatype;
  const value = parseJson(attribute.value);
  const snaktype = statement.mainsnak?.snaktype || statement.snaktype || "value";
  const datavalue = statement.mainsnak?.datavalue || statement.datavalue || (snaktype === "value" ? { type: attribute.datatype || normalizedDatatype, value } : undefined);
  const mainsnak = statement.mainsnak || {
    snaktype,
    property: statement.property || attribute.key,
    datatype: normalizedDatatype,
    ...datavalue ? { datavalue } : {}
  };
  return {
    id: statement.id || attribute.id,
    mainsnak,
    type: statement.type || "statement",
    rank: statement.rank || "normal",
    qualifiers: statement.qualifiers || {},
    ...statement["qualifiers-order"] ? { "qualifiers-order": statement["qualifiers-order"] } : {},
    references: statement.references || [],
    datatype: normalizedDatatype,
    value
  };
}
function edgeDocuments(node, attributes, syncVersion) {
  const edges = [];
  const sourceKey = documentKey(node.id);
  for (const attribute of attributes) {
    const claim = claimStatement(attribute);
    const isEntityRelation = claim.datatype === "wikibase-item";
    const datavalue = claim.mainsnak?.datavalue;
    const claimValues = datavalue?.value === undefined ? [claim.value] : Array.isArray(datavalue.value) ? datavalue.value : [datavalue.value];
    for (const [valueIndex, value] of claimValues.entries()) {
      const geo = attributeEarthPoint(value, claim.datatype);
      const valueClaim = {
        ...claim,
        mainsnak: datavalue ? { ...claim.mainsnak, datavalue: { ...datavalue, value } } : claim.mainsnak,
        value
      };
      const targets = isEntityRelation ? referencedEntityIds(value) : [];
      const destinations = targets.length ? targets : [null];
      for (const [targetIndex, target] of destinations.entries()) {
        const targetKey = target ? documentKey(target) : sourceKey;
        const edgeDiscriminator = claimValues.length === 1 && destinations.length === 1 ? `${attribute.id}\x00${targetKey}` : `${attribute.id}\x00${valueIndex}\x00${targetKey}\x00${targetIndex}`;
        edges.push({
          _key: documentKey(edgeDiscriminator),
          _from: `entity/${sourceKey}`,
          _to: `entity/${targetKey}`,
          sqlite_id: String(attribute.id),
          source_id: String(node.id),
          target_id: target || String(node.id),
          property_id: String(claim.mainsnak?.property || attribute.key || ""),
          property_name: attribute.property_name_snapshot || "",
          ...valueClaim,
          attribute: { ...attribute },
          ...geo ? { geo } : {},
          ...syncVersion ? { sync_version: syncVersion } : {}
        });
      }
    }
  }
  return edges;
}
async function createDatabase(client, projectName) {
  const name = arangoDatabaseName(projectName);
  const { response } = await client.system("/_api/database", {
    method: "POST",
    body: JSON.stringify({ name })
  }).catch(async (error) => {
    if (error?.status === 409)
      return { response: null };
    throw error;
  });
  if (!response)
    return name;
  return name;
}
async function ensureCollection(client, dbName, name, type) {
  const path = `/_api/collection/${encodeURIComponent(name)}`;
  try {
    await client.database(dbName, path, { method: "GET" });
    return;
  } catch (error) {
    if (error?.status !== 404)
      throw error;
  }
  await client.database(dbName, "/_api/collection", {
    method: "POST",
    body: JSON.stringify({ name, type })
  }).catch((error) => {
    if (error?.status !== 409)
      throw error;
  });
}
async function ensureGraph(client, dbName) {
  try {
    await client.database(dbName, "/_api/gharial/graph");
    return;
  } catch (error) {
    if (error?.status !== 404)
      throw error;
  }
  await client.database(dbName, "/_api/gharial", {
    method: "POST",
    body: JSON.stringify({
      name: "graph",
      edgeDefinitions: [{ collection: "link", from: ["entity"], to: ["entity"] }]
    })
  }).catch((error) => {
    if (error?.status !== 409)
      throw error;
  });
}
async function ensureView(client, dbName) {
  const properties = {
    links: { entity: { includeAllFields: true } }
  };
  try {
    await client.database(dbName, "/_api/view/entity_view/properties");
    await client.database(dbName, "/_api/view/entity_view/properties", {
      method: "PUT",
      body: JSON.stringify(properties)
    });
    return;
  } catch (error) {
    if (error?.status !== 404)
      throw error;
  }
  await client.database(dbName, "/_api/view", {
    method: "POST",
    body: JSON.stringify({ name: "entity_view", type: "arangosearch", ...properties })
  }).catch((error) => {
    if (error?.status !== 409)
      throw error;
  });
}
async function ensureApplicationDatabase(client, projectName) {
  const dbName = await createDatabase(client, projectName);
  await ensureCollection(client, dbName, "entity", 2);
  await ensureCollection(client, dbName, "link", 3);
  await ensureGraph(client, dbName);
  await ensureView(client, dbName);
  return dbName;
}

// src/shared/entity-taxonomy.ts
function cleanId(value) {
  if (value === null || value === undefined || value === "")
    return null;
  if (typeof value !== "string")
    throw new TypeError("typeId \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6216 null");
  return value.trim() || null;
}
function cleanList(value, field, max) {
  if (!Array.isArray(value))
    throw new TypeError(`${field} \u5FC5\u987B\u662F\u6570\u7EC4`);
  if (value.length > max)
    throw new RangeError(`${field} \u6700\u591A\u5141\u8BB8 ${max} \u9879`);
  const result = [];
  const seen = new Set;
  for (const raw of value) {
    if (typeof raw !== "string")
      throw new TypeError(`${field} \u53EA\u80FD\u5305\u542B\u5B57\u7B26\u4E32`);
    const item = raw.trim();
    if (!item)
      continue;
    const key = item.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}
function normalizeEntityTaxonomy(input) {
  const hasType = Object.prototype.hasOwnProperty.call(input, "typeId") || Object.prototype.hasOwnProperty.call(input, "type");
  const hasCategories = Object.prototype.hasOwnProperty.call(input, "categoryIds") || Object.prototype.hasOwnProperty.call(input, "categories");
  const hasTags = Object.prototype.hasOwnProperty.call(input, "tags");
  return {
    hasType,
    typeId: hasType ? cleanId(input.typeId !== undefined ? input.typeId : input.type) : null,
    hasCategories,
    categoryIds: hasCategories ? cleanList(input.categoryIds !== undefined ? input.categoryIds : input.categories, "categoryIds", 100) : [],
    hasTags,
    tags: hasTags ? cleanList(input.tags, "tags", 100) : []
  };
}

// src/shared/wikidata.ts
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
      throw new Error("\u65F6\u95F4\u503C\u5FC5\u987B\u5305\u542B time \u548C precision");
    if (value.time) {
      if (!/^[+-]\d{4,}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value.time))
        throw new Error("Wikibase time \u683C\u5F0F\u65E0\u6548");
      return { timezone: 0, before: 0, after: 0, precision: 11, calendarmodel: "http://www.wikidata.org/entity/Q1985727", ...value };
    }
    const date = String(value.date || "");
    if (!date)
      throw new Error("\u65F6\u95F4\u503C\u7F3A\u5C11 time");
    const { date: _date, ...rest } = value;
    return { ...parseTimeValue(date), ...rest };
  }
  if (dt === "quantity") {
    if (!value || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(value.amount ?? "")))
      throw new Error("\u6570\u91CF\u683C\u5F0F\u65E0\u6548");
    return { ...value, amount: String(value.amount), unit: value.unit || "1" };
  }
  if (dt === "globe-coordinate") {
    if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) || Math.abs(value.latitude) > 90 || Math.abs(value.longitude) > 180)
      throw new Error("\u7ECF\u7EAC\u5EA6\u8D85\u51FA\u6709\u6548\u8303\u56F4");
    return { altitude: null, precision: null, globe: "http://www.wikidata.org/entity/Q2", ...value };
  }
  if (valueTypeFor(dt) === "wikibase-entityid") {
    if (!value || typeof value !== "object" || !String(value.id || "").trim())
      throw new Error("\u5B9E\u4F53\u5F15\u7528\u5FC5\u987B\u5305\u542B id");
    const entityType = dt.slice("wikibase-".length);
    return { ...value, "entity-type": entityType };
  }
  if (dt === "monolingualtext") {
    if (!value || typeof value.text !== "string" || !value.language)
      throw new Error("\u5355\u8BED\u6587\u672C\u5FC5\u987B\u5305\u542B text \u548C language");
    return value;
  }
  if (typeof value !== "string")
    throw new Error("\u8BE5\u6570\u636E\u7C7B\u578B\u7684\u503C\u5FC5\u987B\u662F\u5B57\u7B26\u4E32");
  return value;
}
function normalizeStatement(input, previous = {}) {
  const datatype = normalizeDatatype(input.datatype || previous.datatype);
  if (!datatypeValueTypes[datatype])
    throw new Error("\u4E0D\u652F\u6301\u7684\u6570\u636E\u7C7B\u578B");
  const snaktype = input.snaktype || previous.snaktype || "value";
  if (!["value", "somevalue", "novalue"].includes(snaktype))
    throw new Error("\u65E0\u6548\u7684\u503C\u72B6\u6001");
  const rank = input.rank ?? previous.rank ?? "normal";
  if (!["normal", "preferred", "deprecated"].includes(rank))
    throw new Error("\u65E0\u6548\u7684 rank");
  const qualifiers = input.qualifiers ?? previous.qualifiers ?? {};
  const references = input.references ?? previous.references ?? [];
  if (!qualifiers || typeof qualifiers !== "object" || Array.isArray(qualifiers) || !Array.isArray(references))
    throw new Error("\u9650\u5B9A\u7B26\u6216\u6765\u6E90\u683C\u5F0F\u65E0\u6548");
  const result = { property: input.property || previous.property, datatype, snaktype, rank, qualifiers, references };
  if (snaktype === "value") {
    if (input.datavalue?.type && input.datavalue.type !== valueTypeFor(datatype))
      throw new Error("\u6570\u503C\u7C7B\u578B\u4E0E\u6570\u636E\u7C7B\u578B\u4E0D\u5339\u914D");
    result.datavalue = { type: valueTypeFor(datatype), value: normalizeValue(datatype, input.datavalue?.value ?? input.value) };
  }
  return result;
}
function parseTimeValue(input) {
  let text = String(input || "").trim().normalize("NFKC").replace(/\u5E74|\u6708/g, "-").replace(/[\u65E5\u53F7]/g, " ").replace(/\u65F6|\u70B9/g, ":").replace(/\u5206/g, ":").replace(/\u79D2/g, "").trim().replace(/[-:]$/, "");
  text = text.replace(/^(\d{4})(\d{2})(\d{2})(?=$|[ T])/, "$1-$2-$3");
  const match = text.match(/^([+-]?\d{4,})[-/.]?(?:(\d{1,2})(?:[-/.](\d{1,2}))?)?(?:[ T]+(\d{1,2}):(\d{1,2})(?::(\d{1,2})(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?)?$/i);
  if (!match)
    throw new Error("\u65F6\u95F4\u683C\u5F0F\u65E0\u6548");
  const [, y2 = "", m2, d2, h, min, sec, fraction, zone] = match;
  const year = Number(y2), month = Number(m2 || 1), day = Number(d2 || 1);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || h !== undefined && (!d2 || Number(h) > 23 || Number(min) > 59 || Number(sec || 0) > 59))
    throw new Error("\u65F6\u95F4\u8D85\u51FA\u6709\u6548\u8303\u56F4");
  const pad = (v2) => String(v2).padStart(2, "0");
  let timezone = 0;
  if (zone && zone.toUpperCase() !== "Z") {
    const offset = zone.slice(1).replace(":", "");
    const hours = Number(offset.slice(0, 2)), minutes = Number(offset.slice(2));
    if (hours > 23 || minutes > 59)
      throw new Error("\u65F6\u533A\u683C\u5F0F\u65E0\u6548");
    timezone = (hours * 60 + minutes) * (zone[0] === "-" ? -1 : 1);
  }
  return {
    time: `${year < 0 ? "-" : "+"}${String(Math.abs(year)).padStart(4, "0")}-${m2 ? pad(month) : "00"}-${d2 ? pad(day) : "00"}T${pad(h || 0)}:${pad(min || 0)}:${pad(sec || 0)}${fraction || ""}Z`,
    timezone,
    before: 0,
    after: 0,
    precision: sec !== undefined ? 14 : min !== undefined ? 13 : d2 ? 11 : m2 ? 10 : 9,
    calendarmodel: "http://www.wikidata.org/entity/Q1985727"
  };
}

// src/server/relation-order.ts
import { createHash as createHash3 } from "crypto";

// src/server/knowledge-access.ts
import { AsyncLocalStorage } from "async_hooks";
var knowledgeContext = new AsyncLocalStorage;

// src/server/relation-order.ts
var INCOMING_ORDER_LIMITS = { groups: 200, entries: 500, keyLength: 120 };
function relationPropertyKey(value) {
  const raw = String(value ?? "").trim().split("/").pop().toUpperCase();
  const numeric = raw.match(/^(?:P\s*)?0*(\d+)$/);
  if (numeric)
    return String(Number(numeric[1]));
  const digits = raw.match(/(\d+)/);
  return digits ? `P${Number(digits[1])}` : raw;
}
function relationValues(value) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed))
        return parsed;
    } catch {}
  }
  return Array.isArray(value) ? value : [value];
}
function reconcile(saved, current) {
  const live = new Set(current);
  return [...new Set([...Array.isArray(saved) ? saved.filter((id) => typeof id === "string" && live.has(id)) : [], ...current])];
}
function resolveRelationOrder(items, stored) {
  let saved = stored;
  if (typeof stored === "string") {
    try {
      saved = JSON.parse(stored);
    } catch {
      saved = {};
    }
  }
  const groups = new Map;
  const snapshots = Object.create(null);
  const remap = new Map;
  for (const item of items) {
    const key = relationPropertyKey(item.property ?? item.key);
    if (!groups.has(key))
      groups.set(key, []);
    const values2 = relationValues(item.value);
    const signatures = values2.map((value) => createHash3("sha256").update(JSON.stringify(value) ?? "null").digest("hex"));
    snapshots[item.id] = signatures;
    const previous = saved?.snapshots?.[item.id];
    if (Array.isArray(previous)) {
      const unused = new Set(signatures.map((_2, index) => index));
      previous.forEach((signature, index) => {
        const next = [...unused].find((candidate) => signatures[candidate] === signature);
        if (next !== undefined) {
          remap.set(`${item.id}::${index}`, `${item.id}::${next}`);
          unused.delete(next);
        }
      });
      if (previous.length === signatures.length)
        previous.forEach((_2, index) => {
          if (!remap.has(`${item.id}::${index}`) && unused.size) {
            const next = unused.has(index) ? index : unused.values().next().value;
            remap.set(`${item.id}::${index}`, `${item.id}::${next}`);
            unused.delete(next);
          }
        });
    }
    values2.forEach((_2, index) => groups.get(key).push(`${item.id}::${index}`));
  }
  const properties = reconcile(saved?.properties, [...groups.keys()].sort());
  const values = Object.fromEntries(properties.map((key) => {
    const previous = saved?.values?.[key];
    const refs = Array.isArray(previous) ? previous.map((ref) => {
      if (typeof ref !== "string")
        return null;
      const attributeId = ref.slice(0, ref.lastIndexOf("::"));
      return Array.isArray(saved?.snapshots?.[attributeId]) ? remap.get(ref) : ref;
    }) : [];
    return [key, reconcile(refs, groups.get(key))];
  }));
  return { properties, values, snapshots };
}
function rankRelationItems(items, order) {
  const propertyRanks = new Map(order.properties.map((key, index) => [key, index]));
  const valueRanks = new Map(Object.values(order.values).flatMap((ids) => ids.map((id, index) => [id, index])));
  return items.map((item) => ({
    ...item,
    property_order: propertyRanks.get(relationPropertyKey(item.property ?? item.key)),
    value_order: relationValues(item.value).map((_2, index) => valueRanks.get(`${item.id}::${index}`))
  })).sort((a, b2) => a.property_order - b2.property_order || Math.min(...a.value_order) - Math.min(...b2.value_order));
}
function relationAttributeResponse(items, stored) {
  const order = resolveRelationOrder(items, stored);
  return { items: rankRelationItems(items, order), row_order: order.properties.flatMap((key) => order.values[key]) };
}
function cleanOrderKeys(value, limit = INCOMING_ORDER_LIMITS.entries) {
  if (!Array.isArray(value))
    return [];
  const seen = new Set;
  const keys = [];
  for (const entry of value) {
    if (typeof entry !== "string")
      continue;
    const key = entry.trim();
    if (!key || key.length > INCOMING_ORDER_LIMITS.keyLength || seen.has(key))
      continue;
    seen.add(key);
    keys.push(key);
    if (keys.length >= limit)
      break;
  }
  return keys;
}
function normalizeIncomingOrder(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const groups = cleanOrderKeys(source.groups, INCOMING_ORDER_LIMITS.groups);
  const collect = (value) => {
    const out = {};
    const record = value && typeof value === "object" ? value : {};
    for (const rawKey of Object.keys(record).slice(0, INCOMING_ORDER_LIMITS.groups)) {
      const key = String(rawKey).trim();
      if (!key || key.length > INCOMING_ORDER_LIMITS.keyLength)
        continue;
      const entries = cleanOrderKeys(record[rawKey]);
      if (entries.length)
        out[key] = entries;
    }
    return out;
  };
  return { groups, items: collect(source.items), children: collect(source.children) };
}

// src/server/enterprise-search.ts
import { createHash as createHash4 } from "crypto";
var ENTITY_SEARCH_SCHEMA = 2;
async function ensureEntitySearchMapping(client, index) {
  await client.send(`/${encodeURIComponent(index)}/_mapping`, { method: "PUT", body: JSON.stringify({ properties: {
    has_images: { type: "boolean" },
    has_media: { type: "boolean" },
    search_attributes: { type: "nested", properties: {
      property_id: { type: "keyword" },
      value_text: { type: "wildcard" }
    } }
  } }) });
}
function entitySearchProjection(document) {
  const { _id, _rev, _key, interactions, _search_attributes = [], ...fields } = document;
  const attributes = _search_attributes;
  const fingerprint = createHash4("sha256").update(JSON.stringify([_rev, attributes])).digest("hex");
  const { images, videos, covers } = knowledgeMedia(fields, attributes);
  return {
    ...fields,
    images,
    videos,
    covers,
    _arango_rev: _rev,
    _search_revision: fingerprint,
    _search_schema: ENTITY_SEARCH_SCHEMA,
    has_images: images.length > 0,
    has_media: images.length > 0 || videos.length > 0,
    search_attributes: attributes.map((attr) => ({ property_id: attr.property_id, value_text: attr.value_text }))
  };
}

// src/server/entity-elasticsearch-sync.ts
class ArangoElasticsearchSync {
  store;
  elasticsearch;
  running = new Map;
  statuses = new Map;
  lastVersion = 0;
  constructor(store, elasticsearch) {
    this.store = store;
    this.elasticsearch = elasticsearch;
  }
  status(database) {
    return { source: "entity", mode: "reconcile", running: this.running.has(database), ...this.statuses.get(database) };
  }
  flush(database, batchSize = 250) {
    const current = this.running.get(database);
    if (current)
      return current;
    const task = this.reconcile(database, Math.max(1, Math.min(1000, batchSize)));
    this.running.set(database, task);
    const finish = () => {
      if (this.running.get(database) === task)
        this.running.delete(database);
    };
    task.then(finish, finish);
    return task;
  }
  async afterWrite(database) {
    const current = this.running.get(database);
    if (current)
      await current.catch(() => {});
    return this.flush(database);
  }
  async bulk(lines) {
    if (!lines.length)
      return;
    const { body } = await this.elasticsearch.send("/_bulk", {
      method: "POST",
      headers: { "Content-Type": "application/x-ndjson" },
      body: lines.map((line) => JSON.stringify(line)).join(`
`) + `
`
    });
    const failures = (body?.items || []).filter((item) => {
      const result = item.index || item.delete;
      return result?.error && result.status !== 409 && !(item.delete && result.status === 404);
    });
    if (failures.length || body?.errors && !body?.items?.length)
      throw new Error(`Elasticsearch entity reconciliation failed: ${JSON.stringify(failures.slice(0, 3))}`);
  }
  async reconcile(database, batchSize) {
    let scanned = 0, indexed = 0, deleted = 0;
    try {
      await this.store.ensure(database);
      const index = await ensureElasticsearchEntityIndex(this.elasticsearch, database, true);
      const encodedIndex = encodeURIComponent(index);
      await ensureEntitySearchMapping(this.elasticsearch, index);
      const version = this.lastVersion = Math.max(Date.now(), this.lastVersion + 1);
      let after = "";
      while (true) {
        const page = await this.store.query(database, `FOR doc IN entity FILTER doc._key > @after SORT doc._key ASC LIMIT @limit
          LET attributes = (FOR edge IN link FILTER edge._from == doc._id SORT edge._key
            RETURN { property_id: edge.property_id, value_text: TO_STRING(edge.value), revision: edge._rev })
          RETURN MERGE(doc, { _search_attributes: attributes })`, { after, limit: batchSize });
        if (!page.length)
          break;
        const { body: existing } = await this.elasticsearch.send(`/${encodedIndex}/_mget?_source_includes=_arango_rev,_search_revision,_search_schema`, {
          method: "POST",
          body: JSON.stringify({ ids: page.map((doc) => doc._key) })
        });
        const revisions = new Map((existing?.docs || []).map((doc) => {
          if (doc.error)
            throw new Error(`Elasticsearch revision lookup failed: ${JSON.stringify(doc.error)}`);
          return [doc._id, doc._source];
        }));
        const lines = [];
        for (const document of page) {
          scanned++;
          const projection = entitySearchProjection(document);
          const previous = revisions.get(document._key);
          if (document._rev && previous?._search_revision === projection._search_revision && previous?._search_schema === ENTITY_SEARCH_SCHEMA)
            continue;
          lines.push({ index: { _index: index, _id: document._key, version, version_type: "external_gte" } });
          lines.push(projection);
          indexed++;
        }
        await this.bulk(lines);
        after = page[page.length - 1]._key;
      }
      await this.elasticsearch.send(`/${encodedIndex}/_refresh`, { method: "POST" });
      const { body: opened } = await this.elasticsearch.send(`/${encodedIndex}/_pit?keep_alive=1m`, { method: "POST" });
      let pitId = opened?.id;
      if (!pitId)
        throw new Error("Elasticsearch did not open a point in time");
      try {
        let searchAfter;
        while (true) {
          const { body } = await this.elasticsearch.send("/_search", {
            method: "POST",
            body: JSON.stringify({
              size: batchSize,
              pit: { id: pitId, keep_alive: "1m" },
              sort: [{ _shard_doc: "asc" }],
              track_total_hits: false,
              _source: false,
              seq_no_primary_term: true,
              ...searchAfter ? { search_after: searchAfter } : {}
            })
          });
          if (body?.timed_out || body?._shards?.failed)
            throw new Error("Elasticsearch returned an incomplete entity scan");
          pitId = body?.pit_id || pitId;
          const hits = body?.hits?.hits || [];
          if (!hits.length)
            break;
          const missing = await this.store.query(database, "FOR key IN @keys FILTER DOCUMENT('entity', key) == null RETURN { key }", { keys: hits.map((hit) => hit._id) });
          const missingKeys = new Set(missing.map((row) => row.key));
          const lines = [];
          for (const hit of hits)
            if (missingKeys.has(hit._id)) {
              if (hit._seq_no === undefined || hit._primary_term === undefined)
                throw new Error("Missing optimistic concurrency metadata for ES deletion");
              lines.push({ delete: { _index: index, _id: hit._id, if_seq_no: hit._seq_no, if_primary_term: hit._primary_term } });
              deleted++;
            }
          await this.bulk(lines);
          searchAfter = hits[hits.length - 1].sort;
          if (!searchAfter)
            throw new Error("Elasticsearch did not provide pagination values");
        }
      } finally {
        await this.elasticsearch.send("/_pit", { method: "DELETE", body: JSON.stringify({ id: pitId }) }).catch(() => {});
      }
      if (deleted)
        await this.elasticsearch.send(`/${encodedIndex}/_refresh`, { method: "POST" });
      this.statuses.set(database, { lastSuccessAt: new Date().toISOString(), scanned, indexed, deleted, error: null });
      return indexed + deleted;
    } catch (error) {
      this.statuses.set(database, { ...this.statuses.get(database), lastErrorAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
  start(databases, onError = console.error) {
    let running = false, stopped = false, lastError = 0;
    const tick = async () => {
      if (running || stopped)
        return;
      running = true;
      try {
        const names = await databases();
        const indices = new Map;
        for (const database of names) {
          const index = elasticsearchEntityIndexName(database);
          if (indices.has(index) && indices.get(index) !== database)
            throw new Error(`ArangoDB applications map to the same Elasticsearch index: ${index}`);
          indices.set(index, database);
        }
        for (const database of names) {
          if (stopped)
            break;
          try {
            await this.flush(database);
          } catch (error) {
            if (Date.now() - lastError > 30000) {
              onError(error);
              lastError = Date.now();
            }
          }
        }
      } catch (error) {
        if (Date.now() - lastError > 30000) {
          onError(error);
          lastError = Date.now();
        }
      } finally {
        running = false;
      }
    };
    const configured = Number(process.env.ENTITY_ES_SYNC_INTERVAL_MS || 30000);
    const timer = setInterval(tick, Number.isFinite(configured) ? Math.max(1000, configured) : 30000);
    timer.unref();
    tick();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }
}

// src/server/enterprise-knowledge.ts
class KnowledgeStoreError extends Error {
  status;
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
var cleanKnowledgeId = (value) => String(value ?? "").replace(/^entity\//, "").trim();
var json = (value, fallback) => {
  if (typeof value !== "string")
    return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
function localizedText(value) {
  if (typeof value === "string")
    return value;
  const map = value || {};
  return String(map.zh?.value || map["zh-cn"]?.value || map.en?.value || Object.values(map).find((v2) => v2?.value)?.value || "");
}
function canUseArangoKnowledge(node, user, mode = "read") {
  if (!node)
    return false;
  if (user?.fullAccess)
    return true;
  if (user?.ownedProjectIds?.includes(Number(node.project_id)) || user?.memberProjectIds?.includes(Number(node.project_id)))
    return true;
  if (user?.role === "admin" && (mode === "read" || !node.owner_user_id))
    return true;
  if (mode === "read" && (node.visibility || "public") === "public")
    return true;
  if (!user)
    return false;
  if (Number(node.owner_user_id) === user.id)
    return true;
  return mode !== "manage" && (node.maintainer_ids || []).includes(user.id);
}
function arangoNodeResponse(node, user) {
  const { _key, _id, _rev, data: storedData, interactions, sync_version, maintenance_requests, _arango_rev, _search_revision, _search_schema, search_attributes, has_images, has_media, _current_permissions, ...fields } = node;
  const id = cleanKnowledgeId(node.sqlite_id || node.id);
  const aliases = Object.values(node.aliases || {}).flatMap((v2) => Array.isArray(v2) ? v2 : [v2]).map((v2) => v2?.value).filter(Boolean);
  const categories = node.class_ids || [];
  const parsedData = json(storedData, {});
  const { _relationGraphSnapshot, data: _nestedData, ...data } = parsedData && typeof parsedData === "object" && !Array.isArray(parsedData) ? parsedData : {};
  const { images, covers, videos } = knowledgeMedia(node, node._search_attributes || []);
  const name = localizedText(node.labels) || node.name || "";
  const description = localizedText(node.descriptions) || node.description || "";
  return {
    ...data,
    ...fields,
    id,
    _id: id,
    name,
    label: name,
    label_zh: name,
    description,
    desc_zh: description,
    aliases,
    aliases_zh: aliases,
    tags: json(node.tags, []),
    images,
    image: images[0] || "",
    covers,
    cover: covers.find((value) => value.trim()) || "",
    videos,
    video: videos[0] || "",
    categories,
    categoryIds: categories,
    classes: categories.map((id2) => ({ id: id2, name: id2 })),
    categoryLabels: categories,
    classId: categories[0] || null,
    classLabel: categories[0] || null,
    typeId: node.type || null,
    typeLabel: node.type || "",
    relation_order: json(node.relation_order, {}),
    visibility: node.visibility || "public",
    can_edit: _current_permissions?.can_edit ?? canUseArangoKnowledge(node, user, "edit"),
    can_manage: _current_permissions?.can_manage ?? canUseArangoKnowledge(node, user, "manage")
  };
}
var READ_FILTER = `( @full OR @admin OR doc.visibility == null OR doc.visibility == 'public'
  OR (@uid > 0 AND (doc.owner_user_id == @uid OR doc.project_id IN @projects OR @uid IN NOT_NULL(doc.maintainer_ids, []))) )`;
function knowledgeReadAccess(user, alias = "doc") {
  return { filter: READ_FILTER.replace(/\bdoc\b/g, alias), bindVars: {
    full: Boolean(user?.fullAccess),
    admin: user?.role === "admin",
    uid: user?.id || -1,
    projects: [...user?.ownedProjectIds || [], ...user?.memberProjectIds || []]
  } };
}

class EnterpriseKnowledgeStore {
  client;
  ready = new Map;
  constructor(client) {
    this.client = client;
  }
  static configured() {
    const config = configFromEnvironment();
    if (!config)
      throw new Error("ArangoDB knowledge storage requires ARANGO_URL, ARANGO_USERNAME and ARANGO_PASSWORD");
    return new EnterpriseKnowledgeStore(new ArangoClient(config));
  }
  async query(database, query, bindVars = {}, transaction) {
    const headers = transaction ? { "x-arango-trx-id": transaction } : undefined;
    let { body } = await this.client.database(arangoDatabaseName(database), "/_api/cursor", {
      method: "POST",
      headers,
      body: JSON.stringify({ query, bindVars, batchSize: 500 })
    });
    const result = [...body?.result || []];
    let cursor = body?.id;
    try {
      while (body?.hasMore) {
        if (!cursor)
          throw new Error("ArangoDB returned an incomplete cursor");
        ({ body } = await this.client.database(database, `/_api/cursor/${encodeURIComponent(cursor)}`, { method: "PUT", headers }));
        result.push(...body?.result || []);
        cursor = body?.id || cursor;
      }
    } finally {
      if (cursor)
        await this.client.database(database, `/_api/cursor/${encodeURIComponent(cursor)}`, { method: "DELETE", headers }).catch(() => {});
    }
    return result;
  }
  async ensure(database) {
    arangoDatabaseName(database);
    if (!this.ready.has(database)) {
      const promise = (async () => {
        await this.client.database(database, "/_api/collection/entity");
        await this.client.database(database, "/_api/collection/link");
      })();
      this.ready.set(database, promise);
      promise.catch(() => this.ready.delete(database));
    }
    await this.ready.get(database);
  }
  async get(database, id, transaction) {
    try {
      const { body } = await this.client.database(database, `/_api/document/entity/${documentKey(cleanKnowledgeId(id))}`, {
        headers: transaction ? { "x-arango-trx-id": transaction } : undefined
      });
      return body;
    } catch (error) {
      if (error.status === 404)
        return null;
      throw error;
    }
  }
  async require(database, id, user, mode = "read", trx) {
    const node = await this.get(database, id, trx);
    if (!canUseArangoKnowledge(node, user, mode))
      throw new KnowledgeStoreError(mode === "read" ? "\u77E5\u8BC6\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u8BBF\u95EE" : "\u65E0\u6743\u4FEE\u6539\u8BE5\u77E5\u8BC6", mode === "read" ? 404 : 403);
    return node;
  }
  async importSchema(database, trx) {
    try {
      const { body } = await this.client.database(database, "/_api/document/knowledge_schema/definitions", {
        headers: trx ? { "x-arango-trx-id": trx } : undefined
      });
      return body?.classes && body?.ontologies && body?.properties ? body : null;
    } catch (error) {
      if (error.status === 404 && [1202, 1203].includes(error.body?.errorNum))
        return null;
      throw error;
    }
  }
  async ensureImportSchema(database) {
    try {
      await this.ensure(database);
    } catch (error) {
      if (error.status !== 404 || ![1203, 1228].includes(error.body?.errorNum))
        throw error;
      await ensureApplicationDatabase(this.client, database);
      this.ready.delete(database);
      await this.ensure(database);
    }
    try {
      await this.client.database(database, "/_api/collection/knowledge_schema");
    } catch (error) {
      if (error.status !== 404 || error.body?.errorNum !== 1203)
        throw error;
      await this.client.database(database, "/_api/collection", {
        method: "POST",
        body: JSON.stringify({ name: "knowledge_schema", type: 2 })
      }).catch((error2) => {
        if (error2.status !== 409)
          throw error2;
      });
    }
  }
  async transaction(database, work, extraCollections = []) {
    await this.ensure(database);
    const { body } = await this.client.database(database, "/_api/transaction/begin", {
      method: "POST",
      body: JSON.stringify({ collections: { exclusive: ["entity", "link", ...extraCollections] }, waitForSync: true, lockTimeout: 10 })
    });
    const id = body?.result?.id;
    if (!id)
      throw new Error("ArangoDB transaction did not return an ID");
    try {
      const result = await work(id);
      await this.client.database(database, `/_api/transaction/${id}`, { method: "PUT" });
      return result;
    } catch (error) {
      await this.client.database(database, `/_api/transaction/${id}`, { method: "DELETE" }).catch(() => {});
      throw error;
    }
  }
  async touch(database, node, user, trx) {
    const now = new Date().toISOString();
    const changes = { updated_at: now, updated_at_sort: now, updated_by_user_id: user.id };
    await this.client.database(database, `/_api/document/entity/${node._key}`, { method: "PATCH", headers: { "x-arango-trx-id": trx }, body: JSON.stringify(changes) });
    return { ...node, ...changes };
  }
  async searchAccess(database, user, engagement = false) {
    const rows = await this.query(database, `FOR doc IN entity FILTER ${READ_FILTER}
      RETURN { _key: doc._key, id: doc.sqlite_id || doc.id, owner_user_id: doc.owner_user_id,
        project_id: doc.project_id, visibility: doc.visibility, maintainer_ids: doc.maintainer_ids
        ${engagement ? ", engagement: { likes: LENGTH(NOT_NULL(doc.interactions.likes, [])), comments: LENGTH(NOT_NULL(doc.interactions.comments, [])), shares: TO_NUMBER(NOT_NULL(doc.interactions.shareCount, 0)) }" : ""} }`, {
      full: Boolean(user?.fullAccess),
      admin: user?.role === "admin",
      uid: user?.id || -1,
      projects: [...user?.ownedProjectIds || [], ...user?.memberProjectIds || []]
    });
    return rows.map((node) => ({
      key: String(node._key),
      id: String(node.id),
      ...engagement ? { engagement: node.engagement } : {},
      can_edit: canUseArangoKnowledge(node, user, "edit"),
      can_manage: canUseArangoKnowledge(node, user, "manage")
    }));
  }
  async interact(database, id, user, action = "interaction", method = "GET", input = {}) {
    const perform = async (trx) => {
      const node = await this.require(database, id, user, "read", trx);
      const state = node.interactions || {};
      let likes = [...state.likes || []];
      let comments = [...state.comments || []];
      let shareCount = Number(state.shareCount || 0);
      let addedId;
      if (method !== "GET") {
        if (!user || user.id <= 0)
          throw new KnowledgeStoreError("\u8BF7\u5148\u767B\u5F55", 401);
        if (action === "like")
          likes = method === "DELETE" ? likes.filter((uid) => uid !== user.id) : [...new Set([...likes, user.id])];
        else if (action === "share")
          shareCount++;
        else if (action === "comments" && method === "POST") {
          const content = String(input.content || "").trim();
          if (!content || content.length > 2000)
            throw new KnowledgeStoreError("\u8BC4\u8BBA\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A\u4E14\u4E0D\u80FD\u8D85\u8FC7 2000 \u5B57");
          addedId = randomUUID2();
          comments.unshift({ id: addedId, userId: user.id, username: user.displayName || user.username, avatar: "", content, createdAt: new Date().toISOString() });
        } else if (action === "comments" && method === "DELETE") {
          const comment = comments.find((row) => row.id === input.commentId);
          if (!comment)
            throw new KnowledgeStoreError("\u8BC4\u8BBA\u4E0D\u5B58\u5728", 404);
          if (comment.userId !== user.id && user.role !== "admin" && !user.fullAccess)
            throw new KnowledgeStoreError("\u65E0\u6743\u5220\u9664\u6B64\u8BC4\u8BBA", 403);
          comments = comments.filter((row) => row.id !== input.commentId);
        }
        await this.client.database(database, `/_api/document/entity/${node._key}`, {
          method: "PATCH",
          headers: { "x-arango-trx-id": trx },
          body: JSON.stringify({ interactions: { likes, comments, shareCount } })
        });
      }
      return {
        ...addedId ? { id: addedId } : {},
        likeCount: likes.length,
        commentCount: comments.length,
        shareCount,
        liked: Boolean(user && likes.includes(user.id)),
        comments: comments.map((row) => ({
          ...row,
          canDelete: Boolean(user && (row.userId === user.id || user.role === "admin" || user.fullAccess))
        }))
      };
    };
    return method === "GET" ? perform() : this.transaction(database, perform);
  }
  async list(database, user, options) {
    const binds = {
      full: Boolean(user?.fullAccess),
      admin: user?.role === "admin",
      uid: user?.id || -1,
      projects: [...user?.ownedProjectIds || [], ...user?.memberProjectIds || []],
      q: String(options.q || "").toLowerCase(),
      classId: options.classId || "",
      type: options.type || "",
      limit: options.limit,
      offset: options.offset,
      emptyType: Boolean(options.emptyType),
      hasImage: Boolean(options.hasImage),
      hasMedia: Boolean(options.hasMedia),
      propertyId: options.propertyId || "",
      propertyValue: String(options.propertyValue || "").toLowerCase(),
      definedClasses: options.definedClasses ?? null,
      definedTypes: options.definedTypes ?? null
    };
    const predicate = `${READ_FILTER}
      AND (@q == '' OR CONTAINS(LOWER(TO_STRING(VALUES(NOT_NULL(doc.labels, {}))[*].value)), @q) OR CONTAINS(LOWER(TO_STRING(VALUES(NOT_NULL(doc.descriptions, {}))[*].value)), @q) OR CONTAINS(LOWER(TO_STRING(FLATTEN(VALUES(NOT_NULL(doc.aliases, {})))[*].value)), @q) OR CONTAINS(LOWER(TO_STRING(doc.sqlite_id)), @q))
      AND (@classId == '' OR @classId IN NOT_NULL(doc.class_ids, [])) AND (@type == '' OR doc.type == @type)
      AND (!@emptyType OR doc.type == null OR doc.type == '')
      AND (@definedClasses == null OR LENGTH(INTERSECTION(NOT_NULL(doc.class_ids, []), NOT_NULL(@definedClasses, []))) > 0)
      AND (@definedTypes == null OR doc.type IN NOT_NULL(@definedTypes, []))
      AND (!@hasImage OR LENGTH(TO_ARRAY(IS_STRING(doc.images) ? JSON_PARSE(doc.images) : doc.images)) > 0)
      AND (!@hasMedia OR LENGTH(TO_ARRAY(IS_STRING(doc.images) ? JSON_PARSE(doc.images) : doc.images)) > 0 OR LENGTH(TO_ARRAY(IS_STRING(doc.videos) ? JSON_PARSE(doc.videos) : doc.videos)) > 0)
      AND ((@propertyId == '' AND @propertyValue == '') OR LENGTH(FOR edge IN link
        FILTER edge._from == doc._id AND (@propertyId == '' OR edge.property_id == @propertyId)
          AND (@propertyValue == '' OR CONTAINS(LOWER(TO_STRING(edge.value)), @propertyValue)) LIMIT 1 RETURN 1) > 0)`;
    const sort = options.order === "random" ? "RAND()" : options.order === "id" ? "doc.sqlite_id ASC" : options.order === "created_asc" ? "doc.created_at ASC" : options.order === "created_desc" ? "doc.created_at DESC" : ["updated_asc", "modified_asc"].includes(options.order) ? "doc.updated_at ASC" : "doc.updated_at DESC";
    const rows = await this.query(database, `LET total = LENGTH(FOR doc IN entity FILTER ${predicate} RETURN 1)
      LET nodes = (FOR doc IN entity FILTER ${predicate} SORT ${sort}, doc._key ASC LIMIT @offset, @limit RETURN doc)
      RETURN { total, nodes }`, binds);
    return rows[0] || { total: 0, nodes: [] };
  }
  async tags(database, user) {
    const rows = await this.query(database, `FOR doc IN entity FILTER ${READ_FILTER}
      LET tags = IS_ARRAY(doc.tags) ? doc.tags : (IS_STRING(doc.tags) ? JSON_PARSE(doc.tags) : [])
      FOR tag IN (IS_ARRAY(tags) ? tags : [])
      FILTER IS_STRING(tag) AND TRIM(tag) != ''
      COLLECT name = TRIM(tag) RETURN name`, {
      full: Boolean(user?.fullAccess),
      admin: user?.role === "admin",
      uid: user?.id || -1,
      projects: [...user?.ownedProjectIds || [], ...user?.memberProjectIds || []]
    });
    return rows;
  }
  async summary(database, user) {
    const bindVars = {
      full: Boolean(user?.fullAccess),
      admin: user?.role === "admin",
      uid: user?.id || -1,
      projects: [...user?.ownedProjectIds || [], ...user?.memberProjectIds || []]
    };
    const rows = await this.query(database, `LET types = UNIQUE(FOR doc IN entity FILTER ${READ_FILTER} AND doc.type != null AND doc.type != '' RETURN doc.type)
      LET entities = LENGTH(FOR doc IN entity FILTER ${READ_FILTER} RETURN 1)
      LET attributes = LENGTH(FOR edge IN link LET doc = DOCUMENT(edge._from)
        FILTER doc != null AND ${READ_FILTER} COLLECT id = edge.sqlite_id RETURN id)
      LET categories = (FOR doc IN entity FILTER ${READ_FILTER}
        FOR classId IN NOT_NULL(doc.class_ids, []) COLLECT id = classId WITH COUNT INTO count RETURN { id, count })
      RETURN { types, entities, attributes, categories }`, bindVars);
    return rows[0];
  }
  async mediaReadable(database, path, user) {
    const rows = await this.query(database, `FOR doc IN entity FILTER ${READ_FILTER}
      FILTER CONTAINS(TO_STRING([doc.images, doc.covers, doc.videos, doc.pdf, doc.data, doc.wiki_md]), @path)
        OR LENGTH(FOR edge IN link FILTER edge._from == doc._id AND CONTAINS(TO_STRING(edge.value), @path) LIMIT 1 RETURN 1) > 0
      LIMIT 1 RETURN 1`, {
      full: Boolean(user?.fullAccess),
      admin: user?.role === "admin",
      uid: user?.id || -1,
      projects: [...user?.ownedProjectIds || [], ...user?.memberProjectIds || []],
      path
    });
    return rows.length > 0;
  }
  async create(database, projectId, input, user) {
    return this.transaction(database, async (trx) => {
      const id = cleanKnowledgeId(input.id || randomUUID2());
      if (!id || id.length > 512)
        throw new KnowledgeStoreError("\u65E0\u6548\u7684\u77E5\u8BC6 ID");
      if (await this.get(database, id, trx))
        throw new KnowledgeStoreError("\u77E5\u8BC6 ID \u5DF2\u5B58\u5728", 409);
      const node = this.patch(null, { ...input, id }, projectId, user);
      await this.client.database(database, "/_api/document/entity", { method: "POST", headers: { "x-arango-trx-id": trx }, body: JSON.stringify(node) });
      return node;
    });
  }
  patch(previous, input, projectId, user) {
    const taxonomy = normalizeEntityTaxonomy(input);
    const id = cleanKnowledgeId(previous?.sqlite_id || previous?.id || input.id);
    const now = new Date().toISOString();
    const row = previous ? { ...previous, id, name: previous.labels, description: previous.descriptions } : {
      id,
      project_id: projectId,
      visibility: "public",
      owner_user_id: user.id || null,
      creator_username: user.username,
      created_at: now,
      name: "",
      description: "",
      aliases: {}
    };
    for (const key of ["name", "description", "aliases", "link", "pdf", "wiki_md"]) {
      if (input[key] !== undefined)
        row[key] = input[key];
    }
    for (const key of ["images", "covers", "videos"]) {
      if (input[key] !== undefined) {
        if (!Array.isArray(input[key]) || input[key].some((v2) => typeof v2 !== "string"))
          throw new KnowledgeStoreError(`${key} \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
        const append = input[`append${key[0].toUpperCase()}${key.slice(1)}`] === true;
        row[key] = JSON.stringify(append ? [...new Set([...json(previous?.[key], []), ...input[key]])] : input[key]);
      }
    }
    if (input.appendVideos === true && input.appendCovers === true && input.videos !== undefined && input.covers !== undefined) {
      const paired = appendVideoCoverPairs(json(previous?.videos, []), json(previous?.covers, []), input.videos, input.covers);
      row.videos = JSON.stringify(paired.videos);
      row.covers = JSON.stringify(paired.covers);
    }
    if (input.mentions !== undefined) {
      if (!input.mentions || typeof input.mentions !== "object" || Array.isArray(input.mentions))
        throw new KnowledgeStoreError("mentions \u5FC5\u987B\u662F\u5BF9\u8C61");
      row.data = JSON.stringify({ ...json(previous?.data, {}), mentions: input.mentions });
    }
    if (input.visibility !== undefined) {
      if (!["public", "private"].includes(input.visibility))
        throw new KnowledgeStoreError("\u65E0\u6548\u7684\u53EF\u89C1\u6027");
      row.visibility = input.visibility;
    }
    if (taxonomy.hasCategories)
      row.classification_initialized = true;
    if (taxonomy.hasType)
      row.type = taxonomy.typeId;
    if (taxonomy.hasTags)
      row.tags = JSON.stringify(taxonomy.tags);
    if (input.relation_order !== undefined)
      row.relation_order = JSON.stringify(input.relation_order);
    row.updated_at = now;
    row.updated_by_user_id = user.id;
    const { _id, _rev, ...document } = entityDocument(row, undefined, taxonomy.hasCategories ? taxonomy.categoryIds : previous?.class_ids || []);
    return document;
  }
  async update(database, id, input, user) {
    return this.transaction(database, async (trx) => {
      const previous = await this.require(database, id, user, "edit", trx);
      if (input.visibility !== undefined && !canUseArangoKnowledge(previous, user, "manage"))
        throw new KnowledgeStoreError("\u4EC5\u7BA1\u7406\u8005\u53EF\u4FEE\u6539\u53EF\u89C1\u6027", 403);
      const node = this.patch(previous, input, previous.project_id, user);
      await this.client.database(database, `/_api/document/entity/${node._key}`, { method: "PUT", headers: { "x-arango-trx-id": trx }, body: JSON.stringify(node) });
      return node;
    });
  }
  async remove(database, id, user) {
    return this.transaction(database, async (trx) => {
      const node = await this.require(database, id, user, "manage", trx);
      await this.query(database, "FOR edge IN link FILTER edge._from == @vertex OR edge._to == @vertex REMOVE edge IN link", { vertex: `entity/${node._key}` }, trx);
      await this.client.database(database, `/_api/document/entity/${node._key}`, { method: "DELETE", headers: { "x-arango-trx-id": trx } });
    });
  }
  async attributes(database, nodeId, trx) {
    const id = cleanKnowledgeId(nodeId);
    const links = await this.query(database, "FOR edge IN link FILTER edge._from == @vertex RETURN edge", { vertex: `entity/${documentKey(id)}` }, trx);
    const result = new Map;
    const grouped = new Map;
    for (const edge of links) {
      const attrId = String(edge.sqlite_id || edge._key);
      if (!result.has(attrId))
        grouped.set(attrId, [...grouped.get(attrId) || [], edge]);
    }
    for (const [attrId, edges] of grouped) {
      const edge = edges[0];
      if (edge.attribute) {
        result.set(attrId, { ...edge.attribute, id: attrId, node_id: id });
        continue;
      }
      const values = edges.map((e) => e.mainsnak?.datavalue?.value ?? e.value);
      const value = values.length === 1 ? values[0] : values;
      result.set(attrId, {
        id: attrId,
        node_id: id,
        key: edge.property_id,
        datatype: edge.mainsnak?.datatype || edge.datatype || "string",
        value: JSON.stringify(value),
        property_name_snapshot: edge.property_name,
        statement_json: JSON.stringify({
          property: edge.property_id,
          datatype: edge.mainsnak?.datatype || edge.datatype,
          snaktype: edge.mainsnak?.snaktype || edge.snaktype || "value",
          rank: edge.rank || "normal",
          qualifiers: edge.qualifiers || {},
          references: edge.references || [],
          datavalue: { type: edge.mainsnak?.datavalue?.type, value }
        })
      });
    }
    return [...result.values()];
  }
  async saveAttribute(database, input, user) {
    const nodeId = cleanKnowledgeId(input.node_id || input.entity_id);
    if (!nodeId)
      throw new KnowledgeStoreError("\u7F3A\u5C11\u77E5\u8BC6 ID");
    const property = String(input.property || input.prop || "").trim();
    if (!property)
      throw new KnowledgeStoreError("\u7F3A\u5C11\u5C5E\u6027");
    return this.transaction(database, async (trx) => {
      const node = await this.require(database, nodeId, user, "edit", trx);
      const attrs = await this.attributes(database, nodeId, trx);
      const id = String(input.id || `attr/${randomUUID2()}`);
      const existing = attrs.find((a) => a.id === id);
      const oldEdges = await this.query(database, "FOR edge IN link FILTER edge.sqlite_id == @id AND edge._from != @vertex RETURN 1", { id, vertex: `entity/${node._key}` }, trx);
      if (oldEdges.length)
        throw new KnowledgeStoreError("\u5C5E\u6027 ID \u5DF2\u88AB\u5176\u4ED6\u77E5\u8BC6\u4F7F\u7528", 409);
      let statement;
      try {
        statement = normalizeStatement({ ...input, property, datatype: normalizeDatatype(input.datatype || existing?.datatype || "string") }, json(existing?.statement_json, {}));
      } catch (error) {
        throw new KnowledgeStoreError(error instanceof Error ? error.message : "\u65E0\u6548\u7684\u5C5E\u6027\u503C");
      }
      if (Array.isArray(statement.datavalue?.value) && !statement.datavalue.value.length)
        throw new KnowledgeStoreError("\u5C5E\u6027\u503C\u6570\u7EC4\u4E0D\u80FD\u4E3A\u7A7A");
      const attr = {
        _key: documentKey(id),
        id,
        node_id: nodeId,
        key: property,
        value: JSON.stringify(statement.datavalue?.value ?? null),
        datatype: uiDatatype(statement.datatype),
        property_name_snapshot: String(input.property_name_snapshot || input.property_label_zh || existing?.property_name_snapshot || property),
        statement_json: JSON.stringify(statement),
        created_at: existing?.created_at || new Date().toISOString()
      };
      await this.query(database, "FOR edge IN link FILTER edge.sqlite_id == @id AND edge._from == @vertex REMOVE edge IN link", { id, vertex: `entity/${node._key}` }, trx);
      for (const edge of edgeDocuments({ id: nodeId }, [attr])) {
        await this.client.database(database, "/_api/document/link", { method: "POST", headers: { "x-arango-trx-id": trx }, body: JSON.stringify(edge) });
      }
      const updated = { ...node, updated_at: new Date().toISOString(), updated_at_sort: new Date().toISOString(), updated_by_user_id: user.id };
      await this.client.database(database, `/_api/document/entity/${node._key}`, { method: "PATCH", headers: { "x-arango-trx-id": trx }, body: JSON.stringify({ updated_at: updated.updated_at, updated_at_sort: updated.updated_at_sort, updated_by_user_id: user.id }) });
      return attr;
    });
  }
  async removeAttribute(database, attributeId, user) {
    return this.transaction(database, async (trx) => {
      const rows = await this.query(database, "FOR e IN link FILTER e.sqlite_id == @id LIMIT 1 RETURN e.source_id", { id: attributeId }, trx);
      const nodeId = rows[0];
      if (!nodeId)
        throw new KnowledgeStoreError("\u5C5E\u6027\u4E0D\u5B58\u5728", 404);
      const node = await this.require(database, nodeId, user, "edit", trx);
      await this.query(database, "FOR e IN link FILTER e.sqlite_id == @id AND e._from == @vertex REMOVE e IN link", { id: attributeId, vertex: `entity/${node._key}` }, trx);
      await this.touch(database, node, user, trx);
    });
  }
  async classify(database, id, classId, remove, user) {
    return this.transaction(database, async (trx) => {
      const node = await this.require(database, id, user, "edit", trx);
      const classes = new Set(node.class_ids || []);
      if (remove && !classId)
        classes.clear();
      else if (remove)
        classes.delete(classId);
      else
        classes.add(classId);
      const next = { ...node, class_ids: [...classes], classification_initialized: true };
      await this.client.database(database, `/_api/document/entity/${node._key}`, { method: "PATCH", headers: { "x-arango-trx-id": trx }, body: JSON.stringify({ class_ids: next.class_ids, classification_initialized: true }) });
      await this.touch(database, next, user, trx);
      return next;
    });
  }
  async maintenance(database, id, action, input, user) {
    return this.transaction(database, async (trx) => {
      const node = await this.require(database, id, user, action === "request" ? "read" : "manage", trx);
      const requests = { ...node.maintenance_requests || {} };
      const maintainers = new Set(node.maintainer_ids || []);
      const now = new Date().toISOString();
      if (action === "request") {
        if (canUseArangoKnowledge(node, user, "edit"))
          throw new KnowledgeStoreError("\u4F60\u5DF2\u62E5\u6709\u7EF4\u62A4\u6743\u9650", 409);
        const message = String(input.message || "").trim();
        if (message.length > 1000)
          throw new KnowledgeStoreError("\u7533\u8BF7\u8BF4\u660E\u4E0D\u80FD\u8D85\u8FC7 1000 \u5B57");
        requests[String(user.id)] = { user_id: user.id, username: user.username, message, status: "pending", created_at: now };
      } else {
        const target = Number(input.user_id);
        if (!Number.isSafeInteger(target) || target <= 0)
          throw new KnowledgeStoreError("\u65E0\u6548\u7684\u7528\u6237");
        const previous = requests[String(target)];
        if (action !== "remove" && !["approve", "reject"].includes(input.decision))
          throw new KnowledgeStoreError("\u8BF7\u9009\u62E9\u6279\u51C6\u6216\u62D2\u7EDD");
        if (action !== "remove" && previous?.status !== "pending")
          throw new KnowledgeStoreError("\u7533\u8BF7\u4E0D\u5B58\u5728\u6216\u5DF2\u5904\u7406", 409);
        if (action === "remove")
          maintainers.delete(target);
        else if (input.decision === "approve")
          maintainers.add(target);
        requests[String(target)] = {
          ...previous,
          user_id: target,
          reviewed_by: user.id,
          reviewed_at: now,
          status: action === "remove" ? "revoked" : input.decision === "approve" ? "approved" : "rejected"
        };
      }
      const changes = { maintainer_ids: [...maintainers], maintenance_requests: requests, updated_at: now, updated_at_sort: now, updated_by_user_id: user.id };
      await this.client.database(database, `/_api/document/entity/${node._key}`, { method: "PATCH", headers: { "x-arango-trx-id": trx }, body: JSON.stringify(changes) });
    });
  }
  async reorder(database, id, input, user) {
    return this.transaction(database, async (trx) => {
      const node = await this.require(database, id, user, "edit", trx);
      const attrs = (await this.attributes(database, id, trx)).map(arangoAttributeResponse);
      let order;
      if (input.kind === "incoming") {
        const incoming = normalizeIncomingOrder(input.incoming);
        if (!incoming.groups.length && !Object.keys(incoming.items).length && !Object.keys(incoming.children).length)
          throw new KnowledgeStoreError("\u6392\u5E8F\u6570\u636E\u65E0\u6548");
        order = { ...json(node.relation_order, {}), incoming };
      } else {
        if (!["property", "value"].includes(input.kind) || !["before", "after"].includes(input.placement) || typeof input.source !== "string" || typeof input.target !== "string")
          throw new KnowledgeStoreError("\u6392\u5E8F\u53C2\u6570\u65E0\u6548");
        order = resolveRelationOrder(attrs, node.relation_order);
        const key = order.properties.find((key2) => order.values[key2].includes(input.source));
        const sequence = input.kind === "property" ? order.properties : key !== undefined ? order.values[key] : undefined;
        if (!sequence?.includes(input.source) || !sequence.includes(input.target))
          throw new KnowledgeStoreError("\u5C5E\u6027\u6216\u5C5E\u6027\u503C\u5DF2\u53D8\u5316\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5", 409);
        if (input.source !== input.target) {
          sequence.splice(sequence.indexOf(input.source), 1);
          sequence.splice(sequence.indexOf(input.target) + (input.placement === "after" ? 1 : 0), 0, input.source);
        }
      }
      const next = { ...node, relation_order: JSON.stringify(order), updated_at: new Date().toISOString(), updated_by_user_id: user.id };
      await this.client.database(database, `/_api/document/entity/${node._key}`, { method: "PATCH", headers: { "x-arango-trx-id": trx }, body: JSON.stringify({ relation_order: next.relation_order, updated_at: next.updated_at, updated_by_user_id: user.id }) });
      await this.touch(database, next, user, trx);
      return order;
    });
  }
  async removeRelation(database, edgeId, user) {
    const separator = edgeId.lastIndexOf(":");
    if (separator < 1)
      throw new KnowledgeStoreError("\u65E0\u6548\u7684\u5173\u7CFB ID");
    const attributeId = edgeId.slice(0, separator), targetId = cleanKnowledgeId(edgeId.slice(separator + 1));
    return this.transaction(database, async (trx) => {
      const matches = await this.query(database, "FOR edge IN link FILTER edge.sqlite_id == @id AND edge.target_id == @target RETURN edge", { id: attributeId, target: targetId }, trx);
      if (!matches.length)
        throw new KnowledgeStoreError("\u5173\u7CFB\u4E0D\u5B58\u5728", 404);
      const nodeId = matches[0].source_id;
      const node = await this.require(database, nodeId, user, "edit", trx);
      const attr = (await this.attributes(database, nodeId, trx)).find((attr2) => attr2.id === attributeId);
      if (!attr)
        throw new KnowledgeStoreError("\u5173\u7CFB\u5C5E\u6027\u4E0D\u5B58\u5728", 404);
      const value = json(attr.value, null);
      const values = (Array.isArray(value) ? value : [value]).filter((item) => cleanKnowledgeId(item?.id || item?.value?.id || item) !== targetId);
      await this.query(database, "FOR edge IN link FILTER edge.sqlite_id == @id AND edge._from == @vertex REMOVE edge IN link", { id: attributeId, vertex: `entity/${node._key}` }, trx);
      if (values.length) {
        const statement = normalizeStatement({ ...json(attr.statement_json, {}), value: values, datavalue: undefined });
        const next = { ...attr, _key: documentKey(attributeId), value: JSON.stringify(values), statement_json: JSON.stringify(statement) };
        const { _id, _rev, ...document } = next;
        for (const edge of edgeDocuments({ id: nodeId }, [document]))
          await this.client.database(database, "/_api/document/link", { method: "POST", headers: { "x-arango-trx-id": trx }, body: JSON.stringify(edge) });
      }
      await this.touch(database, node, user, trx);
    });
  }
  async relations(database, id, user, direction = "both") {
    await this.require(database, id, user);
    const vertex = `entity/${documentKey(cleanKnowledgeId(id))}`;
    const rows = await this.query(database, `WITH entity
      FOR neighbor, edge IN 1..1 ANY @vertex link
      FILTER edge._from != edge._to AND ((@outgoing AND edge._from == @vertex) OR (@incoming AND edge._to == @vertex))
      LET source = DOCUMENT(edge._from) LET target = DOCUMENT(edge._to)
      FILTER source != null AND target != null RETURN { edge, source, target }`, { vertex, outgoing: direction !== "incoming", incoming: direction !== "outgoing" });
    return rows.filter((row) => canUseArangoKnowledge(row.source, user) && canUseArangoKnowledge(row.target, user));
  }
  async relationshipCards(database, ids, user) {
    const rootAccess = knowledgeReadAccess(user);
    const neighborAccess = knowledgeReadAccess(user, "neighbor");
    const rows = await this.query(database, `WITH entity
      FOR key IN @keys LET doc = DOCUMENT('entity', key)
        FILTER doc != null AND ${rootAccess.filter}
        LET relations = (FOR neighbor, edge IN 1..1 ANY doc._id link
          FILTER edge._from != edge._to AND neighbor != null AND ${neighborAccess.filter}
          LIMIT 41 RETURN { node: neighbor, edge })
        RETURN { node: doc, relations }`, { ...rootAccess.bindVars, keys: [...new Set(ids.map((id) => documentKey(cleanKnowledgeId(id))))] });
    return rows.filter((row) => canUseArangoKnowledge(row.node, user)).map((row) => ({
      ...row,
      truncated: row.relations.length > 40,
      relations: row.relations.slice(0, 40).filter((relation) => canUseArangoKnowledge(relation.node, user))
    }));
  }
  async relationPaths(database, id, user, limit = 500) {
    const vertex = `entity/${documentKey(cleanKnowledgeId(id))}`;
    const maximum = Math.max(1, Math.min(1000, Math.floor(limit) || 500));
    const access = READ_FILTER.replace(/\bdoc\b/g, "neighbor");
    const rows = await this.query(database, `WITH entity
      FOR neighbor, edge, path IN 1..2 ANY @vertex link
      PRUNE blocked = neighbor == null OR (edge != null AND edge._from == edge._to) OR NOT (${access})
      OPTIONS { order: 'bfs', uniqueVertices: 'path', uniqueEdges: 'path' }
      FILTER NOT blocked AND neighbor._id != @vertex
      LIMIT @limit
      RETURN { vertices: path.vertices, edges: path.edges }`, {
      vertex,
      limit: maximum + 1,
      full: Boolean(user?.fullAccess),
      admin: user?.role === "admin",
      uid: user?.id || -1,
      projects: [...user?.ownedProjectIds || [], ...user?.memberProjectIds || []]
    });
    return {
      paths: rows.slice(0, maximum).filter((row) => row.vertices?.every((node) => canUseArangoKnowledge(node, user))),
      truncated: rows.length > maximum,
      limit: maximum
    };
  }
}
function arangoAttributeResponse(attr) {
  const statement = json(attr.statement_json, {});
  const datatype = normalizeDatatype(statement.datatype || attr.datatype);
  const value = json(attr.value, attr.value);
  return {
    id: attr.id,
    node_id: attr.node_id,
    property: attr.key,
    property_label_zh: attr.property_name_snapshot || attr.key,
    datatype,
    ui_datatype: uiDatatype(datatype),
    value,
    snaktype: statement.snaktype || "value",
    rank: statement.rank || "normal",
    qualifiers: statement.qualifiers || {},
    references: statement.references || [],
    value_thumbnails: [],
    datavalue: statement.snaktype && statement.snaktype !== "value" ? undefined : { type: valueTypeFor(datatype), value }
  };
}

// src/server/enterprise-entity-import.ts
import { randomUUID as randomUUID3 } from "crypto";

// src/server/entity-import.ts
import { lookup } from "dns/promises";
import { mkdirSync, unlinkSync } from "fs";
import { isIP } from "net";
import { resolve as resolve2 } from "path";

// src/server/class-import.ts
class ClassImportError extends Error {
}
function parseClassImport(input) {
  const fail = (message) => {
    throw new ClassImportError(message);
  };
  const object = (value, path) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      fail(`${path} \u5FC5\u987B\u662F\u5BF9\u8C61`);
    return value;
  };
  const root = object(input, "\u6587\u4EF6");
  if (root.version !== 1)
    fail("version \u5FC5\u987B\u4E3A 1\uFF0C\u8BF7\u53C2\u8003\u793A\u4F8B\u6587\u4EF6");
  for (const key of Object.keys(root))
    if (!["version", "classes"].includes(key))
      fail(`\u6587\u4EF6\u5305\u542B\u4E0D\u652F\u6301\u7684\u5B57\u6BB5\uFF1A${key}`);
  if (!Array.isArray(root.classes) || !root.classes.length)
    fail("classes \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4");
  let count = 0;
  const parse = (value, path, depth) => {
    if (++count > 1000)
      fail("\u4E00\u6B21\u6700\u591A\u5BFC\u5165 1000 \u4E2A\u5206\u7C7B");
    if (depth > 32)
      fail("\u5206\u7C7B\u5C42\u7EA7\u4E0D\u80FD\u8D85\u8FC7 32 \u5C42");
    const row = object(value, path);
    const fields = ["name", "description", "color", "image", "tags", "children"];
    for (const key of Object.keys(row))
      if (!fields.includes(key))
        fail(`${path} \u5305\u542B\u4E0D\u652F\u6301\u7684\u5B57\u6BB5\uFF1A${key}`);
    if (typeof row.name !== "string" || !row.name.trim())
      fail(`${path}.name \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
    if (row.description !== undefined && typeof row.description !== "string")
      fail(`${path}.description \u5FC5\u987B\u662F\u5B57\u7B26\u4E32`);
    if (row.color != null && (typeof row.color !== "string" || !/^#[\da-f]{6}$/i.test(row.color)))
      fail(`${path}.color \u5FC5\u987B\u662F #RRGGBB \u683C\u5F0F`);
    if (row.image != null && typeof row.image !== "string")
      fail(`${path}.image \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6216 null`);
    if (row.tags !== undefined && (!Array.isArray(row.tags) || row.tags.some((tag) => typeof tag !== "string" || !tag.trim())))
      fail(`${path}.tags \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32\u7EC4\u6210\u7684\u6570\u7EC4`);
    if (row.children !== undefined && !Array.isArray(row.children))
      fail(`${path}.children \u5FC5\u987B\u662F\u6570\u7EC4`);
    const tags = [...new Map((row.tags || []).map((tag) => [tag.trim().toLowerCase(), tag.trim()])).values()];
    return {
      name: row.name.trim(),
      description: String(row.description || "").trim(),
      color: row.color || null,
      image: row.image == null ? null : String(row.image).trim(),
      tags,
      children: (row.children || []).map((child, index) => parse(child, `${path}.children[${index}]`, depth + 1)),
      provided: Object.keys(row)
    };
  };
  return root.classes.map((row, index) => parse(row, `classes[${index}]`, 1));
}

// src/server/entity-import.ts
class EntityImportError extends Error {
}
var mediaKinds = {
  image: { folder: "node-images", maxSize: 20 * 1024 * 1024, mime: /^image\//, extensions: new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "avif", "heif", "heic"]) },
  video: { folder: "node-videos", maxSize: 500 * 1024 * 1024, mime: /^video\//, extensions: new Set(["mp4", "webm", "ogg", "mov", "m4v"]) },
  pdf: { folder: "node-pdfs", maxSize: 100 * 1024 * 1024, mime: /^application\/pdf(?:$|;)/, extensions: new Set(["pdf"]) }
};
var privateAddress = (address) => {
  if (address === "::1" || address === "::" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:"))
    return true;
  if (!isIP(address))
    return false;
  const parts = address.split(".").map(Number);
  return parts.length === 4 && (parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || parts[0] === 169 && parts[1] === 254 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 || parts[0] === 192 && parts[1] === 168);
};
async function assertPublicMediaUrl(url) {
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new EntityImportError(`\u4E0D\u652F\u6301\u7684\u8D44\u6E90\u534F\u8BAE\uFF1A${url.protocol}`);
  const host = url.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".local") || privateAddress(host))
    throw new EntityImportError(`\u7981\u6B62\u8BBF\u95EE\u672C\u5730\u8D44\u6E90\u5730\u5740\uFF1A${host}`);
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some((item) => privateAddress(item.address)))
    throw new EntityImportError(`\u8D44\u6E90\u5730\u5740\u4E0D\u80FD\u89E3\u6790\u5230\u5185\u7F51\uFF1A${host}`);
}
var extensionFor = (url, contentType, kind) => {
  const byPath = url.pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || "";
  if (mediaKinds[kind].extensions.has(byPath))
    return byPath === "jpeg" ? "jpg" : byPath;
  const mime = contentType.split(";")[0]?.trim();
  const map = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg", "image/avif": "avif", "video/mp4": "mp4", "video/webm": "webm", "video/ogg": "ogg", "video/quicktime": "mov", "application/pdf": "pdf" };
  return map[mime] || "";
};
async function downloadImportMedia(source, kind, _projectId) {
  let current = new URL(source);
  let response = null;
  const timeoutMs = kind === "video" ? 180000 : 90000;
  for (let redirect = 0;redirect <= 5; redirect++) {
    await assertPublicMediaUrl(current);
    response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { "User-Agent": "KnowledgeGraphEntityImport/1.0", Accept: kind === "image" ? "image/*" : kind === "video" ? "video/*" : "application/pdf" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location)
        throw new EntityImportError(`\u8D44\u6E90\u91CD\u5B9A\u5411\u7F3A\u5C11\u5730\u5740\uFF1A${source}`);
      current = new URL(location, current);
      continue;
    }
    break;
  }
  if (!response || !response.ok)
    throw new EntityImportError(`\u8D44\u6E90\u4E0B\u8F7D\u5931\u8D25\uFF1A${source}\uFF08HTTP ${response?.status || 0}\uFF09`);
  const config = mediaKinds[kind];
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const extension = extensionFor(current, contentType, kind);
  const genericBinary = /^(?:application|binary)\/octet-stream(?:$|;)/.test(contentType);
  if (!config.mime.test(contentType) && !(genericBinary && extension))
    throw new EntityImportError(`\u8D44\u6E90\u7C7B\u578B\u4E0D\u5339\u914D\uFF1A${source}\uFF08${contentType || "\u672A\u77E5\u7C7B\u578B"}\uFF09`);
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > config.maxSize)
    throw new EntityImportError(`\u8D44\u6E90\u6587\u4EF6\u8FC7\u5927\uFF1A${source}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > config.maxSize)
    throw new EntityImportError(`\u8D44\u6E90\u6587\u4EF6\u4E3A\u7A7A\u6216\u8D85\u8FC7\u5927\u5C0F\u9650\u5236\uFF1A${source}`);
  if (!extension)
    throw new EntityImportError(`\u65E0\u6CD5\u8BC6\u522B\u8D44\u6E90\u6587\u4EF6\u7C7B\u578B\uFF1A${source}`);
  const directory = resolve2(import.meta.dir, "..", "..", "uploads", config.folder);
  mkdirSync(directory, { recursive: true });
  const filename = `${crypto.randomUUID()}.${extension}`;
  const file = resolve2(directory, filename);
  await Bun.write(file, bytes);
  return { file, url: `/static/uploads/${config.folder}/${filename}` };
}
function cleanupLocalizedEntityImport(files) {
  for (const file of files) {
    try {
      unlinkSync(file);
    } catch {}
  }
}
async function localizeEntityImportMedia(input, projectId) {
  const root = structuredClone(input);
  const files = [];
  const localizedBySource = new Map;
  const localize = async (value, kind) => {
    const source = String(value || "").trim();
    if (!/^https?:\/\//i.test(source))
      return source;
    const cacheKey = `${kind}:${source}`;
    const cached = localizedBySource.get(cacheKey);
    if (cached)
      return cached;
    let saved;
    try {
      saved = await downloadImportMedia(source, kind, projectId);
    } catch (error) {
      const kindLabel = kind === "image" ? "\u56FE\u7247" : kind === "video" ? "\u89C6\u9891" : "PDF";
      throw new EntityImportError(`${kindLabel}\u540C\u6B65\u5931\u8D25\uFF1A${source}\uFF1A${error instanceof Error ? error.message : String(error)}`);
    }
    files.push(saved.file);
    localizedBySource.set(cacheKey, saved.url);
    return saved.url;
  };
  try {
    for (const document of entityImportDocuments(root)) {
      const entity = object(document.entity, "entity");
      if (Array.isArray(entity.images)) {
        const images = [];
        for (const value of entity.images)
          images.push(await localize(value, "image"));
        entity.images = images;
      }
      if (Array.isArray(entity.videos)) {
        const videos = [];
        for (const value of entity.videos)
          videos.push(await localize(value, "video"));
        entity.videos = videos;
      }
      if (entity.pdf)
        entity.pdf = await localize(entity.pdf, "pdf");
      for (const attribute of Array.isArray(entity.attributes) ? entity.attributes : []) {
        if (normalizeDatatype(attribute?.datatype) !== "commonsMedia")
          continue;
        if (Array.isArray(attribute.value)) {
          const values = [];
          for (const value of attribute.value)
            values.push(await localize(value, "image"));
          attribute.value = values;
        } else
          attribute.value = await localize(attribute.value, "image");
      }
    }
    return { input: root, files };
  } catch (error) {
    cleanupLocalizedEntityImport(files);
    if (error instanceof EntityImportError)
      throw error;
    throw new EntityImportError(`\u6587\u4EF6\u8D44\u6E90\u540C\u6B65\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`);
  }
}
var object = (value, path) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new EntityImportError(`${path} \u5FC5\u987B\u662F\u5BF9\u8C61`);
  return value;
};
var strings = (value, path) => {
  if (value === undefined)
    return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new EntityImportError(`${path} \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
};
var normalizeImportedValue = (datatype, value) => {
  if (Array.isArray(value))
    return value.map((item) => normalizeImportedValue(datatype, item));
  if (normalizeDatatype(datatype) === "wikibase-item") {
    if (typeof value === "string" && value.trim())
      return { label_zh: value.trim() };
    if (value && typeof value === "object") {
      const item = value;
      if (String(item.id || item.label_zh || item.entity_label_zh || item.label || item.name || "").trim())
        return { ...item };
    }
    throw new Error("\u5B9E\u4F53\u5F15\u7528\u5FC5\u987B\u5305\u542B id\u3001\u4E2D\u6587\u6807\u7B7E\u6216\u540D\u79F0");
  }
  if (normalizeDatatype(datatype) === "time" && typeof value === "string") {
    return normalizeValue(datatype, { date: value });
  }
  return normalizeValue(datatype, value);
};
function entityImportDocuments(input) {
  if (Array.isArray(input)) {
    if (!input.length)
      throw new EntityImportError("\u5BFC\u5165\u6570\u7EC4\u4E0D\u80FD\u4E3A\u7A7A");
    return input.map((item, index) => {
      const row = object(item, `\u6587\u4EF6[${index}]`);
      return row.entity ? row : { version: 1, entity: row };
    });
  }
  const root = object(input, "\u6587\u4EF6");
  if (Array.isArray(root.entities)) {
    if (!root.entities.length)
      throw new EntityImportError("entities \u4E0D\u80FD\u4E3A\u7A7A");
    return root.entities.map((entity, index) => ({ version: root.version, entity: object(entity, `entities[${index}]`) }));
  }
  return [root];
}
function parseEntityImport(input) {
  const root = object(input, "\u6587\u4EF6");
  if (root.version !== 1)
    throw new EntityImportError("version \u5FC5\u987B\u4E3A 1");
  const entity = object(root.entity, "entity");
  const allowed = new Set(["id", "name", "description", "aliases", "tags", "categories", "images", "videos", "pdf", "link", "visibility", "type", "attributes"]);
  for (const key of Object.keys(entity))
    if (!allowed.has(key))
      throw new EntityImportError(`entity \u5305\u542B\u4E0D\u652F\u6301\u7684\u5B57\u6BB5\uFF1A${key}`);
  if (typeof entity.name !== "string" || !entity.name.trim())
    throw new EntityImportError("entity.name \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32");
  const type = typeof entity.type === "string" ? { name: entity.type } : object(entity.type, "entity.type");
  if (!String(type.id || type.name || "").trim())
    throw new EntityImportError("entity.type \u5FC5\u987B\u63D0\u4F9B id \u6216 name");
  if (entity.attributes !== undefined && !Array.isArray(entity.attributes))
    throw new EntityImportError("entity.attributes \u5FC5\u987B\u662F\u6570\u7EC4");
  const hasCategories = Object.prototype.hasOwnProperty.call(entity, "categories");
  let categories = [];
  if (hasCategories) {
    if (!Array.isArray(entity.categories))
      throw new EntityImportError("entity.categories \u5FC5\u987B\u662F\u6570\u7EC4");
    if (entity.categories.length) {
      try {
        categories = parseClassImport({ version: 1, classes: entity.categories });
      } catch (error) {
        throw new EntityImportError(`entity.categories\uFF1A${error instanceof Error ? error.message : "\u683C\u5F0F\u65E0\u6548"}`);
      }
    }
  }
  const attributes = (entity.attributes || []).map((raw, index) => {
    const row = object(raw, `entity.attributes[${index}]`);
    const name = String(row.name || "").trim(), id = String(row.id || "").trim();
    if (!name && !id)
      throw new EntityImportError(`entity.attributes[${index}] \u5FC5\u987B\u63D0\u4F9B id \u6216 name`);
    if (!Object.prototype.hasOwnProperty.call(row, "value"))
      throw new EntityImportError(`entity.attributes[${index}].value \u4E0D\u80FD\u4E3A\u7A7A`);
    const datatype = normalizeDatatype(row.datatype || "string");
    let value;
    try {
      value = normalizeImportedValue(datatype, row.value);
    } catch (error) {
      throw new EntityImportError(`entity.attributes[${index}].value\uFF1A${error instanceof Error ? error.message : "\u683C\u5F0F\u65E0\u6548"}`);
    }
    return { id, name: name || id, datatype, value, description: String(row.description || "").trim() };
  });
  return {
    id: String(entity.id || "").replace(/^entity\//, "").trim(),
    name: entity.name.trim(),
    description: String(entity.description || ""),
    aliases: strings(entity.aliases, "entity.aliases"),
    tags: strings(entity.tags, "entity.tags"),
    images: strings(entity.images, "entity.images"),
    videos: strings(entity.videos, "entity.videos"),
    pdf: String(entity.pdf || "").trim(),
    link: String(entity.link || "").trim(),
    visibility: entity.visibility === "private" ? "private" : "public",
    ontology: { id: String(type.id || "").trim(), name: String(type.name || type.id || "").trim(), description: String(type.description || "").trim() },
    attributes,
    hasCategories,
    categories
  };
}
function parseEntityImports(input) {
  const documents = entityImportDocuments(input);
  return documents.map((document, index) => {
    try {
      return parseEntityImport(document);
    } catch (error) {
      if (documents.length === 1)
        throw error;
      throw new EntityImportError(`\u7B2C ${index + 1} \u4E2A\u5B9E\u4F53\uFF1A${error instanceof Error ? error.message : "\u683C\u5F0F\u65E0\u6548"}`);
    }
  });
}

// src/server/enterprise-entity-import.ts
var key = (value) => String(value || "").trim().toLocaleLowerCase();
var array = (value) => {
  if (Array.isArray(value))
    return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
async function importEnterpriseEntities(store, database, projectId, input, user, legacySchema) {
  const entities = parseEntityImports(input);
  const ids = new Set;
  for (const entity of entities) {
    entity.id ||= randomUUID3();
    if (entity.id.length > 512)
      throw new EntityImportError("\u65E0\u6548\u7684\u77E5\u8BC6 ID");
    if (ids.has(entity.id))
      throw new EntityImportError(`\u6279\u91CF\u6587\u4EF6\u5305\u542B\u91CD\u590D\u5B9E\u4F53 ID\uFF1A${entity.id}`);
    ids.add(entity.id);
  }
  await store.ensureImportSchema(database);
  return store.transaction(database, async (trx) => {
    const savedSchema = await store.importSchema(database, trx);
    const seed = savedSchema ? undefined : legacySchema?.();
    const schema = structuredClone(savedSchema || {
      classes: seed?.classes || [],
      ontologies: seed?.ontologies || [],
      properties: seed?.properties || [],
      ontology_properties: seed?.ontology_properties || []
    });
    schema.ontology_properties ||= [];
    const headers = { "x-arango-trx-id": trx };
    const write = async (collection, documents) => {
      for (let offset = 0;offset < documents.length; offset += 250) {
        const { body } = await store.client.database(database, `/_api/document/${collection}?overwriteMode=replace`, {
          method: "POST",
          headers,
          body: JSON.stringify(documents.slice(offset, offset + 250))
        });
        if (!Array.isArray(body) || body.some((row) => row.error))
          throw new Error(`ArangoDB ${collection} \u6279\u91CF\u5199\u5165\u5931\u8D25`);
      }
    };
    const nodes = new Map;
    const previous = new Map;
    const incoming = new Map;
    for (const entity of entities) {
      const old = await store.get(database, entity.id, trx);
      if (old && !canUseArangoKnowledge(old, user, "edit"))
        throw new KnowledgeStoreError("\u65E0\u6743\u4FEE\u6539\u8BE5\u77E5\u8BC6", 403);
      if (old && old.visibility !== entity.visibility && !canUseArangoKnowledge(old, user, "manage")) {
        throw new KnowledgeStoreError("\u4EC5\u7BA1\u7406\u8005\u53EF\u4FEE\u6539\u53EF\u89C1\u6027", 403);
      }
      previous.set(entity.id, old);
      for (const label of new Set([entity.id, entity.name, ...entity.aliases].map(key))) {
        incoming.set(label, [...incoming.get(label) || [], entity]);
      }
    }
    const ensureOntology = (definition) => {
      let ontology = definition.id && schema.ontologies.find((row) => row.id === definition.id) || schema.ontologies.find((row) => key(row.name) === key(definition.name));
      const created = !ontology;
      if (!ontology) {
        ontology = {
          ...definition,
          id: definition.id || `ontology/${randomUUID3()}`,
          alias: [definition.name],
          parent_id: null,
          project_id: projectId,
          display_shape: "rectangle",
          sort_order: schema.ontologies.length + 1
        };
        schema.ontologies.push(ontology);
      }
      ontology.status = "active";
      return { ontology, created };
    };
    const results = [];
    for (const entity of entities) {
      const { ontology, created } = ensureOntology(entity.ontology);
      let categoriesCreated = 0, categoriesUpdated = 0;
      const categoryIds = [], categoryTags = [];
      const category = (definition, parentId) => {
        let row = schema.classes.find((row2) => (row2.parent_id || null) === parentId && key(row2.name) === key(definition.name));
        if (row) {
          for (const field of definition.provided)
            if (["description", "color", "image", "tags"].includes(field))
              row[field] = definition[field];
          categoriesUpdated++;
        } else {
          row = {
            id: `class/${randomUUID3()}`,
            name: definition.name,
            description: definition.description,
            color: definition.color,
            image: definition.image,
            tags: definition.tags,
            parent_id: parentId,
            project_id: projectId,
            sort_order: schema.classes.length + 1
          };
          schema.classes.push(row);
          categoriesCreated++;
        }
        categoryIds.push(row.id);
        categoryTags.push(...array(row.tags));
        for (const child of definition.children)
          category(child, row.id);
      };
      for (const definition of entity.categories)
        category(definition, null);
      nodes.set(entity.id, store.patch(previous.get(entity.id), {
        id: entity.id,
        name: entity.name,
        description: entity.description,
        aliases: entity.aliases,
        typeId: ontology.id,
        tags: [...new Map([...entity.tags, ...categoryTags].map((tag) => [key(tag), tag])).values()],
        images: entity.images,
        videos: entity.videos,
        pdf: entity.pdf,
        link: entity.link,
        visibility: entity.visibility,
        ...entity.hasCategories ? { categoryIds } : {}
      }, projectId, user));
      results.push({
        entityId: entity.id,
        entityCreated: !previous.get(entity.id),
        entityUpdated: Boolean(previous.get(entity.id)),
        ontologyId: ontology.id,
        ontologyCreated: created,
        propertiesCreated: 0,
        attributesCreated: 0,
        attributesUpdated: 0,
        referencedEntitiesCreated: 0,
        referencedEntitiesMatched: 0,
        categoriesCreated,
        categoriesUpdated,
        categoriesLinked: categoryIds.length
      });
    }
    const references = new Map;
    for (const [index, entity] of entities.entries()) {
      const result = results[index];
      const resolveReference = async (value) => {
        if (Array.isArray(value)) {
          const resolved = [];
          for (const item of value)
            resolved.push(await resolveReference(item));
          return resolved;
        }
        const id = cleanKnowledgeId(value.id);
        const labels = [value.label_zh, value.entity_label_zh, value.label, value.name].filter(Boolean).map(String);
        let target = id ? nodes.get(id) || references.get(id) || await store.get(database, id, trx) : null;
        if (target && !canUseArangoKnowledge(target, user, "read"))
          throw new KnowledgeStoreError("\u5F15\u7528\u7684\u77E5\u8BC6\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u8BBF\u95EE", 403);
        if (!target && labels.length) {
          const candidates = await store.query(database, `FOR doc IN entity
            LET names = APPEND(VALUES(NOT_NULL(doc.labels, {}))[*].value, FLATTEN(VALUES(NOT_NULL(doc.aliases, {})))[*].value)
            FILTER LENGTH(INTERSECTION(@labels, (FOR name IN names RETURN LOWER(TRIM(name))))) > 0 RETURN doc`, { labels: labels.map(key) }, trx);
          target = candidates.find((node) => canUseArangoKnowledge(node, user, "read")) || null;
        }
        if (!target) {
          const candidates = new Map;
          for (const label of [id, ...labels])
            for (const candidate of incoming.get(key(label)) || [])
              candidates.set(candidate.id, candidate);
          if (candidates.size === 1)
            target = nodes.get([...candidates.keys()][0]) || null;
        }
        if (!target)
          target = [...references.values()].find((node) => labels.some((label) => key(localizedText(node.labels)) === key(label))) || null;
        if (target)
          result.referencedEntitiesMatched++;
        else {
          const referenceId = id || `reference-${randomUUID3()}`;
          if (referenceId.length > 512)
            throw new EntityImportError("\u65E0\u6548\u7684\u5F15\u7528\u5B9E\u4F53 ID");
          const { ontology } = ensureOntology({ id: "ontology/wikibase-item", name: "\u5B9E\u4F53\u6761\u76EE", description: "\u7531\u5B9E\u4F53\u5BFC\u5165\u4E2D\u7684 wikibase-item \u5C5E\u6027\u503C\u81EA\u52A8\u521B\u5EFA" });
          target = store.patch(null, {
            id: referenceId,
            name: labels[0] || referenceId,
            typeId: ontology.id,
            description: `\u7531\u5B9E\u4F53\u5C5E\u6027\u5F15\u7528\u81EA\u52A8\u521B\u5EFA\uFF08${referenceId}\uFF09`,
            visibility: entity.visibility,
            link: `https://www.wikidata.org/wiki/${encodeURIComponent(referenceId)}`
          }, projectId, user);
          references.set(referenceId, target);
          result.referencedEntitiesCreated++;
        }
        return { ...value, id: target.sqlite_id || target.id, label_zh: value.label_zh || localizedText(target.labels), "entity-type": "item" };
      };
      const attrs = await store.attributes(database, entity.id, trx);
      const existingKeys = new Set(attrs.map((attr) => attr.key));
      const replacements = new Map;
      for (const attribute of entity.attributes) {
        let property = attribute.id && schema.properties.find((row) => row.id === attribute.id) || schema.properties.find((row) => key(row.name) === key(attribute.name));
        if (!property) {
          property = {
            id: attribute.id || `property/${randomUUID3()}`,
            name: attribute.name,
            alias: [attribute.name],
            description: attribute.description,
            project_id: projectId
          };
          schema.properties.push(property);
          result.propertiesCreated++;
        }
        Object.assign(property, { datatype: attribute.datatype, valuetype: valueTypeFor(attribute.datatype), status: "active" });
        if (!schema.ontology_properties.some((row) => row.ontology_id === result.ontologyId && row.property_id === property.id)) {
          schema.ontology_properties.push({ ontology_id: result.ontologyId, property_id: property.id });
        }
        const value = normalizeValue(attribute.datatype, attribute.datatype === "wikibase-item" ? await resolveReference(attribute.value) : attribute.value);
        if (existingKeys.has(property.id) || replacements.has(property.id))
          result.attributesUpdated++;
        else
          result.attributesCreated++;
        replacements.set(property.id, {
          id: `attr/${randomUUID3()}`,
          node_id: entity.id,
          key: property.id,
          value: typeof value === "object" ? JSON.stringify(value) : String(value),
          datatype: uiDatatype(attribute.datatype),
          property_name_snapshot: property.name,
          statement_json: JSON.stringify({ property: property.id, datatype: attribute.datatype, snaktype: "value", value }),
          created_at: new Date().toISOString()
        });
      }
      if (replacements.size) {
        await store.query(database, "FOR edge IN link FILTER edge._from == @vertex AND edge.property_id IN @properties REMOVE edge IN link", { vertex: `entity/${nodes.get(entity.id)._key}`, properties: [...replacements.keys()] }, trx);
        await write("link", edgeDocuments({ id: entity.id }, [...replacements.values()]));
      }
    }
    await write("entity", [...nodes.values(), ...references.values()]);
    await write("knowledge_schema", [{ _key: "definitions", ...schema }]);
    if (results.length === 1)
      return results[0];
    const totals = {};
    for (const field of ["propertiesCreated", "attributesCreated", "attributesUpdated", "referencedEntitiesCreated", "referencedEntitiesMatched", "categoriesCreated", "categoriesUpdated", "categoriesLinked"]) {
      totals[field] = results.reduce((sum, result) => sum + result[field], 0);
    }
    return {
      batch: true,
      total: results.length,
      created: results.filter((row) => row.entityCreated).length,
      updated: results.filter((row) => row.entityUpdated).length,
      entityId: results[0].entityId,
      entityIds: results.map((row) => row.entityId),
      entities: results,
      ...totals
    };
  }, ["knowledge_schema"]);
}

// src/server/enterprise-ontology-import.ts
import { randomUUID as randomUUID4 } from "crypto";

// src/server/ontology-import.ts
class OntologyImportError extends Error {
}
var shapes = new Set(["rectangle", "rounded", "circle", "diamond", "hexagon"]);
function parseOntologyImport(input) {
  const fail = (message) => {
    throw new OntologyImportError(message);
  };
  const object2 = (value, path) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      fail(`${path} \u5FC5\u987B\u662F\u5BF9\u8C61`);
    return value;
  };
  const root = object2(input, "\u6587\u4EF6");
  if (root.version !== 1)
    fail("version \u5FC5\u987B\u4E3A 1\uFF0C\u8BF7\u53C2\u8003\u793A\u4F8B\u6587\u4EF6");
  for (const key2 of Object.keys(root))
    if (!["version", "ontologies"].includes(key2))
      fail(`\u6587\u4EF6\u5305\u542B\u4E0D\u652F\u6301\u7684\u5B57\u6BB5\uFF1A${key2}`);
  if (!Array.isArray(root.ontologies) || !root.ontologies.length)
    fail("ontologies \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4");
  let count = 0;
  const parse = (value, path, depth) => {
    if (++count > 1000)
      fail("\u4E00\u6B21\u6700\u591A\u5BFC\u5165 1000 \u4E2A\u672C\u4F53");
    if (depth > 32)
      fail("\u672C\u4F53\u5C42\u7EA7\u4E0D\u80FD\u8D85\u8FC7 32 \u5C42");
    const row = object2(value, path);
    for (const key2 of Object.keys(row))
      if (!["name", "description", "alias", "color", "display_shape", "properties", "children"].includes(key2))
        fail(`${path} \u5305\u542B\u4E0D\u652F\u6301\u7684\u5B57\u6BB5\uFF1A${key2}`);
    if (typeof row.name !== "string" || !row.name.trim())
      fail(`${path}.name \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
    if (row.description !== undefined && typeof row.description !== "string")
      fail(`${path}.description \u5FC5\u987B\u662F\u5B57\u7B26\u4E32`);
    if (row.alias !== undefined && (!Array.isArray(row.alias) || row.alias.some((item) => typeof item !== "string" || !item.trim())))
      fail(`${path}.alias \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32\u7EC4\u6210\u7684\u6570\u7EC4`);
    if (row.color != null && (typeof row.color !== "string" || !/^#[\da-f]{6}$/i.test(row.color)))
      fail(`${path}.color \u5FC5\u987B\u662F #RRGGBB \u683C\u5F0F`);
    if (row.display_shape !== undefined && !shapes.has(String(row.display_shape)))
      fail(`${path}.display_shape \u4E0D\u652F\u6301\u8BE5\u5F62\u72B6`);
    if (row.children !== undefined && !Array.isArray(row.children))
      fail(`${path}.children \u5FC5\u987B\u662F\u6570\u7EC4`);
    if (row.properties !== undefined && !Array.isArray(row.properties))
      fail(`${path}.properties \u5FC5\u987B\u662F\u6570\u7EC4`);
    const properties = (row.properties || []).map((value2, index) => {
      const property = object2(value2, `${path}.properties[${index}]`);
      for (const key2 of Object.keys(property))
        if (!["name", "alias", "datatype", "description", "types", "tail_ontology_id"].includes(key2))
          fail(`${path}.properties[${index}] \u5305\u542B\u4E0D\u652F\u6301\u7684\u5B57\u6BB5\uFF1A${key2}`);
      if (typeof property.name !== "string" || !property.name.trim())
        fail(`${path}.properties[${index}].name \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
      if (property.alias !== undefined && (!Array.isArray(property.alias) || property.alias.some((item) => typeof item !== "string" || !item.trim())))
        fail(`${path}.properties[${index}].alias \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
      const datatype = normalizeDatatype(property.datatype || "string");
      if (!datatypeValueTypes[datatype])
        fail(`${path}.properties[${index}].datatype \u4E0D\u652F\u6301\u8BE5\u6570\u636E\u7C7B\u578B`);
      if (property.description !== undefined && typeof property.description !== "string")
        fail(`${path}.properties[${index}].description \u5FC5\u987B\u662F\u5B57\u7B26\u4E32`);
      if (property.types !== undefined && (!Array.isArray(property.types) || property.types.some((item) => typeof item !== "string" || !item.trim())))
        fail(`${path}.properties[${index}].types \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
      if (property.tail_ontology_id !== undefined && typeof property.tail_ontology_id !== "string")
        fail(`${path}.properties[${index}].tail_ontology_id \u5FC5\u987B\u662F\u5B57\u7B26\u4E32`);
      const name = property.name.trim();
      return {
        provided: Object.keys(property),
        name,
        alias: [...new Set([name, ...(property.alias || []).map((item) => item.trim())])],
        datatype,
        description: String(property.description || "").trim(),
        types: [...new Set((property.types || []).map((item) => item.trim()).filter(Boolean))],
        tail_ontology_id: String(property.tail_ontology_id || "").trim()
      };
    });
    return {
      provided: Object.keys(row),
      name: row.name.trim(),
      description: String(row.description || "").trim(),
      alias: [...new Set([row.name.trim(), ...(row.alias || []).map((item) => item.trim())])],
      color: row.color || null,
      display_shape: String(row.display_shape || "rectangle"),
      properties,
      children: (row.children || []).map((child, index) => parse(child, `${path}.children[${index}]`, depth + 1))
    };
  };
  return root.ontologies.map((row, index) => parse(row, `ontologies[${index}]`, 1));
}

// src/server/enterprise-ontology-import.ts
var key2 = (value) => String(value || "").trim().toLowerCase();
var aliases = (value) => {
  if (Array.isArray(value))
    return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return String(value || "").split(/[,\uFF0C;\uFF1B\u3001\n]+/);
  }
};
async function importEnterpriseOntologies(store, database, projectId, input, legacySchema) {
  const roots = parseOntologyImport(input);
  await store.ensureImportSchema(database);
  return store.transaction(database, async (trx) => {
    const saved = await store.importSchema(database, trx);
    const seed = saved || legacySchema?.();
    const schema = structuredClone({
      classes: seed?.classes || [],
      ontologies: seed?.ontologies || [],
      properties: seed?.properties || [],
      ontology_properties: seed?.ontology_properties || []
    });
    let created = 0, updated = 0;
    const visit = (node, parentId) => {
      const siblings = schema.ontologies.filter((row2) => (row2.parent_id || null) === parentId);
      let row = siblings.find((row2) => key2(row2.name) === key2(node.name));
      if (!row || node.provided.includes("alias")) {
        const wanted = new Set(node.alias.map(key2));
        const conflict = siblings.find((other) => other !== row && [other.name, ...aliases(other.alias)].some((value) => wanted.has(key2(value))));
        if (conflict)
          throw new OntologyImportError(`\u672C\u4F53\u201C${node.name}\u201D\u7684\u540D\u79F0\u6216\u522B\u540D\u4E0E\u540C\u7EA7\u672C\u4F53\u201C${conflict.name}\u201D\u51B2\u7A81`);
      }
      if (row) {
        for (const field of ["description", "alias", "color", "display_shape"]) {
          if (node.provided.includes(field))
            row[field] = node[field];
        }
        row.status = "active";
        updated++;
      } else {
        row = {
          id: `ontology/${randomUUID4()}`,
          name: node.name,
          description: node.description,
          alias: node.alias,
          color: node.color,
          display_shape: node.display_shape,
          parent_id: parentId,
          project_id: projectId,
          status: "active",
          sort_order: Math.max(0, ...siblings.map((sibling) => Number(sibling.sort_order) || 0)) + 1
        };
        schema.ontologies.push(row);
        created++;
      }
      for (const property of node.properties) {
        let existing = schema.properties.find((item) => key2(item.name) === key2(property.name));
        if (!existing) {
          existing = { id: `property/${randomUUID4()}` };
          schema.properties.push(existing);
        }
        Object.assign(existing, {
          name: property.name,
          alias: property.alias,
          status: "active",
          datatype: property.datatype,
          valuetype: valueTypeFor(property.datatype),
          types: property.types,
          description: property.description,
          project_id: projectId,
          tail_ontology_id: property.tail_ontology_id || null
        });
        if (!schema.ontology_properties.some((link) => link.ontology_id === row.id && link.property_id === existing.id)) {
          schema.ontology_properties.push({ ontology_id: row.id, property_id: existing.id });
        }
      }
      for (const child of node.children)
        visit(child, row.id);
    };
    for (const root of roots)
      visit(root, null);
    const { body } = await store.client.database(database, "/_api/document/knowledge_schema?overwriteMode=replace", {
      method: "POST",
      headers: { "x-arango-trx-id": trx },
      body: JSON.stringify([{ _key: "definitions", ...schema }])
    });
    if (!Array.isArray(body) || body.some((row) => row.error))
      throw new Error("ArangoDB \u672C\u4F53\u5B9A\u4E49\u5199\u5165\u5931\u8D25");
    return { created, updated, total: created + updated };
  }, ["knowledge_schema"]);
}

// src/server/ontology-filter.ts
function hiddenKnowledgeTypes(ontologies = []) {
  const names = new Set(["entity", "\u5B9E\u4F53", "\u5B9E\u4F53\u6761\u76EE", "wikibase item"]);
  const hidden = new Set([...names, "ontology/wikibase-item"]);
  for (const ontology of ontologies) {
    let aliases2 = ontology.alias;
    if (typeof aliases2 === "string") {
      try {
        aliases2 = JSON.parse(aliases2);
      } catch {
        aliases2 = [aliases2];
      }
    }
    if ([ontology.name, ...Array.isArray(aliases2) ? aliases2 : []].some((value) => names.has(String(value || "").trim().toLowerCase())) || String(ontology.description || "").toLowerCase().includes("wikibase-item \u5C5E\u6027\u503C\u81EA\u52A8\u521B\u5EFA")) {
      if (ontology.id)
        hidden.add(String(ontology.id));
    }
  }
  return [...hidden];
}

// src/server/relation-insights.ts
var idOf = (node) => String(node.sqlite_id || node.id || "").replace(/^entity\//, "");
function buildRelationInsights(center, paths, format, truncated = false) {
  const centerId = idOf(center), direct = new Map, indirect = new Map;
  const incomingRelations = [], neighbors = new Map, edgeIds = new Set;
  const step = (edge, from, to) => ({
    id: String(edge.sqlite_id || edge._key),
    source: String(edge.source_id || idOf(edge._from === from._id ? from : to)).replace(/^entity\//, ""),
    target: String(edge.target_id || idOf(edge._to === to._id ? to : from)).replace(/^entity\//, ""),
    propertyId: edge.property_id,
    propertyName: edge.property_name || edge.property_id || "\u5173\u8054",
    direction: edge._from === from._id ? "outgoing" : "incoming"
  });
  for (const path of paths) {
    if (path.edges?.length !== 1 || path.vertices?.length !== 2)
      continue;
    const other = path.vertices[1], otherId = idOf(other), edge = path.edges[0];
    if (!otherId || otherId === centerId)
      continue;
    const identity = edge._key || `${edge.sqlite_id}:${edge._from}:${edge._to}`;
    if (edgeIds.has(identity))
      continue;
    edgeIds.add(identity);
    const relation = step(edge, path.vertices[0], other);
    if (!direct.has(otherId))
      direct.set(otherId, { node: format(other), relations: [] });
    direct.get(otherId).relations.push(relation);
    const legacyEdge = {
      id: `${edge.sqlite_id}:${edge.target_id}`,
      source: relation.source,
      target: relation.target,
      type: relation.propertyId,
      label: relation.propertyName,
      isAttribute: true
    };
    neighbors.set(otherId, { node: format(other), edge: legacyEdge });
    if (relation.direction === "incoming")
      incomingRelations.push({ source: format(other), propertyId: relation.propertyId, propertyName: relation.propertyName });
  }
  const pathIds = new Set;
  for (const path of paths) {
    if (path.edges?.length !== 2 || path.vertices?.length !== 3)
      continue;
    const target = path.vertices[2], targetId = idOf(target), viaId = idOf(path.vertices[1]);
    if (!targetId || targetId === centerId || direct.has(targetId))
      continue;
    const identity = path.edges.map((edge) => edge._key || `${edge.sqlite_id}:${edge._from}:${edge._to}`).join("|");
    if (pathIds.has(identity))
      continue;
    pathIds.add(identity);
    if (!indirect.has(targetId))
      indirect.set(targetId, { node: format(target), via: new Set, pathCount: 0, paths: [] });
    const candidate = indirect.get(targetId);
    candidate.via.add(viaId);
    candidate.pathCount++;
    if (candidate.paths.length < 3)
      candidate.paths.push({
        nodes: path.vertices.map(format),
        steps: path.edges.map((edge, index) => step(edge, path.vertices[index], path.vertices[index + 1]))
      });
    if (path.edges[0]._to === center._id && path.edges[1]._to === path.vertices[1]._id) {
      for (const relation of incomingRelations.filter((item) => item.source.id === viaId)) {
        relation.secondLevel ||= [];
        if (!relation.secondLevel.some((child) => child.source.id === targetId && child.propertyId === path.edges[1].property_id)) {
          relation.secondLevel.push({
            source: format(target),
            propertyId: path.edges[1].property_id,
            propertyName: path.edges[1].property_name || path.edges[1].property_id || "\u5173\u8054"
          });
        }
      }
    }
  }
  const directItems = [...direct.values()].sort((a, b2) => b2.relations.length - a.relations.length || String(a.node.name).localeCompare(String(b2.node.name), "zh-CN"));
  const indirectItems = [...indirect.values()].map(({ via, ...item }) => ({ ...item, sharedConnections: via.size })).sort((a, b2) => b2.sharedConnections - a.sharedConnections || b2.pathCount - a.pathCount || String(a.node.name).localeCompare(String(b2.node.name), "zh-CN"));
  const relations = directItems.flatMap((item) => item.relations);
  const populations = new Map;
  for (const [targetId, item] of indirect)
    for (const via of item.via) {
      if (!populations.has(via))
        populations.set(via, new Set);
      populations.get(via).add(targetId);
    }
  const recommendations = [];
  for (const item of indirectItems) {
    if (item.node.type === "ontology/wikibase-item" || ["\u5B9E\u4F53\u6761\u76EE", "wikibase item"].includes(String(item.node.typeLabel || item.node.ontology?.name || "").trim().toLowerCase()))
      continue;
    const evidence = paths.filter((path) => path.edges?.length === 2 && idOf(path.vertices[2]) === item.node.id);
    const independent = new Map, sameRole = new Map;
    for (const path of evidence) {
      const via = path.vertices[1], first = step(path.edges[0], path.vertices[0], via), second = step(path.edges[1], via, path.vertices[2]);
      independent.set(idOf(via), { via, first, second });
      if (first.propertyId && first.propertyId === second.propertyId && first.direction !== second.direction) {
        sameRole.set(`${idOf(via)}:${first.propertyId}:${first.direction}`, { via, first });
      }
    }
    const reasons = [];
    let score = 0;
    for (const [viaId] of independent)
      score += 1 / Math.log2(2 + (populations.get(viaId)?.size || 1));
    for (const { via, first } of sameRole.values()) {
      score += 1.5 / Math.log2(2 + (populations.get(idOf(via))?.size || 1));
      const name = format(via).name || idOf(via);
      reasons.push(first.direction === "outgoing" ? `\u4E0E\u5F53\u524D\u5B9E\u4F53\u540C\u6837\u901A\u8FC7\u201C${first.propertyName}\u201D\u5173\u8054\u5230\u201C${name}\u201D` : `\u201C${name}\u201D\u901A\u8FC7\u201C${first.propertyName}\u201D\u540C\u65F6\u5173\u8054\u5230\u8FD9\u4E24\u4E2A\u5B9E\u4F53`);
    }
    const viaNames = [...independent.values()].map(({ via }) => format(via).name || idOf(via));
    if (independent.size > 1)
      reasons.unshift(`\u5171\u540C\u5173\u8054${viaNames.slice(0, 3).map((name) => `\u201C${name}\u201D`).join("\u3001")}${independent.size > 3 ? `\u7B49 ${independent.size} \u4E2A\u5B9E\u4F53` : ""}`);
    else if (!reasons.length)
      reasons.push(`\u901A\u8FC7\u5171\u540C\u5173\u8054\u7684\u201C${viaNames[0]}\u201D\u53D1\u73B0`);
    if (independent.size === 1 && !sameRole.size && (populations.get([...independent.keys()][0])?.size || 0) > 10)
      continue;
    const rankedEvidence = [...evidence].sort((a, b2) => {
      const matches = (path) => path.edges[0].property_id === path.edges[1].property_id && step(path.edges[0], path.vertices[0], path.vertices[1]).direction !== step(path.edges[1], path.vertices[1], path.vertices[2]).direction;
      return Number(matches(b2)) - Number(matches(a));
    });
    const shownVia = new Set, samples = [];
    for (const path of rankedEvidence) {
      const via = idOf(path.vertices[1]);
      if (shownVia.has(via))
        continue;
      shownVia.add(via);
      samples.push({ nodes: path.vertices.map(format), steps: path.edges.map((edge, index) => step(edge, path.vertices[index], path.vertices[index + 1])) });
      if (samples.length === 3)
        break;
    }
    recommendations.push({
      ...item,
      paths: samples,
      score,
      reasons: [...new Set(reasons)].slice(0, 3),
      evidenceLabel: independent.size > 1 ? "\u591A\u9879\u5173\u8054\u7EBF\u7D22" : sameRole.size ? "\u76F8\u4F3C\u5173\u7CFB\u7EBF\u7D22" : "\u5171\u540C\u5173\u8054\u7EBF\u7D22"
    });
  }
  recommendations.sort((a, b2) => b2.score - a.score || b2.sharedConnections - a.sharedConnections || String(a.node.name).localeCompare(String(b2.node.name), "zh-CN"));
  return { incomingRelations, neighbors: [...neighbors.values()], relationInsights: {
    direct: directItems,
    indirect: indirectItems,
    recommendations,
    summary: {
      entities: direct.size,
      relations: relations.length,
      incoming: relations.filter((item) => item.direction === "incoming").length,
      outgoing: relations.filter((item) => item.direction === "outgoing").length,
      relationTypes: new Set(relations.map((item) => item.propertyId)).size,
      discoveries: indirect.size
    },
    truncated,
    maxDepth: 2
  } };
}

// src/server/enterprise-reports.ts
import { randomUUID as randomUUID5 } from "crypto";

// src/server/knowledge-reports.ts
function normalizeReportKeywords(value) {
  const input = Array.isArray(value) ? value : String(value || "").split(/[,\uFF0C\u3001;\uFF1B\n]+/);
  return [...new Set(input.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 12);
}

// src/server/enterprise-reports.ts
var identity = (node) => String(node.sqlite_id || node.id || "").replace(/^entity\//, "");
var compact = (value) => String(value || "").replace(/\s+/g, " ").trim().slice(0, 500);
var attributeText = (value) => {
  if (Array.isArray(value))
    return value.map(attributeText).join("\u3001");
  if (value && typeof value === "object")
    return String(value.label_zh || value.label || value.name || value.time || value.amount || value.id || JSON.stringify(value));
  return String(value ?? "");
};
var distribution = (values) => {
  const counts = new Map;
  for (const value of values)
    counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts].map(([label, value]) => ({ label, value })).sort((a, b2) => b2.value - a.value || a.label.localeCompare(b2.label, "zh-CN"));
};
async function buildEnterpriseReport(store, database, title, input, user, legacySchema) {
  const keywords = normalizeReportKeywords(input);
  const terms = [...new Set(keywords.map((term) => term.trim().toLowerCase()).filter(Boolean))];
  const schema = await store.importSchema(database) || legacySchema?.();
  const access = knowledgeReadAccess(user);
  const matches = await store.query(database, `FOR term IN @terms
    LET matches = (FOR doc IN entity FILTER ${access.filter} AND doc.type NOT IN @excluded
      LET names = (FOR item IN VALUES(NOT_NULL(doc.labels, {})) RETURN LOWER(TO_STRING(item.value)))
      LET aliases = (FOR item IN FLATTEN(VALUES(NOT_NULL(doc.aliases, {}))) RETURN LOWER(TO_STRING(item.value)))
      LET descriptions = (FOR item IN VALUES(NOT_NULL(doc.descriptions, {})) RETURN LOWER(TO_STRING(item.value)))
      LET score = (term IN names ? 100 : LENGTH(FOR name IN names FILTER CONTAINS(name, term) RETURN 1) > 0 ? 50 : 0)
        + (term IN aliases ? 80 : LENGTH(FOR name IN aliases FILTER CONTAINS(name, term) RETURN 1) > 0 ? 30 : 0)
        + (LENGTH(FOR text IN descriptions FILTER CONTAINS(text, term) RETURN 1) > 0 ? 5 : 0)
      FILTER score > 0 SORT score DESC, doc._key ASC LIMIT 3 RETURN { node: doc, score })
    RETURN { term, matches }`, { ...access.bindVars, terms, excluded: hiddenKnowledgeTypes(schema?.ontologies) });
  const mains = new Map;
  const unmatched = [];
  let mainLimitReached = false;
  for (const result of matches) {
    const best = result.matches?.find((item2) => canUseArangoKnowledge(item2.node, user));
    if (!best) {
      if (keywords.some((term) => term.toLowerCase() === result.term))
        unmatched.push(result.term);
      continue;
    }
    const id = identity(best.node);
    if (mains.has(id))
      mains.get(id).matchedKeywords.push(result.term);
    else if (mains.size < 8)
      mains.set(id, { node: best.node, matchedKeywords: [result.term], score: best.score });
    else
      mainLimitReached = true;
  }
  const format = (node) => {
    const value = arangoNodeResponse(node, user);
    const type = schema?.ontologies?.find((row) => row.id === node.type);
    return { ...value, typeLabel: type?.name || value.typeLabel || "\u672A\u5206\u7C7B", color: type?.color || "#64748b" };
  };
  const vertices = new Map([...mains].map(([id, item2]) => [id, item2.node]));
  const edges = new Map;
  const contexts = new Map;
  let truncated = mainLimitReached;
  for (const [id] of mains) {
    const [graph2, attributes] = await Promise.all([store.relationPaths(database, id, user, 160), store.attributes(database, id)]);
    truncated ||= graph2.truncated;
    const accepted = [];
    for (const path of graph2.paths) {
      if (!path.vertices?.every((node) => canUseArangoKnowledge(node, user)))
        continue;
      const additions = path.vertices.filter((node) => !vertices.has(identity(node)));
      const edgeAdditions = path.edges.filter((edge) => !edges.has(edge._key));
      if (vertices.size + additions.length > 120 || edges.size + edgeAdditions.length > 240) {
        truncated = true;
        continue;
      }
      for (const node of path.vertices)
        vertices.set(identity(node), node);
      for (const edge of path.edges)
        edges.set(edge._key, edge);
      accepted.push(path);
    }
    contexts.set(id, { paths: accepted, attributes });
  }
  const item = (node, related = false, relation = "") => {
    const value = format(node);
    return {
      id: value.id,
      name: value.name,
      typeLabel: value.typeLabel,
      description: compact(value.description || node.wiki_md) || "\u6682\u65E0\u5185\u5BB9\u6458\u8981\u3002",
      image: value.images?.[0] || "",
      link: value.link || "",
      tags: value.tags || [],
      related,
      relation
    };
  };
  for (const context of contexts.values())
    context.attributes = context.attributes.flatMap((attribute) => {
      let value = attribute.value;
      try {
        value = JSON.parse(value);
      } catch {}
      let datatype = attribute.datatype;
      try {
        datatype = JSON.parse(attribute.statement_json || "{}").datatype || datatype;
      } catch {}
      if (["wikibase-item", "wikibase-entityid"].includes(datatype)) {
        const values = (Array.isArray(value) ? value : [value]).filter((item2) => item2?.id && vertices.has(String(item2.id).replace(/^entity\//, "")));
        if (!values.length)
          return [];
        value = values;
      }
      return [{ ...attribute, value: compact(attributeText(value)) }];
    });
  const sections = [...mains].map(([id, main]) => {
    const context = contexts.get(id);
    const related = new Map;
    for (const path of context.paths) {
      const target = path.vertices[path.vertices.length - 1], targetId = identity(target);
      if (targetId === id || related.has(targetId))
        continue;
      let evidence = String(format(path.vertices[0]).name);
      path.edges.forEach((edge, index) => {
        const name = edge.property_name || edge.property_id || "\u5173\u8054", next = format(path.vertices[index + 1]).name;
        evidence += edge._from === path.vertices[index]._id ? ` \u2014 ${name} \u2192 ${next}` : ` \u2190 ${name} \u2014 ${next}`;
      });
      related.set(targetId, item(target, true, compact(evidence)));
    }
    return {
      keyword: id,
      title: format(main.node).name,
      introduction: `\u5339\u914D\u5173\u952E\u8BCD\uFF1A${main.matchedKeywords.join("\u3001")}\u3002${compact(format(main.node).description)}`,
      items: [item(main.node), ...[...related.values()].slice(0, 12)],
      attributes: context.attributes.slice(0, 30).map((attribute) => ({
        name: attribute.property_name_snapshot || attribute.key,
        value: compact(attribute.value),
        datatype: attribute.datatype
      })),
      attributeCount: context.attributes.length
    };
  });
  const formatted = [...vertices.values()].map(format);
  const relationEdges = [...edges.values()];
  const handles = new Map([...vertices.values()].map((node) => [node._id, identity(node)]));
  const graph = {
    nodes: formatted.map((value) => ({ data: {
      id: value.id,
      label: value.name,
      name: value.name,
      type: value.typeLabel,
      color: value.color,
      isMain: mains.has(value.id) ? 1 : 0
    } })),
    edges: relationEdges.map((edge) => ({ data: {
      id: edge._key,
      source: String(edge.source_id || handles.get(edge._from)).replace(/^entity\//, ""),
      target: String(edge.target_id || handles.get(edge._to)).replace(/^entity\//, ""),
      label: edge.property_name || edge.property_id || "\u5173\u8054"
    } }))
  };
  const degrees = [...mains].map(([id, main]) => ({
    label: format(main.node).name,
    value: new Set(graph.edges.filter((edge) => edge.data.source === id || edge.data.target === id).map((edge) => edge.data.source === id ? edge.data.target : edge.data.source)).size
  }));
  const attributeCount = [...contexts.values()].reduce((sum, context) => sum + context.attributes.length, 0);
  return {
    title,
    keywords,
    summary: mains.size ? `\u56F4\u7ED5${keywords.map((value) => `\u201C${value}\u201D`).join("\u3001")}\u5339\u914D ${mains.size} \u4E2A\u4E3B\u5B9E\u4F53\uFF0C\u6574\u7406 ${vertices.size} \u4E2A\u5B9E\u4F53\u3001${edges.size} \u6761\u5173\u7CFB\u548C ${attributeCount} \u9879\u4E3B\u5B9E\u4F53\u5C5E\u6027\u3002${truncated ? "\u5173\u8054\u8F83\u591A\uFF0C\u62A5\u544A\u5C55\u793A\u90E8\u5206\u5206\u6790\u7ED3\u679C\u3002" : ""}` : "\u672A\u627E\u5230\u4E0E\u5173\u952E\u8BCD\u5339\u914D\u4E14\u53EF\u8BBF\u95EE\u7684\u4E3B\u5B9E\u4F53\uFF0C\u8BF7\u5C1D\u8BD5\u66F4\u51C6\u786E\u7684\u540D\u79F0\u6216\u522B\u540D\u3002",
    sections,
    sources: formatted.map((value) => ({ id: value.id, name: value.name, link: value.link || "" })),
    graph,
    mainEntities: [...mains].map(([id, main]) => ({ id, name: format(main.node).name, matchedKeywords: main.matchedKeywords })),
    unmatchedKeywords: unmatched,
    statistics: {
      mainEntityCount: mains.size,
      entityCount: vertices.size,
      relationCount: edges.size,
      attributeCount,
      entityTypes: distribution(formatted.map((value) => value.typeLabel)),
      relationTypes: distribution(relationEdges.map((edge) => edge.property_name || edge.property_id || "\u5173\u8054")),
      mainConnections: degrees,
      scope: "\u62A5\u544A\u6240\u5C55\u793A\u7684\u5B9E\u4F53\u4E0E\u5173\u7CFB",
      truncated
    },
    analysis: { source: "arangodb", maxDepth: 2, truncated, maxMainEntities: 8, generatedAt: new Date().toISOString() }
  };
}
async function handleEnterpriseReports(req, url, method, deps) {
  const { store, project, user } = deps, database = String(project.name);
  const parts = url.pathname.slice("/api/kb/reports".length).split("/").filter(Boolean);
  if (parts.length > 2)
    throw new KnowledgeStoreError("\u62A5\u544A\u63A5\u53E3\u4E0D\u5B58\u5728", 404);
  const id = parts[0] ? decodeURIComponent(parts[0]) : "", action = parts[1] || "";
  const write = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (write && !user)
    throw new KnowledgeStoreError("\u8BF7\u5148\u767B\u5F55", 401);
  if (write && !deps.canCreate)
    throw new KnowledgeStoreError("\u9700\u8981\u5E94\u7528\u6210\u5458\u6743\u9650", 403);
  await store.ensure(database);
  try {
    await store.client.database(database, "/_api/collection/knowledge_reports");
  } catch (error) {
    if (error.status !== 404 || error.body?.errorNum !== 1203)
      throw error;
    if (!write)
      return id ? Response.json({ error: "\u62A5\u544A\u4E0D\u5B58\u5728" }, { status: 404 }) : Response.json({ reports: [] });
    await store.client.database(database, "/_api/collection", { method: "POST", body: JSON.stringify({ name: "knowledge_reports", type: 2 }) }).catch((error2) => {
      if (error2.status !== 409)
        throw error2;
    });
  }
  const canEdit = (report) => user?.fullAccess || user?.role === "admin" || report.ownerUserId === user?.id;
  const readable = async (report, visibleIds) => {
    if (!report.sources?.length)
      return canEdit(report);
    const ids = report.sources.map((source) => source.id);
    if (visibleIds)
      return ids.every((id2) => visibleIds.has(id2));
    const access = knowledgeReadAccess(user);
    const allowed = await store.query(database, `FOR doc IN entity FILTER doc.sqlite_id IN @ids AND ${access.filter} RETURN { id: doc.sqlite_id }`, { ...access.bindVars, ids });
    const found = new Set(allowed.map((row) => row.id));
    return ids.every((id2) => found.has(id2));
  };
  const responseReport = (report) => {
    const { _id, _key, _rev, ...result } = report;
    return result;
  };
  if (!id && method === "GET") {
    const reports = await store.query(database, `FOR report IN knowledge_reports SORT report.updatedAt DESC LIMIT 200
      RETURN KEEP(report, ['id', 'title', 'keywords', 'summary', 'ownerUserId', 'createdAt', 'updatedAt', 'sources'])`);
    const ids = [...new Set(reports.flatMap((report) => (report.sources || []).map((source) => source.id)))];
    const access = knowledgeReadAccess(user);
    const allowed = ids.length ? await store.query(database, `FOR doc IN entity FILTER doc.sqlite_id IN @ids AND ${access.filter} RETURN { id: doc.sqlite_id }`, { ...access.bindVars, ids }) : [];
    const visibleIds = new Set(allowed.map((row) => row.id));
    const visible = [];
    for (const report of reports)
      if (await readable(report, visibleIds)) {
        const { sources, ...metadata } = responseReport(report);
        visible.push(metadata);
      }
    return Response.json({ reports: visible });
  }
  let previous = null;
  if (id) {
    try {
      previous = (await store.client.database(database, `/_api/document/knowledge_reports/${encodeURIComponent(id)}`)).body;
    } catch (error) {
      if (error.status !== 404)
        throw error;
    }
    if (!previous)
      throw new KnowledgeStoreError("\u62A5\u544A\u4E0D\u5B58\u5728", 404);
    if (write && !canEdit(previous))
      throw new KnowledgeStoreError("\u65E0\u6743\u4FEE\u6539\u8BE5\u62A5\u544A", 403);
    if (!write && !await readable(previous))
      throw new KnowledgeStoreError("\u62A5\u544A\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u8BBF\u95EE", 404);
  }
  if (id && method === "GET" && !action)
    return Response.json({ report: responseReport(previous) });
  if (id && method === "DELETE" && !action) {
    await store.client.database(database, `/_api/document/knowledge_reports/${encodeURIComponent(id)}`, { method: "DELETE" });
    return Response.json({ ok: true });
  }
  if (method === "POST" && (!id || action === "regenerate") || id && ["PUT", "PATCH"].includes(method) && !action) {
    let body;
    try {
      body = await req.json();
    } catch {
      throw new KnowledgeStoreError("\u8BF7\u6C42\u5185\u5BB9\u65E0\u6548");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new KnowledgeStoreError("\u8BF7\u6C42\u5FC5\u987B\u662F JSON \u5BF9\u8C61");
    const title = String(body.title ?? previous?.title ?? "").trim(), keywords = normalizeReportKeywords(body.keywords ?? previous?.keywords);
    if (!title || !keywords.length)
      throw new KnowledgeStoreError("\u8BF7\u586B\u5199\u6807\u9898\u548C\u81F3\u5C11\u4E00\u4E2A\u5173\u952E\u8BCD");
    const generated = method === "POST" ? await buildEnterpriseReport(store, database, title, keywords, user, deps.legacySchema) : {
      ...responseReport(previous),
      title,
      keywords,
      summary: String(body.summary ?? previous.summary),
      sections: Array.isArray(body.sections) ? body.sections : previous.sections
    };
    const now = new Date().toISOString(), reportId = previous?.id || `report_${randomUUID5()}`;
    const report = {
      ...generated,
      id: reportId,
      _key: reportId,
      project_id: Number(project.id),
      ownerUserId: previous?.ownerUserId || user.id,
      createdAt: previous?.createdAt || now,
      updatedAt: now
    };
    await store.client.database(database, "/_api/document/knowledge_reports?overwriteMode=replace", { method: "POST", body: JSON.stringify(report) });
    return Response.json({ report: responseReport(report) }, { status: previous ? 200 : 201 });
  }
  throw new KnowledgeStoreError("\u4E0D\u652F\u6301\u7684\u62A5\u544A\u64CD\u4F5C", 405);
}

// src/server/arango-knowledge-search.ts
class ArangoKnowledgeSearch {
  store;
  ready = new Map;
  constructor(store) {
    this.store = store;
  }
  async prepare(database) {
    if (!this.ready.has(database)) {
      const task = this.initialize(database);
      this.ready.set(database, task);
      task.catch(() => this.ready.delete(database));
    }
    await this.ready.get(database);
  }
  async initialize(database) {
    await this.store.ensure(database);
    while (true) {
      const updated = await this.store.query(database, `FOR doc IN entity FILTER doc.search_text == null LIMIT 1000
        LET texts = APPEND(APPEND(VALUES(NOT_NULL(doc.labels, {})), VALUES(NOT_NULL(doc.descriptions, {}))), FLATTEN(VALUES(NOT_NULL(doc.aliases, {}))))
        UPDATE doc WITH { search_text: CONCAT_SEPARATOR(' ', texts[*].value) } IN entity RETURN { id: NEW._key }`);
      if (updated.length < 1000)
        break;
    }
    const properties = { links: { entity: { includeAllFields: false, fields: {
      search_text: { analyzers: ["text_zh", "text_en"] },
      sqlite_id: { analyzers: ["identity"] },
      type: { analyzers: ["identity"] }
    } } }, commitIntervalMsec: 1000 };
    try {
      const { body } = await this.store.client.database(database, "/_api/view/knowledge_search/properties");
      const analyzers = body?.links?.entity?.fields?.search_text?.analyzers || [];
      if (!analyzers.includes("text_zh") || !analyzers.includes("text_en")) {
        await this.store.client.database(database, "/_api/view/knowledge_search/properties", { method: "PUT", body: JSON.stringify(properties) });
      }
    } catch (error) {
      if (error.status !== 404 || error.body?.errorNum !== 1203)
        throw error;
      await this.store.client.database(database, "/_api/view", { method: "POST", body: JSON.stringify({ name: "knowledge_search", type: "arangosearch", ...properties }) }).catch((error2) => {
        if (error2.status !== 409)
          throw error2;
      });
    }
  }
  async search(database, user, options) {
    if (options.classIds?.length === 0 || options.definedClasses?.length === 0 || options.definedTypes?.length === 0)
      return { nodes: [], total: 0 };
    await this.prepare(database);
    const access = knowledgeReadAccess(user, "current");
    const q2 = String(options.q || "").trim();
    const search = q2 ? `SEARCH doc.sqlite_id == @q OR doc.type == @q
      OR BOOST(PHRASE(doc.search_text, @q, 'text_zh'), 2) OR PHRASE(doc.search_text, @q, 'text_en')` : "SEARCH true";
    const ascending = options.order?.endsWith("_asc") ? "ASC" : "DESC";
    const sort = options.order === "id" ? "current.sqlite_id ASC" : options.order === "random" ? "RAND()" : options.order?.startsWith("created") ? `current.created_at_sort ${ascending}, current.sqlite_id ASC` : options.order && !["relevance", "hot"].includes(options.order) ? `current.updated_at_sort ${ascending}, current.sqlite_id ASC` : q2 ? "BM25(doc) DESC, current.updated_at_sort DESC, current.sqlite_id ASC" : "current.updated_at_sort DESC, current.sqlite_id ASC";
    const query = `FOR doc IN knowledge_search ${search}
      LET current = DOCUMENT(doc._id)
      FILTER current != null AND ${access.filter}
        AND (@tag == '' OR @tag IN TO_ARRAY(IS_STRING(current.tags) ? JSON_PARSE(current.tags) : current.tags))
        AND (@classes == null OR LENGTH(INTERSECTION(NOT_NULL(current.class_ids, []), @classes)) > 0)
        AND (@type == null OR current.type == @type) AND (!@emptyType OR current.type == null OR current.type == '')
        AND (@definedClasses == null OR LENGTH(INTERSECTION(NOT_NULL(current.class_ids, []), @definedClasses)) > 0)
        AND (@definedTypes == null OR current.type IN @definedTypes) AND current.type NOT IN @excluded
        AND (!@hasImage OR LENGTH(TO_ARRAY(IS_STRING(current.images) ? JSON_PARSE(current.images) : current.images)) > 0)
        AND (!@hasMedia OR LENGTH(TO_ARRAY(IS_STRING(current.images) ? JSON_PARSE(current.images) : current.images)) > 0
          OR LENGTH(TO_ARRAY(IS_STRING(current.videos) ? JSON_PARSE(current.videos) : current.videos)) > 0)
        AND ((@property == '' AND @value == '') OR LENGTH(FOR edge IN link FILTER edge._from == current._id
          AND (@property == '' OR edge.property_id == @property)
          AND (@value == '' OR CONTAINS(LOWER(TO_STRING(edge.value)), @value)) LIMIT 1 RETURN 1) > 0)
      SORT ${sort} LIMIT @offset, @limit RETURN current`;
    const bindVars = {
      ...access.bindVars,
      ...q2 ? { q: q2 } : {},
      tag: String(options.tag || "").trim(),
      classes: options.classIds ?? null,
      type: options.type || null,
      emptyType: Boolean(options.emptyType),
      definedClasses: options.definedClasses ?? null,
      definedTypes: options.definedTypes ?? null,
      excluded: options.excludeTypes || [],
      hasImage: Boolean(options.hasImage),
      hasMedia: Boolean(options.hasMedia),
      property: options.propertyId || "",
      value: String(options.propertyValue || "").trim().toLowerCase(),
      offset: options.offset,
      limit: options.limit
    };
    let { body } = await this.store.client.database(database, "/_api/cursor", {
      method: "POST",
      body: JSON.stringify({ query, bindVars, batchSize: 500, options: { fullCount: true } })
    });
    const nodes = [...body?.result || []];
    let total = body?.extra?.stats?.fullCount, cursor = body?.id;
    try {
      while (body?.hasMore) {
        if (!cursor)
          throw new Error("ArangoSearch \u8FD4\u56DE\u4E86\u4E0D\u5B8C\u6574\u7684\u5206\u9875\u7ED3\u679C");
        ({ body } = await this.store.client.database(database, `/_api/cursor/${encodeURIComponent(cursor)}`, { method: "PUT" }));
        nodes.push(...body?.result || []);
        total = body?.extra?.stats?.fullCount ?? total;
        cursor = body?.id || cursor;
      }
    } finally {
      if (cursor)
        await this.store.client.database(database, `/_api/cursor/${encodeURIComponent(cursor)}`, { method: "DELETE" }).catch(() => {});
    }
    if (!Number.isFinite(total))
      throw new Error("ArangoSearch \u672A\u8FD4\u56DE\u5B8C\u6574\u7684\u7ED3\u679C\u603B\u6570");
    return { nodes, total: Number(total) };
  }
}

// src/server/geographic-search.ts
function geographicBounds(params) {
  const values = ["west", "south", "east", "north"].map((name) => params.has(name) ? Number(params.get(name)) : NaN);
  const [west, south, east, north] = values;
  if (!values.every(Number.isFinite) || Math.abs(west) > 180 || Math.abs(east) > 180 || south < -90 || north > 90 || south >= north || west === east) {
    throw new KnowledgeStoreError("\u65E0\u6548\u7684\u5730\u56FE\u7ECF\u7EAC\u5EA6\u8303\u56F4");
  }
  const width = east > west ? east - west : east - west + 360;
  let longitude = west + width / 2;
  if (longitude > 180)
    longitude -= 360;
  return {
    west,
    south,
    east,
    north,
    wraps: west > east,
    center: [longitude, (south + north) / 2],
    radius: width >= 180 ? 20040000 : Math.min(20040000, 6371000 * Math.PI / 180 * ((north - south) / 2 + width / 2) + 10)
  };
}

class GeographicKnowledgeSearch {
  store;
  ready = new Map;
  text;
  constructor(store) {
    this.store = store;
    this.text = new ArangoKnowledgeSearch(store);
  }
  async prepare(database) {
    if (!this.ready.has(database)) {
      const promise = (async () => {
        await this.store.ensure(database);
        let after = "";
        while (true) {
          const batch = await this.store.query(database, `FOR location IN link
            FILTER location.geo == null AND location._key > @after
              AND (location.mainsnak.datatype IN ['globe-coordinate', 'globecoordinate'] OR location.datatype IN ['globe-coordinate', 'globecoordinate']
                OR location.attribute.datatype IN ['globe-coordinate', 'globecoordinate'])
            SORT location._key ASC LIMIT 500
            RETURN { key: location._key, datatype: NOT_NULL(location.mainsnak.datatype, location.datatype, location.attribute.datatype, ''),
              value: NOT_NULL(location.mainsnak.datavalue.value, location.value, location.attribute.value) }`, { after });
          if (!batch.length)
            break;
          const updates = batch.flatMap((row) => {
            const geo = attributeEarthPoint(row.value, row.datatype);
            return geo ? [{ _key: row.key, geo }] : [];
          });
          if (updates.length) {
            const { body } = await this.store.client.database(database, "/_api/document/link", { method: "PATCH", body: JSON.stringify(updates) });
            if (!Array.isArray(body) || body.some((row) => row.error))
              throw new Error("\u5750\u6807\u7D22\u5F15\u5B57\u6BB5\u8865\u9F50\u5931\u8D25");
          }
          after = batch[batch.length - 1].key;
          if (batch.length < 500)
            break;
        }
        await this.store.client.database(database, "/_api/index?collection=link", { method: "POST", body: JSON.stringify({ name: "knowledge_location_geo", type: "geo", fields: ["geo"], geoJson: true }) });
      })();
      this.ready.set(database, promise);
      promise.catch(() => this.ready.delete(database));
    }
    await this.ready.get(database);
  }
  async search(database, params, user, classIds, excluded) {
    const bounds = geographicBounds(params);
    await this.prepare(database);
    const q2 = (params.get("q") || "").trim();
    if (q2)
      await this.text.prepare(database);
    const access = knowledgeReadAccess(user);
    const query = `${q2 ? "LET textMatches = (FOR hit IN knowledge_search SEARCH PHRASE(hit.search_text, @q, 'text_zh') OR PHRASE(hit.search_text, @q, 'text_en') OR hit.sqlite_id == @q RETURN hit._id)" : ""}
      FOR location IN link
        FILTER GEO_IN_RANGE(@center, location.geo, 0, @radius)
          AND location.mainsnak.datatype IN ['globe-coordinate', 'globecoordinate']
          AND location.geo.coordinates[1] >= @south AND location.geo.coordinates[1] <= @north
          AND (@wraps ? (location.geo.coordinates[0] >= @west OR location.geo.coordinates[0] <= @east) : (location.geo.coordinates[0] >= @west AND location.geo.coordinates[0] <= @east))
        LET doc = DOCUMENT(location._from)
        FILTER doc != null AND ${access.filter} ${q2 ? "AND doc._id IN textMatches" : ""}
          AND (@type == null OR doc.type == @type) AND (!@emptyType OR doc.type == null OR doc.type == '')
          AND doc.type NOT IN @excluded
          AND (@classes == null OR LENGTH(INTERSECTION(NOT_NULL(doc.class_ids, []), @classes)) > 0)
          AND ((@property == '' AND @value == '') OR LENGTH(FOR edge IN link FILTER edge._from == doc._id
            AND (@property == '' OR edge.property_id == @property) AND (@value == '' OR CONTAINS(LOWER(TO_STRING(edge.value)), @value)) LIMIT 1 RETURN 1) > 0)
        COLLECT entityId = doc.sqlite_id, longitude = location.geo.coordinates[0], latitude = location.geo.coordinates[1]
          INTO matches = { node: doc, property: location.property_name }
        LIMIT 1001 RETURN { node: FIRST(matches).node, coordinates: [longitude, latitude], property: FIRST(matches).property }`;
    const rows = await this.store.query(database, query, {
      ...access.bindVars,
      ...bounds,
      ...q2 ? { q: q2 } : {},
      classes: classIds,
      type: params.get("type") || null,
      emptyType: params.has("type") && params.get("type") === "",
      excluded,
      property: params.get("property_id") || "",
      value: (params.get("property_value") || "").toLowerCase()
    });
    return { items: rows.slice(0, 1000).filter((row) => canUseArangoKnowledge(row.node, user)), truncated: rows.length > 1000, limit: 1000 };
  }
}

// src/server/schema-from-knowledge.ts
import { randomUUID as randomUUID6 } from "crypto";
async function deriveSchemaFromKnowledge(store, database, projectId, user, ontologyId = "", legacySchema) {
  await store.ensureImportSchema(database);
  return store.transaction(database, async (trx) => {
    const saved = await store.importSchema(database, trx), seed = saved || legacySchema?.();
    const schema = structuredClone({
      classes: seed?.classes || [],
      ontologies: seed?.ontologies || [],
      properties: seed?.properties || [],
      ontology_properties: seed?.ontology_properties || []
    });
    const access = knowledgeReadAccess(user), targetAccess = knowledgeReadAccess(user, "target");
    const rows = await store.query(database, `FOR edge IN link LET doc = DOCUMENT(edge._from)
      FILTER doc != null AND ${access.filter} AND (@ontology == '' OR doc.type == @ontology)
      LET property = TO_STRING(NOT_NULL(edge.property_id, edge.attribute.key, edge.mainsnak.property, ''))
      FILTER property != ''
      LET target = edge._from != edge._to ? DOCUMENT(edge._to) : null
      LET tail = target != null AND ${targetAccess.filter} ? target.type : null
      COLLECT propertyId = property, propertyName = NOT_NULL(edge.property_name, edge.attribute.property_name_snapshot, property),
        datatype = NOT_NULL(edge.mainsnak.datatype, edge.datatype, edge.attribute.datatype, 'string'),
        ontologyId = doc.type, tailType = tail INTO statements = NOT_NULL(edge.sqlite_id, edge._key)
      RETURN { propertyId, propertyName, datatype, ontologyId, tailType, usage: LENGTH(UNIQUE(statements)) }`, { ...access.bindVars, ontology: ontologyId }, trx);
    const groups = new Map;
    for (const row of rows) {
      const id = String(row.propertyId || "").trim();
      if (!id)
        continue;
      groups.set(id, [...groups.get(id) || [], row]);
    }
    let propertiesCreated = 0, associationsCreated = 0, ontologiesCreated = 0, existingProperties = 0, skippedWithoutType = 0;
    const conflicts = [];
    const ensureOntology = (id) => {
      if (schema.ontologies.some((row) => row.id === id))
        return;
      schema.ontologies.push({
        id,
        name: id,
        alias: [id],
        description: "\u7531\u77E5\u8BC6\u6570\u636E\u4E2D\u7684\u672C\u4F53\u6807\u8BC6\u81EA\u52A8\u8865\u5168",
        parent_id: null,
        project_id: projectId,
        status: "active",
        display_shape: "rectangle",
        sort_order: schema.ontologies.length + 1
      });
      ontologiesCreated++;
    };
    for (const [id, observations] of groups) {
      const types = [...new Set(observations.map((row) => normalizeDatatype(row.datatype)))];
      const existing = schema.properties.find((row) => row.id === id);
      if (types.length !== 1 || !datatypeValueTypes[types[0]] || existing && normalizeDatatype(existing.datatype, existing.valuetype) !== types[0]) {
        conflicts.push({ propertyId: id, datatypes: types, reason: existing ? "\u77E5\u8BC6\u6570\u636E\u7C7B\u578B\u4E0E\u5DF2\u6709\u5C5E\u6027\u5B9A\u4E49\u4E0D\u4E00\u81F4\uFF0C\u672A\u4FEE\u6539\u5DF2\u6709\u914D\u7F6E" : "\u77E5\u8BC6\u6570\u636E\u4E2D\u5B58\u5728\u591A\u79CD\u6216\u4E0D\u652F\u6301\u7684\u6570\u636E\u7C7B\u578B\uFF0C\u672A\u81EA\u52A8\u751F\u6210" });
        continue;
      }
      if (existing?.status === "deprecated") {
        conflicts.push({ propertyId: id, reason: "\u5C5E\u6027\u5DF2\u5E9F\u5F03\uFF0C\u672A\u81EA\u52A8\u5173\u8054", datatypes: types });
        continue;
      }
      if (!existing) {
        const names = new Map;
        for (const row of observations) {
          const name2 = String(row.propertyName || id).trim() || id;
          names.set(name2, (names.get(name2) || 0) + Number(row.usage || 1));
        }
        const name = [...names].sort((a, b2) => Number(a[0] === id) - Number(b2[0] === id) || b2[1] - a[1])[0]?.[0] || id;
        const tails = types[0] === "wikibase-item" ? [...new Set(observations.map((row) => String(row.tailType || "").trim()).filter(Boolean))] : [];
        if (tails.length === 1)
          ensureOntology(tails[0]);
        schema.properties.push({
          id,
          name,
          alias: [name],
          datatype: types[0],
          valuetype: valueTypeFor(types[0]),
          status: "active",
          project_id: projectId,
          description: "\u4ECE\u77E5\u8BC6\u6570\u636E\u4E2D\u53CD\u5411\u751F\u6210",
          types: [],
          tail_ontology_id: tails.length === 1 ? tails[0] : ""
        });
        propertiesCreated++;
      } else
        existingProperties++;
      for (const typeId of new Set(observations.map((row) => String(row.ontologyId || "").trim()))) {
        if (!typeId) {
          skippedWithoutType++;
          continue;
        }
        ensureOntology(typeId);
        if (!schema.ontology_properties.some((link) => link.ontology_id === typeId && link.property_id === id)) {
          schema.ontology_properties.push({ ontology_id: typeId, property_id: id });
          associationsCreated++;
        }
      }
    }
    const { body } = await store.client.database(database, "/_api/document/knowledge_schema?overwriteMode=replace", {
      method: "POST",
      headers: { "x-arango-trx-id": trx },
      body: JSON.stringify([{ _key: "definitions", ...schema }])
    });
    if (!Array.isArray(body) || body.some((row) => row.error))
      throw new Error("\u53CD\u5411\u751F\u6210\u5C5E\u6027\u5931\u8D25\uFF0C\u672C\u6B21\u53D8\u66F4\u5DF2\u56DE\u6EDA");
    return { propertiesCreated, associationsCreated, ontologiesCreated, existingProperties, skippedWithoutType, conflicts, scope: ontologyId || "application" };
  }, ["knowledge_schema"]);
}
async function maintainPropertySchema(store, database, projectId, operation, input, legacySchema) {
  await store.ensureImportSchema(database);
  return store.transaction(database, async (trx) => {
    const saved = await store.importSchema(database, trx), seed = saved || legacySchema?.();
    const schema = structuredClone({ classes: seed?.classes || [], ontologies: seed?.ontologies || [], properties: seed?.properties || [], ontology_properties: seed?.ontology_properties || [] });
    const list2 = (value) => {
      if (typeof value === "string") {
        try {
          value = JSON.parse(value);
        } catch {
          value = [value];
        }
      }
      return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
    };
    let id = String(input.id || input.property_id || "").trim();
    if (operation === "create")
      id = `property/${randomUUID6()}`;
    let property = schema.properties.find((row) => row.id === id);
    if (operation !== "create" && !property)
      throw new KnowledgeStoreError("\u5C5E\u6027\u4E0D\u5B58\u5728", 404);
    if (operation === "link" || operation === "unlink") {
      const ontology = String(input.ontology_id || "").trim();
      if (!schema.ontologies.some((row) => row.id === ontology))
        throw new KnowledgeStoreError("\u672C\u4F53\u4E0D\u5B58\u5728", 404);
      if (operation === "link") {
        if (property.status === "deprecated")
          throw new KnowledgeStoreError("\u4E0D\u80FD\u5173\u8054\u5DF2\u5E9F\u5F03\u7684\u5C5E\u6027");
        if (!schema.ontology_properties.some((row) => row.ontology_id === ontology && row.property_id === id))
          schema.ontology_properties.push({ ontology_id: ontology, property_id: id });
      } else
        schema.ontology_properties = schema.ontology_properties.filter((row) => row.ontology_id !== ontology || row.property_id !== id);
    } else if (operation === "delete")
      property.status = "deprecated";
    else {
      const name = String(input.name ?? property?.name ?? "").trim();
      if (!name)
        throw new KnowledgeStoreError("\u5C5E\u6027\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
      if ((!property || String(property.name).trim().toLowerCase() !== name.toLowerCase()) && schema.properties.some((row) => row.id !== id && String(row.name).trim().toLowerCase() === name.toLowerCase()))
        throw new KnowledgeStoreError("\u540C\u540D\u5C5E\u6027\u5DF2\u5B58\u5728", 409);
      const datatype = normalizeDatatype(input.datatype ?? property?.datatype, input.valuetype ?? property?.valuetype);
      if (!datatypeValueTypes[datatype])
        throw new KnowledgeStoreError("\u4E0D\u652F\u6301\u7684\u6570\u636E\u7C7B\u578B");
      const tail = datatype === "wikibase-item" ? String(input.tail_ontology_id ?? property?.tail_ontology_id ?? "").trim() : "";
      if (tail && !schema.ontologies.some((row) => row.id === tail))
        throw new KnowledgeStoreError("\u5C3E\u5B9E\u4F53\u672C\u4F53\u4E0D\u5B58\u5728");
      const status = input.status ?? property?.status ?? "active";
      if (!["active", "deprecated"].includes(status))
        throw new KnowledgeStoreError("\u5C5E\u6027\u72B6\u6001\u65E0\u6548");
      const values = {
        id,
        name,
        alias: [...new Set([name, ...list2(input.alias ?? property?.alias)])],
        datatype,
        valuetype: valueTypeFor(datatype),
        tail_ontology_id: tail,
        status,
        description: String(input.description ?? property?.description ?? ""),
        project_id: projectId,
        types: list2(input.types ?? property?.types)
      };
      if (property)
        Object.assign(property, values);
      else {
        property = values;
        schema.properties.push(property);
      }
    }
    const { body } = await store.client.database(database, "/_api/document/knowledge_schema?overwriteMode=replace", { method: "POST", headers: { "x-arango-trx-id": trx }, body: JSON.stringify([{ _key: "definitions", ...schema }]) });
    if (!Array.isArray(body) || body.some((row) => row.error))
      throw new Error("\u5C5E\u6027\u4FDD\u5B58\u5931\u8D25\uFF0C\u672C\u6B21\u53D8\u66F4\u5DF2\u56DE\u6EDA");
    return { ok: true, id };
  }, ["knowledge_schema"]);
}

// src/server/routes/enterprise-knowledge.ts
var integer = (value, fallback, max) => {
  const number = Number(value ?? fallback);
  return Number.isSafeInteger(number) && number >= 0 ? Math.min(number, max) : fallback;
};
var schemaReadPaths = new Set(["/api/kb/ontologies", "/api/kb/ontology/tree", "/api/kb/properties", "/api/kb/property_search", "/api/kb/ontology/property"]);
var propertyWritePaths = new Set(["/api/kb/property_create", "/api/kb/property_update", "/api/kb/property_delete", "/api/kb/ontology/property"]);
var enterpriseMediaPath = (path) => /^\/static\/uploads\/(?:.*\/)?(node-images|node-videos|node-pdfs)\//i.test(path.replace(/\/{2,}/g, "/"));
function enterpriseKnowledgePath(path) {
  if (path === "/api/kb/tags")
    return true;
  return enterpriseMediaPath(path) || /^\/api\/kb\/(?:discover\/|geography\/|reports(?:\/|$)|node(?:s)?(?:\/|$)|node-types$|entity(?:_|\/)|attributes(?:\/|$)|relations(?:\/|$)|graph$|edge$|stats$|classes$|gallery_|knowledge-|entry(?:\/|$)|shorts_|fetch$|clean\/)/.test(path) || path.startsWith("/api/wiki/") || path.startsWith("/api/knowledge/") || path.startsWith("/api/comments/") || path.startsWith("/api/sparql/import");
}
function createEnterpriseKnowledgeHandler(deps) {
  const arangoSearch = new ArangoKnowledgeSearch(deps.store);
  const geographicSearch = new GeographicKnowledgeSearch(deps.store);
  return async (req, url, method) => {
    if (!enterpriseKnowledgeEnabled() || !enterpriseKnowledgePath(url.pathname) && !(method === "GET" && schemaReadPaths.has(url.pathname)) && !(method === "POST" && ["/api/kb/ontologies/import", "/api/kb/properties/from-knowledge"].includes(url.pathname)) && !(method === "DELETE" && ["/api/kb/ontologies/clear", "/api/kb/ontologies"].includes(url.pathname)) && !(["POST", "DELETE"].includes(method) && propertyWritePaths.has(url.pathname)))
      return null;
    try {
      if (enterpriseMediaPath(url.pathname)) {
        const projects = url.searchParams.has("db") ? [deps.getProject(url.searchParams.get("db"))].filter(Boolean) : deps.listProjects?.() || [deps.getProject("default")].filter(Boolean);
        const user2 = deps.getUser(req);
        let backendError;
        for (const project2 of projects) {
          let readable = false;
          try {
            readable = await deps.store.mediaReadable(project2.name, url.pathname, user2);
          } catch (error) {
            if (error?.status !== 404 || error?.body?.errorNum !== 1228)
              backendError = error;
            continue;
          }
          if (readable)
            return await deps.serveMedia?.(req, url.pathname) || new Response("Not Found", { status: 404 });
        }
        if (backendError)
          throw backendError;
        return new Response("Not Found", { status: 404 });
      }
      if (url.pathname === "/api/kb/classes" && method === "POST")
        return null;
      const project = deps.getProject(url.searchParams.get("db") || "default");
      if (!project)
        throw new KnowledgeStoreError("\u5E94\u7528\u4E0D\u5B58\u5728", 404);
      const database = project.name;
      const user = deps.getUser(req);
      const path = url.pathname;
      const store = deps.store;
      if (path === "/api/kb/reports" || path.startsWith("/api/kb/reports/")) {
        return await handleEnterpriseReports(req, url, method, {
          store,
          project,
          user,
          canCreate: Boolean(user && deps.canCreate(user, project)),
          legacySchema: () => deps.getSchema?.(project)
        });
      }
      const loggedIn = () => {
        if (!user || user.id <= 0)
          throw new KnowledgeStoreError("\u8BF7\u5148\u767B\u5F55", 401);
        return user;
      };
      const synchronizeWrite = async () => {
        if (!deps.sync)
          return "disabled";
        try {
          await deps.sync.afterWrite(database);
          return "synced";
        } catch (error) {
          console.error("Knowledge saved to ArangoDB; Elasticsearch synchronization will retry:", error);
          return "pending";
        }
      };
      if (path === "/api/kb/ontologies" && method === "DELETE") {
        const current = loggedIn();
        if (!deps.canCreate(current, project))
          throw new KnowledgeStoreError("\u9700\u8981\u5E94\u7528\u6210\u5458\u6743\u9650\u624D\u80FD\u5220\u9664\u672C\u4F53", 403);
        const id2 = (url.searchParams.get("id") || "").trim();
        if (!id2)
          throw new KnowledgeStoreError("\u7F3A\u5C11\u672C\u4F53 ID");
        await store.ensureImportSchema(database);
        const deprecated = await store.transaction(database, async (trx) => {
          const seed = await store.importSchema(database, trx) || deps.getSchema?.(project);
          const schema2 = structuredClone({
            classes: seed?.classes || [],
            ontologies: seed?.ontologies || [],
            properties: seed?.properties || [],
            ontology_properties: seed?.ontology_properties || []
          });
          if (!schema2.ontologies.some((row) => row.id === id2))
            throw new KnowledgeStoreError("\u672C\u4F53\u4E0D\u5B58\u5728", 404);
          const ids = new Set([id2]);
          let added = true;
          while (added) {
            added = false;
            for (const row of schema2.ontologies) {
              if (ids.has(row.parent_id) && !ids.has(row.id)) {
                ids.add(row.id);
                added = true;
              }
            }
          }
          for (const row of schema2.ontologies)
            if (ids.has(row.id))
              row.status = "deprecated";
          const { body: body2 } = await store.client.database(database, "/_api/document/knowledge_schema?overwriteMode=replace", {
            method: "POST",
            headers: { "x-arango-trx-id": trx },
            body: JSON.stringify([{ _key: "definitions", ...schema2 }])
          });
          if (!Array.isArray(body2) || body2.some((row) => row.error))
            throw new Error("ArangoDB \u672C\u4F53\u5220\u9664\u5931\u8D25");
          return ids.size;
        }, ["knowledge_schema"]);
        return Response.json({ ok: true, deprecated });
      }
      if (path === "/api/kb/ontologies/clear" && method === "DELETE") {
        const current = loggedIn();
        if (!deps.canCreate(current, project))
          throw new KnowledgeStoreError("\u9700\u8981\u5E94\u7528\u6210\u5458\u6743\u9650\u624D\u80FD\u6E05\u7A7A\u672C\u4F53", 403);
        await store.ensureImportSchema(database);
        await store.transaction(database, async (trx) => {
          const saved = await store.importSchema(database, trx);
          const seed = saved || deps.getSchema?.(project);
          const { body: body2 } = await store.client.database(database, "/_api/document/knowledge_schema?overwriteMode=replace", {
            method: "POST",
            headers: { "x-arango-trx-id": trx },
            body: JSON.stringify([{ _key: "definitions", classes: seed?.classes || [], ontologies: [], properties: [], ontology_properties: [] }])
          });
          if (!Array.isArray(body2) || body2.some((row) => row.error))
            throw new Error("ArangoDB \u672C\u4F53\u6E05\u7A7A\u5931\u8D25");
        }, ["knowledge_schema"]);
        return Response.json({ ok: true });
      }
      if (["POST", "DELETE"].includes(method) && propertyWritePaths.has(path)) {
        const current = loggedIn();
        if (!deps.canCreate(current, project))
          throw new KnowledgeStoreError("\u9700\u8981\u5E94\u7528\u6210\u5458\u6743\u9650\u624D\u80FD\u7BA1\u7406\u5C5E\u6027", 403);
        let input;
        if (method === "DELETE")
          input = Object.fromEntries(url.searchParams);
        else {
          try {
            input = await req.json();
          } catch {
            throw new KnowledgeStoreError("\u8BF7\u6C42\u5185\u5BB9\u65E0\u6548");
          }
        }
        if (!input || typeof input !== "object" || Array.isArray(input))
          throw new KnowledgeStoreError("\u8BF7\u6C42\u5FC5\u987B\u662F JSON \u5BF9\u8C61");
        const operation = path.endsWith("property_create") ? "create" : path.endsWith("property_update") ? "update" : path.endsWith("property_delete") ? "delete" : method === "DELETE" ? "unlink" : "link";
        return Response.json(await maintainPropertySchema(store, database, Number(project.id), operation, input, () => deps.getSchema?.(project)));
      }
      if (path === "/api/kb/properties/from-knowledge" && method === "POST") {
        const current = loggedIn();
        if (!deps.canCreate(current, project))
          throw new KnowledgeStoreError("\u9700\u8981\u5E94\u7528\u6210\u5458\u6743\u9650\u624D\u80FD\u53CD\u5411\u751F\u6210\u5C5E\u6027", 403);
        let input;
        try {
          input = await req.json();
        } catch {
          throw new KnowledgeStoreError("\u8BF7\u6C42\u5185\u5BB9\u65E0\u6548");
        }
        if (!input || typeof input !== "object" || Array.isArray(input) || input.ontology_id != null && typeof input.ontology_id !== "string")
          throw new KnowledgeStoreError("\u672C\u4F53\u6807\u8BC6\u65E0\u6548");
        const result = await deriveSchemaFromKnowledge(store, database, Number(project.id), current, String(input.ontology_id || "").trim(), () => deps.getSchema?.(project));
        return Response.json({ ok: true, ...result });
      }
      if (path === "/api/kb/ontologies/import" && method === "POST") {
        const current = loggedIn();
        if (!deps.canCreate(current, project))
          throw new KnowledgeStoreError("\u4EC5\u5E94\u7528\u6210\u5458\u53EF\u4EE5\u5BFC\u5165\u672C\u4F53", 403);
        const raw = await req.text();
        if (new TextEncoder().encode(raw).length > 5 * 1024 * 1024)
          return Response.json({ error: "JSON \u6587\u4EF6\u4E0D\u80FD\u8D85\u8FC7 5 MB" }, { status: 413 });
        let input;
        try {
          input = JSON.parse(raw.replace(/^\uFEFF/, ""));
        } catch {
          throw new KnowledgeStoreError("JSON \u683C\u5F0F\u9519\u8BEF\uFF0C\u8BF7\u68C0\u67E5\u6587\u4EF6");
        }
        const result = await importEnterpriseOntologies(store, database, Number(project.id), input, () => deps.getSchema?.(project));
        return Response.json({ ok: true, ...result });
      }
      if (path === "/api/kb/entity/import" && method === "POST") {
        const current = loggedIn();
        if (!deps.canCreate(current, project))
          throw new KnowledgeStoreError("\u4EC5\u5E94\u7528\u6210\u5458\u53EF\u4EE5\u5BFC\u5165\u5B9E\u4F53", 403);
        if (!deps.sync)
          throw new KnowledgeStoreError("\u672A\u914D\u7F6E Elasticsearch \u540C\u6B65\uFF0C\u65E0\u6CD5\u5BFC\u5165\u5B9E\u4F53", 503);
        let input;
        try {
          input = await req.json();
        } catch {
          throw new KnowledgeStoreError("\u65E0\u6548\u7684 JSON \u8BF7\u6C42");
        }
        parseEntityImports(input);
        const localized = await localizeEntityImportMedia(input, Number(project.id));
        let result;
        try {
          result = await importEnterpriseEntities(store, database, Number(project.id), localized.input, current, () => deps.getSchema?.(project));
        } catch (error) {
          cleanupLocalizedEntityImport(localized.files);
          throw error;
        }
        const sync = await synchronizeWrite();
        return Response.json({
          ok: true,
          ...result,
          filesLocalized: localized.files.length,
          sync,
          ...sync === "pending" ? { warning: "\u5B9E\u4F53\u5DF2\u4FDD\u5B58\u5230 ArangoDB\uFF0CElasticsearch \u540C\u6B65\u6682\u672A\u5B8C\u6210\uFF0C\u540E\u53F0\u5C06\u81EA\u52A8\u91CD\u8BD5" } : {}
        }, { status: sync === "pending" ? 202 : 200 });
      }
      const importedSchema = await store.importSchema?.(database);
      const schema = importedSchema || deps.getSchema?.(project);
      if (method === "GET" && schemaReadPaths.has(path)) {
        const parse = (value) => {
          try {
            return typeof value === "string" ? JSON.parse(value) : value || [];
          } catch {
            return [];
          }
        };
        const status = url.searchParams.get("status") || "active";
        const q2 = (url.searchParams.get("q") || "").trim().toLocaleLowerCase();
        const filter = (rows2) => rows2.filter((row) => (status === "all" || (row.status || "active") === status) && (!q2 || [row.name, ...parse(row.alias)].some((value) => String(value || "").toLocaleLowerCase().includes(q2))));
        if (path === "/api/kb/properties")
          return Response.json(filter(schema?.properties || []).map((row) => ({ ...row, alias: parse(row.alias), label: row.name })));
        if (path === "/api/kb/property_search") {
          const ontology = url.searchParams.get("ontology_id") || "";
          const typeName = (url.searchParams.get("type_name") || schema?.classes.find((row) => row.id === url.searchParams.get("class_id"))?.name || "").trim().toLowerCase();
          const links = schema?.ontology_properties || [];
          const rows2 = filter(schema?.properties || []).map((row) => {
            const ids = [...new Set(links.filter((link) => link.property_id === row.id).map((link) => link.ontology_id))];
            return {
              ...row,
              label: row.name,
              alias: parse(row.alias),
              types: parse(row.types),
              ontology_ids: ids,
              ontology_names: ids.map((id2) => schema?.ontologies.find((item) => item.id === id2)?.name || id2),
              linked_to_ontology: ids.includes(ontology)
            };
          }).filter((row) => (!ontology || url.searchParams.get("association_mode") !== "linked" || row.linked_to_ontology) && (!typeName || parse(row.types).some((type) => String(type).trim().toLowerCase() === typeName)));
          const offset = integer(url.searchParams.get("offset"), 0, 1e6), limit = integer(url.searchParams.get("limit"), 20, 500);
          return Response.json({ items: rows2.slice(offset, offset + limit), total: rows2.length });
        }
        if (path === "/api/kb/ontology/property") {
          const ontologyId = url.searchParams.get("ontology_id");
          if (!ontologyId)
            throw new KnowledgeStoreError("\u7F3A\u5C11 ontology_id");
          const ontologyIds = new Set([ontologyId]);
          if (url.searchParams.get("include_inherited") === "1") {
            let current = schema?.ontologies.find((row) => row.id === ontologyId);
            while (current?.parent_id && !ontologyIds.has(current.parent_id)) {
              ontologyIds.add(current.parent_id);
              current = schema?.ontologies.find((row) => row.id === current.parent_id);
            }
          }
          const links = (schema?.ontology_properties || []).filter((row) => ontologyIds.has(row.ontology_id));
          return Response.json({
            items: (schema?.properties || []).filter((row) => links.some((link) => link.property_id === row.id)).map((row) => {
              const isLocal = links.some((link) => link.property_id === row.id && link.ontology_id === ontologyId);
              return { ...row, label: row.name, is_local: isLocal, inherited: !isLocal, types: parse(row.types) };
            })
          });
        }
        const rows = filter(schema?.ontologies || []).map((row) => ({ ...row, alias: parse(row.alias) }));
        if (path === "/api/kb/ontologies")
          return Response.json(rows);
        const flat = rows.filter((row) => row.name !== "\u5B9E\u4F53\u6761\u76EE" && !row.alias.includes("Wikibase Item"));
        const tree = (parent, ancestors = new Set) => flat.filter((row) => (row.parent_id || null) === parent && !ancestors.has(row.id)).map((row) => ({ ...row, label: row.name, children: tree(row.id, new Set([...ancestors, row.id])) }));
        return Response.json({ items: tree(null), flat });
      }
      const resultNode = (node) => {
        const result = arangoNodeResponse(node, user);
        if (!schema)
          return result;
        const classes = schema.classes.filter((cls) => result.categoryIds.includes(cls.id));
        const ancestors = new Set;
        const classById = new Map(schema.classes.map((cls) => [cls.id, cls]));
        for (const cls of classes) {
          const visited = new Set([cls.id]);
          let parent = cls.parent_id;
          while (parent && !visited.has(parent)) {
            visited.add(parent);
            ancestors.add(parent);
            parent = classById.get(parent)?.parent_id;
          }
        }
        const displayClasses = classes.filter((cls) => !ancestors.has(cls.id));
        const ontology = schema.ontologies.find((type) => type.id === node.type || type.name === node.type);
        return {
          ...result,
          classes,
          categoryLabels: displayClasses.map((cls) => cls.name),
          classLabel: displayClasses.map((cls) => cls.name).join("\u3001") || null,
          color: ontology?.color || classes[0]?.color || null,
          ontology: ontology || null,
          typeLabel: ontology?.name || result.typeLabel
        };
      };
      const graphNode = (node) => {
        const { data, ...fields } = resultNode(node);
        return fields;
      };
      await store.ensure(database);
      let body = {};
      if (["POST", "PUT", "PATCH"].includes(method)) {
        try {
          body = req.body === null && /^\/api\/knowledge\/[^/]+\/(like|share)$/.test(path) ? {} : await req.json();
        } catch {
          throw new KnowledgeStoreError("\u65E0\u6548\u7684 JSON \u8BF7\u6C42");
        }
        if (!body || typeof body !== "object" || Array.isArray(body))
          throw new KnowledgeStoreError("\u8BF7\u6C42\u5FC5\u987B\u662F JSON \u5BF9\u8C61");
      }
      const id = cleanKnowledgeId(url.searchParams.get("id") || url.searchParams.get("entityId") || url.searchParams.get("entity_id") || body.id || body.entityId || body.entity_id);
      if (path === "/api/kb/geography/viewport" && method === "GET") {
        const selected = url.searchParams.get("class_id");
        const classes = selected ? new Set([selected]) : null;
        if (classes && schema) {
          let added = true;
          while (added) {
            added = false;
            for (const row of schema.classes)
              if (classes.has(row.parent_id) && !classes.has(row.id)) {
                classes.add(row.id);
                added = true;
              }
          }
        }
        const result = await geographicSearch.search(database, url.searchParams, user, classes ? [...classes] : null, url.searchParams.get("hide_entity") === "1" ? hiddenKnowledgeTypes(schema?.ontologies) : []);
        return Response.json({ ...result, items: result.items.map((item) => ({ ...item, node: resultNode(item.node) })), source: "arangodb-geo" });
      }
      if (path === "/api/kb/entity/relationships" && method === "POST") {
        if (!Array.isArray(body.ids) || body.ids.length > 100 || body.ids.some((id2) => typeof id2 !== "string" || !id2.trim() || id2.length > 512)) {
          throw new KnowledgeStoreError("\u8BF7\u63D0\u4F9B\u4E0D\u8D85\u8FC7 100 \u4E2A\u6709\u6548\u5B9E\u4F53 ID");
        }
        if (!body.ids.length)
          return Response.json({ items: [] });
        const rows = await store.relationshipCards(database, body.ids, user);
        return Response.json({
          items: rows.map((row) => ({
            node: resultNode(row.node),
            truncated: row.truncated,
            relations: row.relations.map((relation) => ({
              node: resultNode(relation.node),
              propertyId: relation.edge.property_id,
              propertyName: relation.edge.property_name || relation.edge.property_id || "\u5173\u8054",
              direction: relation.edge._from === row.node._id ? "outgoing" : "incoming"
            }))
          }))
        });
      }
      const interaction = path.match(/^\/api\/knowledge\/([^/]+)(?:\/(interaction|comments|like|share))?$/);
      const commentDelete = path.match(/^\/api\/comments\/([^/]+)$/);
      if (interaction || commentDelete && method === "DELETE") {
        let nodeId = interaction ? cleanKnowledgeId(decodeURIComponent(interaction[1])) : "";
        const action = interaction?.[2] || (commentDelete ? "comments" : "interaction");
        if (!(method === "GET" && ["interaction", "comments"].includes(action) || method === "POST" && ["comments", "like", "share"].includes(action) || method === "DELETE" && (action === "like" || commentDelete))) {
          return Response.json({ error: "\u4E0D\u652F\u6301\u7684\u8BF7\u6C42\u65B9\u6CD5" }, { status: 405 });
        }
        if (method !== "GET")
          loggedIn();
        if (commentDelete) {
          const rows = await store.query(database, `FOR doc IN entity
            FILTER @commentId IN NOT_NULL(doc.interactions.comments, [])[*].id
            LIMIT 1 RETURN { id: doc.sqlite_id || doc.id }`, { commentId: decodeURIComponent(commentDelete[1]) });
          if (!rows.length)
            throw new KnowledgeStoreError("\u8BC4\u8BBA\u4E0D\u5B58\u5728", 404);
          nodeId = rows[0].id;
        }
        const result = await store.interact(database, nodeId, user, action, method, { ...body, commentId: commentDelete ? decodeURIComponent(commentDelete[1]) : undefined });
        const shareUrl = new URL("/kb/detail", url.origin);
        shareUrl.searchParams.set("id", nodeId);
        shareUrl.searchParams.set("db", database);
        return Response.json({
          ...result,
          ...method !== "GET" ? { success: true, sync: await synchronizeWrite() } : {},
          ...action === "share" ? { shareUrl: shareUrl.toString() } : {}
        }, { status: action === "comments" && method === "POST" ? 201 : 200 });
      }
      if (["/api/kb/entity_search", "/api/kb/discover/search"].includes(path) && method === "GET") {
        const discovery = path === "/api/kb/discover/search";
        const backend = discovery ? "elasticsearch" : "arangosearch";
        if (discovery && !deps.search)
          throw new KnowledgeStoreError("\u672A\u914D\u7F6E Elasticsearch \u9996\u9875\u4E0E\u68C0\u7D22\u670D\u52A1", 503);
        const classId = url.searchParams.get("class_id");
        let classIds = classId ? [classId] : null;
        if (classId && schema) {
          const descendants = new Set([classId]);
          let added = true;
          while (added) {
            added = false;
            for (const cls of schema.classes)
              if (descendants.has(cls.parent_id) && !descendants.has(cls.id)) {
                descendants.add(cls.id);
                added = true;
              }
          }
          classIds = [...descendants];
        }
        let page;
        const selectedType = url.searchParams.get("type");
        const discoveryTypes = discovery && selectedType ? new Set([selectedType]) : null;
        if (discoveryTypes && schema) {
          let added = true;
          while (added) {
            added = false;
            for (const type of schema.ontologies)
              if (discoveryTypes.has(type.parent_id) && !discoveryTypes.has(type.id)) {
                discoveryTypes.add(type.id);
                added = true;
              }
          }
        }
        const propertyInput = url.searchParams.get("property_id");
        const propertyId = discovery && propertyInput ? schema?.properties.find((property) => property.id === propertyInput || String(property.name || "").trim().toLowerCase() === propertyInput.trim().toLowerCase())?.id || propertyInput : propertyInput;
        if (discovery) {
          const month = url.searchParams.get("publication_month");
          const year = url.searchParams.get("publication_year");
          if (year && !/^\d{4}$/.test(year))
            throw new KnowledgeStoreError("\u53D1\u5E03\u5E74\u4EFD\u683C\u5F0F\u65E0\u6548");
          if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
            throw new KnowledgeStoreError("\u53D1\u5E03\u6708\u4EFD\u683C\u5F0F\u65E0\u6548");
          const from = url.searchParams.get("updated_from"), to = url.searchParams.get("updated_to");
          if ([from, to].some((date) => date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)))
            throw new KnowledgeStoreError("\u66F4\u65B0\u65F6\u95F4\u683C\u5F0F\u65E0\u6548");
          if (from && to && from > to)
            throw new KnowledgeStoreError("\u5F00\u59CB\u65E5\u671F\u4E0D\u80FD\u665A\u4E8E\u7ED3\u675F\u65E5\u671F");
        }
        try {
          page = await (discovery && !url.searchParams.get("tag")?.trim() ? deps.search : arangoSearch).search(database, user, {
            tag: discovery ? url.searchParams.get("tag") : null,
            q: url.searchParams.get("q"),
            limit: integer(url.searchParams.get("limit"), 20, 500),
            offset: integer(url.searchParams.get("offset"), 0, 1e6),
            classIds,
            type: discoveryTypes ? null : selectedType,
            ...discoveryTypes ? { includeTypes: [...discoveryTypes] } : {},
            order: url.searchParams.get("order"),
            emptyType: url.searchParams.has("type") && url.searchParams.get("type") === "",
            hasImage: ["1", "true"].includes(url.searchParams.get("has_image") || ""),
            hasMedia: ["1", "true"].includes(url.searchParams.get("has_media") || ""),
            propertyId,
            propertyValue: url.searchParams.get("property_value"),
            ...discovery ? {
              publicationMonths: url.searchParams.get("publication_months") === "1",
              publicationMonth: url.searchParams.get("publication_month"),
              publicationYear: url.searchParams.get("publication_year"),
              matchMode: url.searchParams.get("match_mode"),
              searchScope: url.searchParams.get("search_scope"),
              excludeQuery: url.searchParams.get("exclude_q"),
              updatedFrom: url.searchParams.get("updated_from"),
              updatedTo: url.searchParams.get("updated_to")
            } : {},
            definedClasses: ["1", "true"].includes(url.searchParams.get("defined_class_only") || "") && schema ? schema.classes.map((cls) => cls.id) : null,
            definedTypes: ["1", "true"].includes(url.searchParams.get("defined_type_only") || "") && schema ? schema.ontologies.map((type) => type.id) : null,
            excludeTypes: ["1", "true"].includes(url.searchParams.get("hide_entity") || "") ? hiddenKnowledgeTypes(schema?.ontologies) : []
          });
        } catch (error) {
          console.error(`${backend} search failed:`, error);
          throw new KnowledgeStoreError(discovery ? "Elasticsearch \u9996\u9875\u4E0E\u68C0\u7D22\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5\u540C\u6B65\u5668\u72B6\u6001" : "ArangoSearch \u77E5\u8BC6\u68C0\u7D22\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5\u641C\u7D22\u89C6\u56FE", 503);
        }
        return Response.json({ nodes: page.nodes.map(resultNode), total: page.total, ..."months" in page ? { months: page.months } : {}, searchBackend: backend }, { headers: { "X-Knowledge-Search": backend } });
      }
      if (path === "/api/kb/tags" && method === "GET") {
        const parseTags = (raw) => {
          try {
            const value = typeof raw === "string" ? JSON.parse(raw) : raw;
            return Array.isArray(value) ? value : [];
          } catch {
            return [];
          }
        };
        const tags = await store.tags(database, user);
        return Response.json({ tags: sortTags([
          ...tags,
          ...(schema?.classes || []).flatMap((cls) => parseTags(cls.tags)),
          ...parseTags(url.searchParams.get("custom_tags"))
        ]) });
      }
      if (path === "/api/kb/classes" && method === "GET") {
        const summary = await store.summary(database, user);
        const counts = new Map(summary.categories.map((row) => [row.id, row.count]));
        const q2 = (url.searchParams.get("q") || "").toLowerCase();
        const parse = (value) => {
          try {
            return typeof value === "string" ? JSON.parse(value) : value || [];
          } catch {
            return [];
          }
        };
        return Response.json((schema?.classes || []).filter((cls) => String(cls.name || "").toLowerCase().includes(q2)).map((cls) => ({
          ...cls,
          label: cls.name,
          parent: cls.parent_id,
          instance_count: counts.get(cls.id) || 0,
          tags: sortTags(parse(cls.tags)),
          analyses: parse(cls.analyses)
        })));
      }
      if (path === "/api/kb/entity/class") {
        if (method === "GET") {
          const node = await store.require(database, id, user);
          return Response.json({ items: schema?.classes.filter((cls) => (node.class_ids || []).includes(cls.id)).map((cls) => ({ ...cls, label: cls.name })) || [] });
        }
        if (method === "POST" || method === "DELETE") {
          const classId = String(body.class_id || url.searchParams.get("class_id") || "").trim();
          if (method === "POST" && !classId)
            throw new KnowledgeStoreError("\u7F3A\u5C11\u5206\u7C7B");
          if (classId && schema && !schema.classes.some((cls) => cls.id === classId))
            throw new KnowledgeStoreError("\u5206\u7C7B\u4E0D\u5C5E\u4E8E\u5F53\u524D\u5E94\u7528");
          await store.classify(database, id, classId, method === "DELETE", loggedIn());
          return Response.json({ ok: true, sync: await synchronizeWrite() });
        }
      }
      if (path === "/api/kb/node-types" && method === "GET") {
        return Response.json((await store.summary(database, user)).types);
      }
      if (path === "/api/kb/stats" && method === "GET") {
        const summary = await store.summary(database, user);
        return Response.json({
          counts: {
            entity: summary.entities,
            link: summary.attributes,
            instance: schema?.classes.length || 0,
            property: schema?.properties.length || 0
          }
        });
      }
      if (path === "/api/kb/node/random" && method === "GET") {
        const page = await store.list(database, user, { limit: 1, offset: 0, order: "random" });
        return Response.json({ node: page.nodes[0] ? resultNode(page.nodes[0]) : null });
      }
      if (path === "/api/kb/graph" && method === "GET") {
        const page = await store.list(database, user, { limit: 500, offset: 0, classId: url.searchParams.get("class_id") });
        const handles = page.nodes.map((node) => node._id);
        const edges = await store.query(database, "FOR e IN link FILTER e._from IN @handles AND e._to IN @handles AND e._from != e._to RETURN e", { handles });
        return Response.json({
          nodes: page.nodes.map(graphNode),
          edges: edges.map((e) => ({
            id: `${e.sqlite_id}:${e.target_id}`,
            source: e.source_id,
            target: e.target_id,
            type: e.property_id,
            label: e.property_name || e.property_id
          })),
          total: page.total,
          truncated: page.total > page.nodes.length
        });
      }
      if (path === "/api/kb/nodes" && method === "POST") {
        const current = loggedIn();
        if (!deps.canCreate(current, project))
          throw new KnowledgeStoreError("\u9700\u8981\u5E94\u7528\u6210\u5458\u6743\u9650\u624D\u80FD\u521B\u5EFA\u77E5\u8BC6", 403);
        if (body.mapCategoryToOntology === true) {
          const categoryIds = body.categoryIds;
          if (!Array.isArray(categoryIds) || categoryIds.some((id2) => typeof id2 !== "string"))
            throw new KnowledgeStoreError("\u5206\u7C7B\u5217\u8868\u65E0\u6548");
          delete body.type;
          body.typeId = null;
          if (categoryIds.length) {
            const definitions = await store.importSchema(database) || deps.getSchema?.(project);
            const category = definitions?.classes.find((row) => row.id === categoryIds[0]);
            if (!category)
              throw new KnowledgeStoreError("\u6240\u9009\u5206\u7C7B\u4E0D\u5B58\u5728");
            let ontology = definitions?.ontologies.find((row) => row.status !== "deprecated" && (row.id === category.ontology_id || String(row.name).trim().toLowerCase() === String(category.name).trim().toLowerCase()));
            if (!ontology) {
              await importEnterpriseOntologies(store, database, Number(project.id), {
                version: 1,
                ontologies: [{ name: category.name }]
              }, () => deps.getSchema?.(project));
              ontology = (await store.importSchema(database))?.ontologies.find((row) => row.status !== "deprecated" && String(row.name).trim().toLowerCase() === String(category.name).trim().toLowerCase());
            }
            if (!ontology)
              throw new KnowledgeStoreError("\u5206\u7C7B\u5BF9\u5E94\u7684\u672C\u4F53\u521B\u5EFA\u5931\u8D25");
            body.typeId = ontology.id;
          }
        }
        const prepared = await prepareEntityImageValues(body, Number(project.id));
        const node = await store.create(database, Number(project.id), prepared, current);
        return Response.json({ ok: true, node: resultNode(node), sync: await synchronizeWrite() });
      }
      if (path === "/api/kb/nodes/update" && method === "POST") {
        if (!id)
          throw new KnowledgeStoreError("\u7F3A\u5C11\u77E5\u8BC6 ID");
        const current = loggedIn();
        await store.require(database, id, current, "edit");
        const prepared = await prepareEntityImageValues(body, Number(project.id));
        const node = await store.update(database, id, prepared, current);
        return Response.json({ ok: true, node: resultNode(node), sync: await synchronizeWrite() });
      }
      if (path === "/api/kb/nodes" && method === "DELETE") {
        if (!id)
          throw new KnowledgeStoreError("\u7F3A\u5C11\u77E5\u8BC6 ID");
        await store.remove(database, id, loggedIn());
        return Response.json({ ok: true, success: true, sync: await synchronizeWrite() });
      }
      if (["/api/kb/node", "/api/kb/node/relation-insights"].includes(path) && method === "GET") {
        if (!id)
          throw new KnowledgeStoreError("\u7F3A\u5C11\u77E5\u8BC6 ID");
        const node = await store.require(database, id, user);
        const [attributes, graph] = await Promise.all([
          path === "/api/kb/node" ? store.attributes(database, id) : Promise.resolve([]),
          store.relationPaths?.(database, id, user, integer(url.searchParams.get("relation_limit"), 500, 1000))
        ]);
        node._search_attributes = attributes;
        if (graph)
          return Response.json({ node: resultNode(node), ...buildRelationInsights(node, graph.paths, resultNode, graph.truncated) });
        const rows = await store.relations(database, id, user);
        const neighbors = new Map;
        const incomingRelations = [];
        for (const row of rows) {
          const sourceId = cleanKnowledgeId(row.source.sqlite_id || row.source.id);
          const targetId = cleanKnowledgeId(row.target.sqlite_id || row.target.id);
          const edge = {
            id: `${row.edge.sqlite_id}:${targetId}`,
            source: sourceId,
            target: targetId,
            type: row.edge.property_id,
            label: row.edge.property_name || row.edge.property_id,
            isAttribute: true
          };
          if (sourceId !== id)
            neighbors.set(sourceId, { node: resultNode(row.source), edge });
          if (targetId !== id)
            neighbors.set(targetId, { node: resultNode(row.target), edge });
          if (targetId === id)
            incomingRelations.push({
              source: resultNode(row.source),
              propertyId: row.edge.property_id,
              propertyName: row.edge.property_name || row.edge.property_id || "\u5173\u8054"
            });
        }
        if (incomingRelations.length) {
          const handles = [...new Set(rows.filter((row) => cleanKnowledgeId(row.target.sqlite_id || row.target.id) === id).map((row) => row.source._id))].filter(Boolean);
          const secondLevel = handles.length ? await store.query(database, `FOR edge IN link
            FILTER edge._to IN @handles AND edge._from != edge._to
            LET source = DOCUMENT(edge._from) LET target = DOCUMENT(edge._to)
            FILTER source != null AND target != null RETURN { edge, source, target }`, { handles }) : [];
          const children = new Map;
          for (const row of secondLevel) {
            const sourceId = cleanKnowledgeId(row.source.sqlite_id || row.source.id);
            if (sourceId === id || !canUseArangoKnowledge(row.source, user) || !canUseArangoKnowledge(row.target, user))
              continue;
            const targetId = cleanKnowledgeId(row.target.sqlite_id || row.target.id);
            const group = children.get(targetId) || [];
            group.push({
              source: resultNode(row.source),
              propertyId: row.edge.property_id,
              propertyName: row.edge.property_name || row.edge.property_id || "\u5173\u8054"
            });
            children.set(targetId, group);
          }
          for (const relation of incomingRelations) {
            const group = children.get(relation.source.id);
            if (group?.length)
              relation.secondLevel = group;
          }
        }
        return Response.json({ node: resultNode(node), neighbors: [...neighbors.values()], incomingRelations });
      }
      if (path === "/api/kb/node/attributes" && method === "GET") {
        const node = await store.require(database, id, user);
        const attrs = (await store.attributes(database, id)).map(arangoAttributeResponse);
        return Response.json(relationAttributeResponse(attrs, node.relation_order));
      }
      if (["/api/kb/node/relations", "/api/kb/node/graph"].includes(path) && method === "GET") {
        const center = await store.require(database, id, user);
        const rows = await store.relations(database, id, user, url.searchParams.get("direction") || "both");
        const nodes = new Map([[id, graphNode(center)]]);
        const edges = rows.map(({ edge, source, target }) => {
          const sourceId = cleanKnowledgeId(source.sqlite_id || source.id), targetId = cleanKnowledgeId(target.sqlite_id || target.id);
          nodes.set(sourceId, graphNode(source));
          nodes.set(targetId, graphNode(target));
          return { id: `${edge.sqlite_id}:${targetId}`, source: sourceId, target: targetId, type: edge.property_id, label: edge.property_name || edge.property_id, isAttribute: true };
        });
        return Response.json(path.endsWith("/graph") ? { nodes: [...nodes.values()], edges } : { items: edges });
      }
      if (path === "/api/kb/attributes/save" && method === "POST") {
        const definition = schema?.properties.find((prop) => prop.id === (body.property || body.prop));
        if (definition?.status === "deprecated")
          throw new KnowledgeStoreError("\u4E0D\u80FD\u7F16\u8F91\u5DF2\u5E9F\u5F03\u7684\u5C5E\u6027");
        const attr = await store.saveAttribute(database, {
          ...body,
          datatype: body.datatype || definition?.datatype,
          property_name_snapshot: definition?.name || body.property_name_snapshot
        }, loggedIn());
        return Response.json({ ...arangoAttributeResponse(attr), sync: await synchronizeWrite() });
      }
      if (path.startsWith("/api/kb/attributes/") && method === "DELETE") {
        await store.removeAttribute(database, decodeURIComponent(path.slice("/api/kb/attributes/".length)), loggedIn());
        return Response.json({ success: true, sync: await synchronizeWrite() });
      }
      if (path === "/api/kb/relations/create" && method === "POST") {
        const current = loggedIn();
        const source = cleanKnowledgeId(body.source), target = cleanKnowledgeId(body.target);
        if (!source || !target)
          throw new KnowledgeStoreError("\u7F3A\u5C11\u5173\u7CFB\u8D77\u70B9\u6216\u7EC8\u70B9");
        await store.require(database, target, user);
        const attr = await store.saveAttribute(database, {
          node_id: source,
          property: body.type || "related",
          datatype: "wikibase-item",
          property_name_snapshot: body.label || body.type || "related",
          value: { id: target }
        }, current);
        return Response.json({ id: `${attr.id}:${target}`, source, target, type: attr.key, label: attr.property_name_snapshot, isAttribute: true, sync: await synchronizeWrite() });
      }
      if (path.startsWith("/api/kb/relations/") && method === "DELETE") {
        await store.removeRelation(database, decodeURIComponent(path.slice("/api/kb/relations/".length)), loggedIn());
        return Response.json({ success: true, sync: await synchronizeWrite() });
      }
      if (path === "/api/kb/node/relation-order" && method === "POST") {
        const order = await store.reorder(database, id, body, loggedIn());
        return Response.json({ success: true, relation_order: order, sync: await synchronizeWrite() });
      }
      if (path === "/api/kb/knowledge-access" && method === "GET") {
        const node = await store.require(database, id, user);
        return Response.json({
          id,
          visibility: node.visibility || "public",
          owner: node.owner_user_id ? { id: node.owner_user_id, username: node.creator_username } : null,
          creatorUsername: node.creator_username,
          maintainers: (node.maintainer_ids || []).map((id2) => ({ id: id2 })),
          requests: canUseArangoKnowledge(node, user, "manage") ? Object.values(node.maintenance_requests || {}).filter((request) => request.status === "pending") : [],
          ownRequest: user ? node.maintenance_requests?.[String(user.id)] || null : null,
          canManage: canUseArangoKnowledge(node, user, "manage"),
          canEdit: canUseArangoKnowledge(node, user, "edit"),
          canRequest: Boolean(user?.id && !canUseArangoKnowledge(node, user, "edit"))
        });
      }
      if (["/api/kb/knowledge-maintenance/request", "/api/kb/knowledge-maintenance/review", "/api/kb/knowledge-maintenance/remove"].includes(path) && method === "POST") {
        await store.maintenance(database, id, path.split("/").pop(), body, loggedIn());
        return Response.json({ ok: true, sync: await synchronizeWrite() });
      }
      if (path === "/api/kb/knowledge-sync/status" && method === "GET") {
        if (user?.role !== "admin")
          throw new KnowledgeStoreError("\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650", 403);
        return Response.json({ backend: "arangodb", sqliteBackup: deps.backup?.status(database) || null, elasticsearchConfigured: Boolean(deps.sync), ...deps.sync?.status(database) || { source: "entity", mode: "disabled" } });
      }
      if (path === "/api/kb/knowledge-sync/reindex" && method === "POST") {
        if (loggedIn().role !== "admin")
          throw new KnowledgeStoreError("\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650", 403);
        if (!deps.sync)
          throw new KnowledgeStoreError("\u672A\u914D\u7F6E Elasticsearch", 503);
        return Response.json({ ok: true, synced: await deps.sync.flush(database) });
      }
      if (path === "/api/wiki/page" && method === "GET") {
        const node = await store.require(database, id, user);
        const md = String(node.wiki_md || "");
        return Response.json({ page: { md, html: md ? await d.parse(md) : "" } });
      }
      if (path === "/api/wiki/page/save" && method === "POST") {
        await store.update(database, id, { wiki_md: body.md ?? body.content ?? "" }, loggedIn());
        return Response.json({ ok: true, sync: await synchronizeWrite() });
      }
      return Response.json({ error: "\u6B64\u77E5\u8BC6\u63A5\u53E3\u5C1A\u672A\u8FC1\u79FB\u5230 ArangoDB", code: "ENTERPRISE_ROUTE_UNAVAILABLE", path }, { status: 501 });
    } catch (error) {
      if (error?.status === 404 && error?.body?.errorNum === 1228) {
        return Response.json({
          error: "\u5F53\u524D\u5E94\u7528\u5C1A\u672A\u521D\u59CB\u5316 ArangoDB \u77E5\u8BC6\u5E93\uFF0C\u8BF7\u7531\u7CFB\u7EDF\u7BA1\u7406\u5458\u5728\u300C\u5E94\u7528\u8BBE\u7F6E \u2192 \u77E5\u8BC6\u540C\u6B65\u300D\u5BFC\u5165 SQLite \u77E5\u8BC6\u6570\u636E",
          code: "KNOWLEDGE_DATABASE_NOT_INITIALIZED",
          database: deps.getProject(url.searchParams.get("db") || "default")?.name
        }, { status: 409 });
      }
      if (error instanceof KnowledgeStoreError || error instanceof EntityImportError || error instanceof OntologyImportError || error instanceof TypeError || error instanceof RangeError) {
        return Response.json({ error: error.message }, { status: error instanceof KnowledgeStoreError ? error.status : 400 });
      }
      console.error("Enterprise knowledge request failed:", error);
      return Response.json({ error: "ArangoDB \u77E5\u8BC6\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528", code: "KNOWLEDGE_BACKEND_UNAVAILABLE" }, { status: 503 });
    }
  };
}
export {
  enterpriseMediaPath,
  enterpriseKnowledgePath,
  createEnterpriseKnowledgeHandler
};
