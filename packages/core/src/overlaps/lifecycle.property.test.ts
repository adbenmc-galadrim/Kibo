import { describe, expect, test } from "bun:test";
import { type Overlap, overlapKey } from "@kibo/schema";
import fc from "fast-check";
import { reconcile } from "./lifecycle";
import type { Finding } from "./roles";

const arbFinding = fc
  .record({
    kind: fc.constantFrom("file" as const, "export" as const),
    name: fc.constantFrom("src/a.ts", "formatDate", "parseDate"),
    workspaces: fc.uniqueArray(fc.constantFrom("ws1", "ws2", "ws3"), { minLength: 2, maxLength: 2 }),
  })
  .map(
    ({ kind, name, workspaces: [owner = "ws1", other = "ws2"] }): Finding => ({
      kind,
      key: overlapKey(kind, name),
      ownerWorkspace: owner,
      otherWorkspace: other,
      ownerRunId: `run-${owner}`,
      otherRunId: `run-${other}`,
      detail:
        kind === "file"
          ? { kind, path: name }
          : { kind, name, ownerPath: `${owner}/x.ts`, otherPath: `${other}/x.ts` },
    }),
  );

const pairOf = (f: Finding) => [f.kind, f.key, ...[f.ownerWorkspace, f.otherWorkspace].sort()].join("|");

const arbFindings = fc.uniqueArray(arbFinding, { maxLength: 12, selector: pairOf });

const asOpen = (findings: readonly Finding[]): Overlap[] =>
  findings.map((f, i) => ({
    ...f,
    id: `o${i}`,
    projectId: "p",
    firstSeenAt: 0,
    lastSeenAt: 0,
    status: "open",
    deliveredAt: null,
    ownerDeliveredAt: null,
    resolvedAt: null,
    ignoredBy: null,
    ignoredAt: null,
  }));

const sweep = { kind: "sweep" } as const;

describe("reconcile properties", () => {
  test("(c) unchanged findings create and resolve nothing and touch every open overlap", () => {
    fc.assert(
      fc.property(arbFindings, (findings) => {
        const open = asOpen(findings);
        expect(reconcile(open, findings, new Set(), sweep)).toEqual({
          create: [],
          resolve: [],
          touch: open.map((o) => o.id),
        });
      }),
    );
  });

  test("(c) ignored keys create nothing", () => {
    fc.assert(
      fc.property(arbFindings, fc.array(fc.string(), { maxLength: 3 }), (findings, extra) => {
        const ignored = new Set([...findings.map((f) => f.key), ...extra]);
        expect(reconcile([], findings, ignored, sweep).create).toEqual([]);
      }),
    );
  });

  test("(c) a full sweep partitions the open overlaps between touched and resolved", () => {
    fc.assert(
      fc.property(arbFindings, arbFindings, (before, now) => {
        const open = asOpen(before);
        const result = reconcile(open, now, new Set(), sweep);
        expect([...result.touch, ...result.resolve].sort()).toEqual(open.map((o) => o.id).sort());
        const created = asOpen(result.create);
        const again = reconcile(
          [...open.filter((o) => result.touch.includes(o.id)), ...created],
          now,
          new Set(),
          sweep,
        );
        expect(again.create).toEqual([]);
        expect(again.resolve).toEqual([]);
      }),
    );
  });
});
