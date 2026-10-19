import { describe, expect, test } from "bun:test";
import { KiboError, Sprint } from "@kibo/schema";
import fc from "fast-check";
import { LoroDoc } from "loro-crdt";
import { createProjectDoc } from "./project";
import { createSprint, listSprints, updateSprint } from "./sprints";

const base = () =>
  createProjectDoc({
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
const range = fc.tuple(day, day).map(([x, y]) => (x <= y ? { start: x, end: y } : { start: y, end: x }));
const name = fc.stringMatching(/^[A-Z][a-z0-9 ]{0,20}[a-z0-9]$/);
const patch = fc.record({ name, start: day, end: day }, { requiredKeys: [] });

const tryUpdate = (doc: LoroDoc, id: string, p: Partial<{ name: string; start: string; end: string }>) => {
  try {
    updateSprint(doc, id, p);
  } catch (error) {
    if (!(error instanceof KiboError && error.code === "INVALID_INPUT")) throw error;
  }
};

describe("sprints merge", () => {
  test("two sprints created on two peers both exist after the merge", () => {
    fc.assert(
      fc.property(name, range, name, range, (n1, r1, n2, r2) => {
        const origin = base();
        const a = fork(origin, 1n);
        const b = fork(origin, 2n);
        const s1 = createSprint(a, { code: "A", name: n1, ...r1 });
        const s2 = createSprint(b, { code: "B", name: n2, ...r2 });
        merge(a, b);
        expect(listSprints(a)).toEqual(listSprints(b));
        expect(new Set(listSprints(a).map((s) => s.id))).toEqual(new Set([s1.id, s2.id]));
      }),
    );
  });

  test("concurrent changes of the same sprint leave one valid sprint, the same on both peers", () => {
    fc.assert(
      fc.property(range, patch, patch, (r, p1, p2) => {
        const origin = base();
        const created = createSprint(origin, { code: "S42", name: "S42", ...r });
        const a = fork(origin, 1n);
        const b = fork(origin, 2n);
        tryUpdate(a, created.id, p1);
        tryUpdate(b, created.id, p2);
        merge(a, b);
        const sprints = listSprints(a);
        expect(sprints).toEqual(listSprints(b));
        expect(sprints).toHaveLength(1);
        expect(Sprint.safeParse(sprints[0]).success).toBe(true);
        expect(sprints[0]?.id).toBe(created.id);
      }),
    );
  });
});
