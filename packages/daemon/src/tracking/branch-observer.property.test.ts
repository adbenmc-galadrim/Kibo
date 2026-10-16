import { expect, test } from "bun:test";
import { branchRefOf } from "@kibo/schema";
import fc from "fast-check";
import { observeBranches } from "./branch-observer";
import { createObserverFixture } from "./observer-fixture.test-helper";

const TICKETS = 12;
const keyArb = fc.integer({ min: 1, max: 14 }).map((n) => `emis-${n}`);
const partArb = fc.oneof(
  keyArb,
  keyArb.map((k) => k.toUpperCase()),
  fc.constantFrom("x", "fix", "1", "a2"),
);
const branchArb = fc
  .tuple(fc.constantFrom("feat/", "fix/", ""), fc.array(partArb, { minLength: 1, maxLength: 3 }))
  .map(([prefix, parts]) => `${prefix}${parts.join("-")}`);

const names = (branch: string, key: string): boolean => {
  const lower = branch.toLowerCase();
  const needle = key.toLowerCase();
  for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, at + 1)) {
    const before = lower[at - 1];
    const after = lower[at + needle.length];
    if ((before === undefined || !/[a-z0-9]/.test(before)) && (after === undefined || !/[0-9]/.test(after)))
      return true;
  }
  return false;
};

test("kibo links a branch only to the single ticket it names, and a replay changes nothing", async () => {
  await fc.assert(
    fc.asyncProperty(fc.uniqueArray(branchArb, { maxLength: 6 }), async (branches) => {
      const fx = createObserverFixture(TICKETS);
      try {
        const state = new Map<string, string>();
        const deps = { service: fx.service, refs: async () => branches, log: () => () => undefined };
        await observeBranches(deps, state);
        const keys = Array.from({ length: TICKETS }, (_, i) => `EMIS-${i + 1}`);
        for (const key of keys) {
          const branch = branchRefOf(fx.ticket(key).externalRefs)?.branch;
          if (!branch) continue;
          expect(names(branch, key)).toBe(true);
          expect(keys.filter((k) => names(branch, k))).toEqual([key]);
        }
        const seen = fx.events.length;
        await observeBranches(deps, state);
        expect(fx.events.length).toBe(seen);
      } finally {
        fx.close();
      }
    }),
    { numRuns: 25 },
  );
});
