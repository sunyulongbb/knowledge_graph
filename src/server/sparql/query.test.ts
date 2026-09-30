import { describe, expect, test } from "bun:test";
import { detectQueryType, ensureReadOnlyQuery } from "./query.ts";

describe("SPARQL query helpers", () => {
  test("detects query type with prefix and comments", () => {
    const query = `# comment
PREFIX wd: <http://www.wikidata.org/entity/>
SELECT ?item WHERE { ?item ?p ?o } LIMIT 10`;
    expect(detectQueryType(query)).toBe("SELECT");
  });

  test("blocks update statements", () => {
    expect(() => ensureReadOnlyQuery("DELETE WHERE { ?s ?p ?o }")).toThrow();
  });
});
