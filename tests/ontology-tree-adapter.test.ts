import { describe, expect, test } from "bun:test";
import {
  createOntologyMovePayload,
  flattenOntologyTree,
  isIllegalOntologyMove,
  toOntologyTreeItems,
} from "../public/assets/scripts/ontology-tree-adapter";

const nodes = [{ id: "a", name: "A", parent_id: null, sort_order: 1, children: [
  { id: "b", name: "B", parent_id: "a", sort_order: 1, children: [
    { id: "c", name: "C", parent_id: "b", sort_order: 1, children: [] },
  ] },
] }];

describe("ontology tree adapter", () => {
  test("converts backend nodes without replacing stable ids", () => {
    const result = toOntologyTreeItems(nodes, new Set(["a"]));
    expect(result[0]?.id).toBe("a");
    expect(result[0]?.opened).toBe(true);
    expect(result[0]?.items?.[0]?.id).toBe("b");
    expect(result[0]?.items?.[0]?.data.ontologyId).toBe("b");
  });

  test("rejects moving below self or any descendant", () => {
    const flat = flattenOntologyTree(nodes, []);
    expect(isIllegalOntologyMove("a", "a", flat)).toBe(true);
    expect(isIllegalOntologyMove("a", "c", flat)).toBe(true);
    expect(isIllegalOntologyMove("c", "a", flat)).toBe(false);
    expect(isIllegalOntologyMove("a", null, flat)).toBe(false);
  });

  test("generates parent ids and contiguous sort orders", () => {
    expect(createOntologyMovePayload("c", "a", ["b", "c", "d"])).toEqual([
      { id: "b", parentId: "a", sortOrder: 1 },
      { id: "c", parentId: "a", sortOrder: 2 },
      { id: "d", parentId: "a", sortOrder: 3 },
    ]);
  });
});
