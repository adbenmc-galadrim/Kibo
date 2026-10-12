import { afterEach, expect, test } from "bun:test";
import { DEFAULT_DUPLICATION_SETTINGS } from "@kibo/schema";
import { fakeIndexer, indexedFile, indexOf } from "./detector-fakes.test-helper";
import {
  cleanDetectors,
  formatIn,
  run,
  setup,
  space,
  staleFinding,
  WS1,
  WS2,
} from "./detector-setup.test-helper";

afterEach(cleanDetectors);

test("a sweep on a partial index leaves an absent overlap open", async () => {
  const indexer = fakeIndexer();
  indexer.full.set(WS1, indexOf(WS1, [indexedFile("src/a.ts")]));
  indexer.full.set(WS2, indexOf(WS2, [indexedFile("src/b.ts")], true));
  const { detector, store } = setup({ indexer });
  const kept = store.create(staleFinding(), "P", 10);
  expect(await detector.sweep("P")).toEqual({ compared: 1, partial: true });
  expect(store.get(kept.id)?.status).toBe("open");
});

test("a vanished workspace settles its overlaps even when a single workspace is left", async () => {
  const { detector, store, state, indexer } = setup({ spaces: [space(WS1, [run(WS1, "r1", 100)])] });
  const vanished = store.create(staleFinding(), "P", 10);
  expect(await detector.sweep("P")).toEqual({ compared: 0, partial: false });
  expect(store.get(vanished.id)?.status).toBe("open");
  state.gone.add(WS2);
  await detector.sweep("P");
  expect(store.get(vanished.id)?.status).toBe("resolved");
  expect(state.emits).toBe(1);
  expect(indexer.calls).toEqual([]);
});

test("a listed workspace is never treated as vanished", async () => {
  const indexer = fakeIndexer();
  indexer.full.set(WS1, formatIn(WS1, "src/lib/format.ts"));
  indexer.full.set(WS2, formatIn(WS2, "src/utils/date.ts"));
  const { detector, store, state } = setup({ indexer });
  state.gone.add(WS2);
  await detector.sweep("P");
  expect(store.open("P").map((o) => o.key)).toEqual(["export:formatDate"]);
});

test("detection off settles nothing, not even a vanished workspace", async () => {
  const { detector, store, state } = setup({ spaces: [space(WS1, [run(WS1, "r1", 100)])] });
  const kept = store.create(staleFinding(), "P", 10);
  state.gone.add(WS2);
  state.settings = { ...DEFAULT_DUPLICATION_SETTINGS, enabled: false };
  await detector.sweep("P");
  expect(store.get(kept.id)?.status).toBe("open");
});

test("a failing auto linker is logged and the sweep still settles", async () => {
  const indexer = fakeIndexer();
  indexer.full.set(WS1, formatIn(WS1, "src/lib/format.ts"));
  indexer.full.set(WS2, formatIn(WS2, "src/utils/date.ts"));
  const { detector, store, state, logs } = setup({ indexer });
  state.linkerFailure = new Error("FORBIDDEN: read-only project");
  expect(await detector.sweep("P")).toEqual({ compared: 1, partial: false });
  expect(store.open("P")).toHaveLength(1);
  expect(logs.some((l) => l.includes("P") && l.includes("FORBIDDEN"))).toBe(true);
});
