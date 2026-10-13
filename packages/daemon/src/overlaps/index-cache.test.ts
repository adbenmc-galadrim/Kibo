import { describe, expect, test } from "bun:test";
import { createIndexCache, type FileContent } from "./index-cache";

const content = (hash: string): FileContent => ({
  hash,
  exports: [],
  imports: [],
  lines: [],
  clipped: false,
  added: 1,
});

describe("index cache", () => {
  test("gives a file back only while its size and mtime are unchanged", () => {
    const cache = createIndexCache(10);
    cache.set("ws", "a.ts", { size: 3, mtimeMs: 10 }, content("h1"));
    expect(cache.get("ws", "a.ts", { size: 3, mtimeMs: 10 })).toEqual(content("h1"));
    expect(cache.get("ws", "a.ts", { size: 4, mtimeMs: 10 })).toBeNull();
    expect(cache.get("ws", "a.ts", { size: 3, mtimeMs: 11 })).toBeNull();
    expect(cache.get("other", "a.ts", { size: 3, mtimeMs: 10 })).toBeNull();
  });

  test("the least recently used entry leaves past the capacity", () => {
    const cache = createIndexCache(10_000);
    for (let i = 0; i <= 10_000; i++) cache.set("ws", `f${i}.ts`, { size: 1, mtimeMs: 1 }, content(`h${i}`));
    expect(cache.size()).toBe(10_000);
    expect(cache.get("ws", "f0.ts", { size: 1, mtimeMs: 1 })).toBeNull();
    expect(cache.get("ws", "f1.ts", { size: 1, mtimeMs: 1 })).not.toBeNull();
  });

  test("a read refreshes the entry", () => {
    const cache = createIndexCache(2);
    cache.set("ws", "a", { size: 1, mtimeMs: 1 }, content("a"));
    cache.set("ws", "b", { size: 1, mtimeMs: 1 }, content("b"));
    cache.get("ws", "a", { size: 1, mtimeMs: 1 });
    cache.set("ws", "c", { size: 1, mtimeMs: 1 }, content("c"));
    expect(cache.get("ws", "a", { size: 1, mtimeMs: 1 })).not.toBeNull();
    expect(cache.get("ws", "b", { size: 1, mtimeMs: 1 })).toBeNull();
  });

  test("forget and dropWorkspace remove entries", () => {
    const cache = createIndexCache(10);
    cache.set("ws", "a", { size: 1, mtimeMs: 1 }, content("a"));
    cache.set("ws", "b", { size: 1, mtimeMs: 1 }, content("b"));
    cache.set("other", "a", { size: 1, mtimeMs: 1 }, content("a"));
    cache.forget("ws", "a");
    expect(cache.get("ws", "a", { size: 1, mtimeMs: 1 })).toBeNull();
    cache.dropWorkspace("ws");
    expect(cache.size()).toBe(1);
  });
});
