import { describe, expect, test } from "bun:test";
import { containsEntityReference, parseJevScoreAnswer } from "../src/server/jev-score.ts";
import { readFileSync } from "node:fs";

describe("JEV knowledge score parsing", () => {
  test("reads the native score response", () => {
    expect(parseJevScoreAnswer({ score: 3.6, confidence: 0.91 })).toBe(3.6);
  });

  test("accepts numeric strings and nested values", () => {
    expect(parseJevScoreAnswer("2.25")).toBe(2.25);
    expect(parseJevScoreAnswer({ value: "4" })).toBe(4);
  });

  test("rejects missing or invalid score values", () => {
    expect(parseJevScoreAnswer({ confidence: 0.8 })).toBeNull();
    expect(parseJevScoreAnswer("high")).toBeNull();
  });
});

test("incoming relation matching only accepts exact entity references", () => {
  expect(containsEntityReference({ id: "Q22686", label_zh: "特朗普" }, "Q22686")).toBe(true);
  expect(containsEntityReference([{ id: "Q1" }, { target: "entity/Q22686" }], "Q22686")).toBe(true);
  expect(containsEntityReference({ id: "Q226860" }, "Q22686")).toBe(false);
  expect(containsEntityReference("提到 Q22686 但不是实体引用", "Q22686")).toBe(false);
});

test("JEV keys stay server-side and profile responses expose only configuration state", () => {
  const authRoute = readFileSync("src/server/routes/auth.ts", "utf8");
  const scoreRoute = readFileSync("src/server/routes/jev.ts", "utf8");
  const database = readFileSync("src/server/db.ts", "utf8");
  expect(authRoute).toContain("hasJevApiKey: Boolean(u.jev_api_key)");
  expect(scoreRoute).toContain('SELECT jev_api_key FROM users WHERE id = ?');
  expect(scoreRoute).toContain('const apiKey = String(savedKey || "").trim()');
  expect(scoreRoute).toContain('https://api.typesafe.ai/v1/systemone');
  expect(scoreRoute).toContain('jev-latest');
  expect(scoreRoute).toContain('SELECT key, datatype, property_name_snapshot, value FROM attributes');
  expect(scoreRoute).not.toContain('SELECT property_id, value FROM attributes');
  expect(scoreRoute).not.toContain('ORDER BY rowid LIMIT 80');
  expect(scoreRoute).toContain('attribute_evidence: attributeEvidence');
  expect(scoreRoute).toContain('matched_keywords: matchedKeywords');
  expect(scoreRoute).toContain('analysis_evidence: profileEvidence');
  expect(scoreRoute).toContain('incoming_relation_evidence:');
  expect(scoreRoute).toContain('source.project_id IS ?');
  expect(scoreRoute).toContain('keywordEvidence');
  expect(scoreRoute).toContain('relatedEvidence');
  expect(database).toContain('ALTER TABLE nodes ADD COLUMN jev_analysis_json TEXT');
  expect(database).toContain('jev_analysis_signature TEXT');
  expect(scoreRoute).toContain('node.jev_analysis_signature === analysisSignature');
  expect(scoreRoute).toContain('UPDATE nodes SET jev_analysis_json = ?');
  expect(scoreRoute).toContain('cacheSource: "entity"');
  expect(scoreRoute).toContain('const force = body.force === true');
  expect(scoreRoute.indexOf('node.jev_analysis_signature === analysisSignature')).toBeLessThan(scoreRoute.indexOf('if (!currentUser) return json'));
});
