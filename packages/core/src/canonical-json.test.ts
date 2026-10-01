import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { canonicalJson, sameJson } from "./canonical-json";

function shuffledKeys(value: unknown, seed: number): unknown {
  if (Array.isArray(value)) return value.map((inner) => shuffledKeys(inner, seed));
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value);
  const rotation = entries.length === 0 ? 0 : seed % entries.length;
  const rotated = [...entries.slice(rotation), ...entries.slice(0, rotation)].reverse();
  return Object.fromEntries(rotated.map(([key, inner]) => [key, shuffledKeys(inner, seed + 1)]));
}

describe("canonicalJson", () => {
  test("ignores the order of keys at every depth", () => {
    const a = { repo: "adam/kibo", project: { owner: "adam", statusMap: { todo: "Todo", done: "Fait" } } };
    const b = { project: { statusMap: { done: "Fait", todo: "Todo" }, owner: "adam" }, repo: "adam/kibo" };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(sameJson(a, b)).toBe(true);
  });

  test("keeps the order of array items", () => {
    expect(sameJson({ labels: ["bug", "ux"] }, { labels: ["ux", "bug"] })).toBe(false);
  });

  test("tells different values apart", () => {
    expect(sameJson({ repo: "adam/kibo" }, { repo: "adam/other" })).toBe(false);
    expect(sameJson({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(sameJson(null, {})).toBe(false);
  });

  test("is invariant under any permutation of keys, at any depth", () => {
    fc.assert(
      fc.property(fc.jsonValue(), fc.nat(), (value, seed) => {
        expect(canonicalJson(shuffledKeys(value, seed))).toBe(canonicalJson(value));
      }),
    );
  });
});
