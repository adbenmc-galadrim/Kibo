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

test("every safe folder sits strictly under the home and never climbs", () => {
  fc.assert(
    fc.property(fc.oneof(path, homeBased), (candidate) => {
      if (!isSafeAddDir(candidate, HOME)) return;
      expect(candidate.startsWith(`${HOME}/`)).toBe(true);
      expect(candidate.split("/").includes("..")).toBe(false);
      expect(candidate.split("/").filter((s) => s.length > 0)[2]).not.toBe(".kibo");
    }),
    { numRuns: 500 },
  );
});
