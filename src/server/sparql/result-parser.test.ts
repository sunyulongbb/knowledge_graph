import { describe, expect, test } from "bun:test";
import { parseSparqlResponse } from "./result-parser.ts";

describe("SPARQL result parser", () => {
  test("parses select json", () => {
    const payload = JSON.stringify({
      head: { vars: ["item", "itemLabel"] },
      results: {
        bindings: [
          {
            item: { type: "uri", value: "http://www.wikidata.org/entity/Q937" },
            itemLabel: { type: "literal", value: "Albert Einstein", "xml:lang": "en" },
          },
        ],
      },
    });
    const result = parseSparqlResponse(payload, "application/sparql-results+json", 10, "SELECT ?item WHERE { ?item ?p ?o }");
    expect(result.queryType).toBe("SELECT");
    expect(result.rows.length).toBe(1);
  });

  test("parses ask json", () => {
    const result = parseSparqlResponse(
      JSON.stringify({ boolean: true }),
      "application/sparql-results+json",
      5,
      "ASK { ?s ?p ?o }",
    );
    expect(result.queryType).toBe("ASK");
    expect(result.boolean).toBe(true);
  });

  test("parses ntriples", () => {
    const result = parseSparqlResponse(
      '<http://example.org/A> <http://example.org/name> "示例"@zh .',
      "application/n-triples",
      8,
      "CONSTRUCT WHERE { ?s ?p ?o }",
    );
    expect(result.queryType).toBe("CONSTRUCT");
    expect(result.triples.length).toBe(1);
    expect(result.triples[0].object.value).toBe("示例");
  });
});
