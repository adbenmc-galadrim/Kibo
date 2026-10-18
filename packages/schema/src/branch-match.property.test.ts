import { expect, test } from "bun:test";
import fc from "fast-check";
import { matchBranchToTicket } from "./branch-match";

const keyArb = fc.integer({ min: 1, max: 120 }).map((n) => `SILO-${n}`);
const branchArb = fc
  .array(
    fc.oneof(fc.constantFrom("feat/", "fix/", "-", "silo-", "SILO-", "x", "/"), fc.nat(130).map(String)),
    {
      maxLength: 8,
    },
  )
  .map((parts) => parts.join(""));

const containsBetweenBounds = (branch: string, key: string): boolean =>
  new RegExp(`(^|[^A-Za-z0-9])${key}([^0-9]|$)`, "i").test(branch);

test("the matched ticket always has its key between bounds in the branch", () => {
  fc.assert(
    fc.property(fc.uniqueArray(keyArb, { maxLength: 10 }), branchArb, (keys, branch) => {
      const tickets = keys.map((key, i) => ({ id: `t${i}`, key }));
      const matched = matchBranchToTicket(branch, tickets);
      if (matched === null) return;
      const ticket = tickets.find((t) => t.id === matched);
      expect(ticket).toBeDefined();
      expect(containsBetweenBounds(branch, ticket?.key ?? "")).toBe(true);
      const others = tickets.filter((t) => t.id !== matched && containsBetweenBounds(branch, t.key));
      expect(others).toEqual([]);
    }),
  );
});
