import { describe, expect, test } from "bun:test";
import { sanitizeHeaders, validateEndpointUrl } from "./security.ts";

describe("SPARQL security", () => {
  test("removes dangerous headers", () => {
    const headers = sanitizeHeaders({
      Host: "evil.test",
      Accept: "application/json",
      "Content-Length": "123",
    });
    expect(headers.Host).toBeUndefined();
    expect(headers.Accept).toBe("application/json");
  });

  test("blocks localhost endpoint", async () => {
    await expect(validateEndpointUrl("http://localhost:3030/sparql")).rejects.toThrow();
  });
});
