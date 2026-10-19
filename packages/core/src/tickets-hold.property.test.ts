import { expect, test } from "bun:test";
import { Hold, KiboError } from "@kibo/schema";
import fc from "fast-check";
import { LoroDoc } from "loro-crdt";
import { createProjectDoc } from "./project";
import { createTicket, getTicket, setHold } from "./tickets";

const base = () => {
  const doc = createProjectDoc({
    id: "p1",
    key: "SILO",
    name: "Silo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  });
  const feature = createTicket(doc, { title: "F5", feature: true });
  const step = createTicket(doc, { title: "SILO-33", parentId: feature.id, statusId: "in_progress" });
  return { doc, step };
};

const fork = (doc: LoroDoc, peer: bigint): LoroDoc => {
  const copy = new LoroDoc();
  copy.setPeerId(peer);
  copy.import(doc.export({ mode: "snapshot" }));
  return copy;
};

const merge = (a: LoroDoc, b: LoroDoc): void => {
  a.import(b.export({ mode: "update", from: a.version() }));
  b.import(a.export({ mode: "update", from: b.version() }));
};

const day = fc.integer({ min: 1, max: 28 }).map((n) => `2026-10-${String(n).padStart(2, "0")}`);
const change = fc.record({ reason: fc.option(fc.constantFrom("MinIO", "VPN", "Recette", "  ")), since: day });
type Change = { reason: string | null; since: string };

const apply = (doc: LoroDoc, id: string, c: Change): void => {
  try {
    setHold(doc, id, c.reason, c.since);
  } catch (error) {
    if (!(error instanceof KiboError && error.code === "INVALID_INPUT")) throw error;
  }
};

test("a hold keeps the day it started and never touches the status", () => {
  fc.assert(
    fc.property(fc.array(change, { maxLength: 10 }), (changes) => {
      const { doc, step } = base();
      let since: string | null = null;
      for (const c of changes) {
        apply(doc, step.id, c);
        const valid = c.reason !== null && c.reason.trim().length > 0;
        if (c.reason === null) since = null;
        else if (valid && since === null) since = c.since;
        const ticket = getTicket(doc, step.id);
        expect(ticket.hold?.since ?? null).toBe(since);
        expect(ticket.statusId).toBe("in_progress");
      }
    }),
  );
});

test("concurrent holds and resumes on two peers converge on one valid hold", () => {
  fc.assert(
    fc.property(fc.array(change, { maxLength: 4 }), fc.array(change, { maxLength: 4 }), (left, right) => {
      const { doc, step } = base();
      const a = fork(doc, 1n);
      const b = fork(doc, 2n);
      for (const c of left) apply(a, step.id, c);
      for (const c of right) apply(b, step.id, c);
      merge(a, b);
      const merged = getTicket(a, step.id);
      expect(merged).toEqual(getTicket(b, step.id));
      expect(Hold.nullable().safeParse(merged.hold).success).toBe(true);
      expect(merged.statusId).toBe("in_progress");
    }),
  );
});
