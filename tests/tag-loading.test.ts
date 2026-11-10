import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync("public/assets/scripts/schema-panel.js", "utf8");

function setup() {
  const pending: Array<{ resolve: (data: unknown) => void; reject: (error: Error) => void }> = [];
  const events: string[] = [];
  const window: any = {
    location: { origin: "http://localhost" },
    dispatchEvent: () => events.push(window.kbClassesLoadState),
  };
  const method = source.slice(source.indexOf("  let classLoadVersion = 0;"), source.indexOf("  async function exportClassTree"));
  const load = new Function("window", "appendCurrentDbToUrl", "apiGet", "renderClassTree", "clsTree", "console", `${method}; return loadClasses;`)(
    window, (url: URL) => url,
    () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    () => {}, {}, { error() {} },
  );
  return { load, window, pending, events };
}

test("late class data notifies tags after loading completes", async () => {
  const { load, window, pending, events } = setup();
  const request = load("");
  expect(events).toEqual(["loading"]);
  pending[0].resolve([{ id: "a", tags: ["标签"] }]);
  await request;
  expect(window.kbClasses[0].tags).toEqual(["标签"]);
  expect(events).toEqual(["loading", "ready"]);
});

test("failure preserves existing tags and retry recovers", async () => {
  const { load, window, pending } = setup();
  window.kbClasses = [{ id: "a", tags: ["已加载"] }];
  const failed = load("");
  pending[0].reject(new Error("offline"));
  await failed;
  expect(window.kbClassesLoadState).toBe("error");
  expect(window.kbClasses[0].tags).toEqual(["已加载"]);
  const retry = load("");
  pending[1].resolve([]);
  await retry;
  expect(window.kbClassesLoadState).toBe("ready");
});

test("older class response cannot overwrite newer data", async () => {
  const { load, window, pending } = setup();
  const older = load("");
  const newer = load("");
  pending[1].resolve([{ id: "new" }]);
  await newer;
  pending[0].resolve([{ id: "old" }]);
  await older;
  expect(window.kbClasses[0].id).toBe("new");
});
