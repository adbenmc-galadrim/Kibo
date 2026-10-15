import { expect, test } from "bun:test";
import fc from "fast-check";
import { isSafeAddDir } from "./add-dir";

const HOME = "/Users/a";
const SEGMENTS = ["..", ".", "", ".kibo", ".ssh", ".claude", "skills", "x", "Users", "a", "~"];
const segment = fc.oneof(fc.constantFrom(...SEGMENTS), fc.string({ maxLength: 6 }));
const path = fc
  .tuple(fc.boolean(), fc.array(segment, { maxLength: 6 }))
  .map(([absolute, parts]) => `${absolute ? "/" : ""}${parts.join("/")}`);
const homeBased = fc.array(segment, { maxLength: 5 }).map((parts) => `${HOME}/${parts.join("/")}`);

const segmentsOf = (value: string): string[] => value.split("/").filter((s) => s.length > 0);

function expectStrictlyUnderHome(candidate: string) {
  if (!isSafeAddDir(candidate, HOME)) return;
  const parts = segmentsOf(candidate);
  expect(candidate.startsWith("/")).toBe(true);
  expect(parts.slice(0, 2)).toEqual(segmentsOf(HOME));
  expect(parts.length).toBeGreaterThan(2);
  expect(parts.includes("..")).toBe(false);
  expect(parts[2]?.toLowerCase()).not.toBe(".kibo");
}

test("doubled slashes and blank segments keep the invariant", () => {
  for (const candidate of ["//Users/a/ ", "/Users//a/ ", "//Users/a/x", "/Users/a/ "]) {
    expectStrictlyUnderHome(candidate);
  }
});

test("every safe folder sits strictly under the home and never climbs", () => {
  fc.assert(fc.property(fc.oneof(path, homeBased), expectStrictlyUnderHome), { numRuns: 500 });
});
