import { detectQueryType } from "./query.ts";

function parseNTriples(text: string) {
  const triples: any[] = [];
  const lines = String(text || "").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^<([^>]+)>\s+<([^>]+)>\s+(.+?)\s*\.\s*$/);
    if (!match) continue;
    const objectRaw = match[3] || "";
    let object: any;
    const uriMatch = objectRaw.match(/^<([^>]+)>$/);
    const literalMatch = objectRaw.match(/^"((?:[^"\\]|\\.)*)"(?:(@([a-zA-Z-]+))|\^\^<([^>]+)>)?$/);
    if (uriMatch) {
      object = { type: "uri", value: uriMatch[1] };
    } else if (literalMatch) {
      object = {
        type: "literal",
        value: literalMatch[1]?.replace(/\\"/g, '"') || "",
        language: literalMatch[3] || null,
        datatype: literalMatch[4] || null,
      };
    } else {
      object = { type: "literal", value: objectRaw, language: null, datatype: null };
    }
    triples.push({
      subject: { type: "uri", value: match[1] },
      predicate: { type: "uri", value: match[2] },
      object,
    });
  }
  return triples;
}

function parseJsonLd(value: any) {
  const array = Array.isArray(value) ? value : [value];
  const triples: any[] = [];
  for (const item of array) {
    const subject = String(item?.["@id"] || "");
    if (!subject) continue;
    for (const [predicate, rawObject] of Object.entries(item || {})) {
      if (predicate.startsWith("@")) continue;
      const values = Array.isArray(rawObject) ? rawObject : [rawObject];
      for (const entry of values) {
        if (entry && typeof entry === "object" && "@id" in entry) {
          triples.push({
            subject: { type: "uri", value: subject },
            predicate: { type: "uri", value: predicate },
            object: { type: "uri", value: String((entry as any)["@id"] || "") },
          });
        } else {
          triples.push({
            subject: { type: "uri", value: subject },
            predicate: { type: "uri", value: predicate },
            object: {
              type: "literal",
              value: typeof entry === "object" ? String((entry as any)?.["@value"] || "") : String(entry ?? ""),
              language: typeof entry === "object" ? (entry as any)?.["@language"] || null : null,
              datatype: typeof entry === "object" ? (entry as any)?.["@type"] || null : null,
            },
          });
        }
      }
    }
  }
  return triples;
}

function parseSimpleXmlRdf(text: string) {
  const triples: any[] = [];
  const subjectBlocks = String(text || "").match(/<rdf:Description\b[\s\S]*?<\/rdf:Description>/gi) || [];
  for (const block of subjectBlocks) {
    const subjectMatch = block.match(/\brdf:about="([^"]+)"/i);
    const subject = subjectMatch?.[1] || "";
    if (!subject) continue;
    const propMatches = block.matchAll(/<([a-zA-Z0-9:_-]+)([^>]*)>([\s\S]*?)<\/\1>/g);
    for (const match of propMatches) {
      const predicate = match[1];
      const attrs = match[2] || "";
      const inner = (match[3] || "").trim();
      const resourceMatch = attrs.match(/\brdf:resource="([^"]+)"/i);
      if (resourceMatch?.[1]) {
        triples.push({
          subject: { type: "uri", value: subject },
          predicate: { type: "uri", value: predicate },
          object: { type: "uri", value: resourceMatch[1] },
        });
        continue;
      }
      triples.push({
        subject: { type: "uri", value: subject },
        predicate: { type: "uri", value: predicate },
        object: { type: "literal", value: inner, language: null, datatype: null },
      });
    }
  }
  return triples;
}

export function parseSelectResult(payload: any, duration: number) {
  const columns = Array.isArray(payload?.head?.vars) ? payload.head.vars : [];
  const rows = Array.isArray(payload?.results?.bindings) ? payload.results.bindings : [];
  return {
    success: true,
    queryType: "SELECT",
    columns,
    rows,
    boolean: null,
    triples: [],
    raw: payload,
    total: rows.length,
    duration,
    warnings: [],
  };
}

export function parseAskResult(payload: any, duration: number) {
  return {
    success: true,
    queryType: "ASK",
    columns: [],
    rows: [],
    boolean: Boolean(payload?.boolean),
    triples: [],
    raw: payload,
    total: 1,
    duration,
    warnings: [],
  };
}

export function parseRdfResult(payloadText: string, contentType: string, duration: number, queryType: string) {
  let triples: any[] = [];
  const lower = String(contentType || "").toLowerCase();
  if (lower.includes("ld+json")) {
    triples = parseJsonLd(JSON.parse(payloadText || "[]"));
  } else if (lower.includes("rdf+xml") || lower.includes("xml")) {
    triples = parseSimpleXmlRdf(payloadText);
  } else {
    triples = parseNTriples(payloadText);
  }
  return {
    success: true,
    queryType,
    columns: ["subject", "predicate", "object"],
    rows: [],
    boolean: null,
    triples,
    raw: payloadText,
    total: triples.length,
    duration,
    warnings: triples.length ? [] : ["未识别到可解析的 RDF 三元组"],
  };
}

export function parseSparqlResponse(body: string, contentType: string, duration: number, queryText: string) {
  const queryType = detectQueryType(queryText);
  if (queryType === "SELECT" || queryType === "ASK") {
    const json = JSON.parse(body || "{}");
    return queryType === "SELECT"
      ? parseSelectResult(json, duration)
      : parseAskResult(json, duration);
  }
  return parseRdfResult(body, contentType, duration, queryType);
}
