import { describe, expect, test } from "bun:test";
import type { ProjectCommand, Ticket } from "@kibo/schema";
import fc from "fast-check";
import { LoroDoc } from "loro-crdt";
import { executeProjectCommand, readProject } from "./commands";
import { createProjectDoc } from "./project";
import { trackingMigrationCommands } from "./tracking-migration";

const base = () =>
  createProjectDoc({
    id: "p1",
    key: "SILO",
    name: "Silo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
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

const keysOnly = (doc: LoroDoc) =>
  trackingMigrationCommands(readProject(doc, "2026-10-16"), { planningPage: false });

function addFeatures(doc: LoroDoc, count: number, prefix: string): void {
  for (let i = 0; i < count; i += 1) {
    const root = executeProjectCommand(doc, { method: "createTicket", title: `${prefix} ${i}` }) as Ticket;
    executeProjectCommand(doc, {
      method: "createTicket",
      title: `${prefix} ${i} · étape`,
      parentId: root.id,
    });
  }
}

function migrate(doc: LoroDoc): void {
  for (let cmds = keysOnly(doc); cmds.length > 0; cmds = keysOnly(doc))
    for (const cmd of cmds) executeProjectCommand(doc, cmd);
}

const shortKeys = (doc: LoroDoc) =>
  readProject(doc, "2026-10-16").tickets.flatMap((t) =>
    t.shortKey === null ? [] : [[t.id, t.shortKey] as const],
  );

describe("tracking migration after a merge", () => {
  test("keys allocated on two peers end up unique, the same on both sides, and stable", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }),
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 4 }),
        (shared, left, right) => {
          const origin = base();
          addFeatures(origin, shared, "Commun");
          const a = fork(origin, 1n);
          const b = fork(origin, 2n);
          addFeatures(a, left, "A");
          addFeatures(b, right, "B");
          merge(a, b);
          const before = new Map(shortKeys(a));
          const planA: ProjectCommand[] = keysOnly(a);
          expect(planA).toEqual(keysOnly(b));
          migrate(a);
          migrate(b);
          merge(a, b);
          const after = shortKeys(a);
          expect(after).toEqual(shortKeys(b));
          expect(new Set(after.map(([, key]) => key)).size).toBe(after.length);
          expect(after.length).toBe(shared + left + right);
          const kept = after.filter(([id, key]) => before.get(id) === key).length;
          expect(kept).toBe(new Set(before.values()).size);
          expect(keysOnly(a)).toEqual([]);
        },
      ),
    );
  });
});
