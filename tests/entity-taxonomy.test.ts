import { expect, test } from "bun:test";
import { normalizeEntityTaxonomy } from "../src/shared/entity-taxonomy.ts";

test("entity taxonomy normalizes canonical fields and removes duplicates", () => {
  expect(normalizeEntityTaxonomy({
    typeId: " ontology/person ",
    categoryIds: ["class/news", " class/people ", "class/news"],
    tags: [" 人物 ", "人物", "PROFILE"],
  })).toEqual({
    hasType: true,
    typeId: "ontology/person",
    hasCategories: true,
    categoryIds: ["class/news", "class/people"],
    hasTags: true,
    tags: ["人物", "PROFILE"],
  });
});

test("entity taxonomy accepts legacy names while preferring canonical names", () => {
  expect(normalizeEntityTaxonomy({ type: "legacy", typeId: "canonical", categories: ["old"], categoryIds: ["new"] }))
    .toMatchObject({ typeId: "canonical", categoryIds: ["new"] });
});

test("entity taxonomy rejects scalar category and tag values", () => {
  expect(() => normalizeEntityTaxonomy({ categoryIds: "class/a" })).toThrow();
  expect(() => normalizeEntityTaxonomy({ tags: "tag" })).toThrow();
});
