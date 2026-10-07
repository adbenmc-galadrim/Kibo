import { expect, test } from "bun:test";
import fc from "fast-check";
import { reconcile, sameImportRef } from "./reconcile";
import { applyLocally, emptySnapshot, fixtureDesired, ref, withTicket } from "./reconcile.test-kit";

const desired = fixtureDesired();
const WRITES = new Set([
  "createTicket",
  "updateTicket",
  "setStatus",
  "moveTicket",
  "addLink",
  "upsertExternalRef",
]);

test("an empty project gets everything created, a second pass changes nothing", () => {
  const first = reconcile(emptySnapshot(), desired);
  expect(first.commands.filter((c) => c.method === "createTicket")).toHaveLength(desired.tickets.length);
  expect(first.commands.filter((c) => c.method === "addLink")).toHaveLength(desired.links.length);
  expect(first.changes.filter((c) => c.kind === "created")).toHaveLength(
    desired.tickets.length + desired.links.length,
  );
  const after = applyLocally(emptySnapshot(), first);
  const c12 = after.tickets.find((t) => t.title.startsWith("C1-2 · "));
  expect(c12?.parentId).toBe(after.tickets.find((t) => t.title === "C1 · Connexion")?.id ?? "");
  const second = reconcile(after, desired);
  expect(second.commands).toEqual([]);
  expect(second.changes.filter((c) => c.kind !== "kept")).toEqual([]);
});

test("a ticket found by title gets its import ref, renames are updates, strangers are orphans", () => {
  const snap = withTicket(emptySnapshot(), { title: "C0 · Socle", externalRefs: [] });
  const r = reconcile(snap, desired);
  expect(r.commands).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ method: "upsertExternalRef", ticketId: "t1", ref: ref("plan", "C0") }),
    ]),
  );
  expect(r.commands.filter((c) => c.method === "createTicket" && c.title === "C0 · Socle")).toHaveLength(0);
  expect(r.changes).toContainEqual(expect.objectContaining({ kind: "updated", what: "ticket C0" }));

  const renamed = withTicket(emptySnapshot(), { title: "Autre", externalRefs: [ref("plan", "C0")] });
  expect(reconcile(renamed, desired).commands).toEqual(
    expect.arrayContaining([expect.objectContaining({ method: "updateTicket", title: "C0 · Socle" })]),
  );

  const stranger = withTicket(emptySnapshot(), {
    title: "C9-9 · Disparue",
    externalRefs: [ref("plan", "C9-9")],
  });
  expect(reconcile(stranger, desired).changes).toEqual(
    expect.arrayContaining([expect.objectContaining({ kind: "orphan", what: "ticket C9-9" })]),
  );
});

test("statuses, parents and branches are repaired; a pr state owned by the poller is kept", () => {
  const imported = applyLocally(emptySnapshot(), reconcile(emptySnapshot(), desired));
  const id = (title: string) => imported.tickets.find((t) => t.title.startsWith(title))?.id ?? "";
  const merged = {
    ...imported,
    tickets: imported.tickets.map((t) =>
      t.title.startsWith("C0-2 · ")
        ? {
            ...t,
            statusId: "done" as const,
            parentId: id("C1 · "),
            externalRefs: t.externalRefs.map((r) =>
              r.kind === "github_pr" ? { ...r, state: "merged" as const } : r,
            ),
          }
        : t.title.startsWith("C1-2 · ")
          ? { ...t, externalRefs: t.externalRefs.filter((r) => r.kind !== "git_branch") }
          : t,
    ),
  };
  const r = reconcile(merged, desired);
  expect(r.commands).toEqual([
    { method: "moveTicket", ticketId: id("C0-2 · "), parentId: id("C0 · ") },
    { method: "setStatus", ticketId: id("C0-2 · "), statusId: "in_review" },
    {
      method: "upsertExternalRef",
      ticketId: id("C1-2 · "),
      ref: { kind: "git_branch", branch: "feat/connexion", base: "spike/sso" },
    },
  ]);
  const blocked = imported.tickets.map((t) =>
    t.title.startsWith("C0-3 · ") ? { ...t, statusId: "todo" as const, blockedReason: null } : t,
  );
  expect(reconcile({ ...imported, tickets: blocked }, desired).commands).toEqual([
    { method: "setStatus", ticketId: id("C0-3 · "), statusId: "blocked", reason: "Attend AWS" },
  ]);
});

test("links added in Kibo are drift, never removed; nothing is ever deleted", () => {
  const imported = applyLocally(emptySnapshot(), reconcile(emptySnapshot(), desired));
  const id = (title: string) => imported.tickets.find((t) => t.title.startsWith(title))?.id ?? "";
  const extra = {
    ...imported,
    links: [...imported.links, { id: "x", from: id("C0-3 · "), to: id("C1-3 · "), type: "blocks" as const }],
  };
  const r = reconcile(extra, desired);
  expect(r.commands).toEqual([]);
  expect(r.changes).toContainEqual({ kind: "drift", what: "link C0-3 → C1-3", detail: "blocks" });
  const orphaned = withTicket(imported, { title: "Vieux", externalRefs: [ref("todo", "OLD-1")] });
  const all = reconcile(orphaned, { ...desired, tickets: desired.tickets.slice(0, 3), links: [] });
  expect(all.commands.every((c) => WRITES.has(c.method))).toBe(true);
  expect(all.changes.filter((c) => c.kind === "orphan").length).toBeGreaterThan(1);
});

test("reconciling twice is idempotent for any desired subset", () => {
  fc.assert(
    fc.property(fc.subarray(desired.tickets), (tickets) => {
      let kept = tickets;
      const has = (r: (typeof tickets)[number]["ref"]) => kept.some((t) => sameImportRef(t.ref, r));
      while (kept.some((t) => t.parent !== null && !has(t.parent)))
        kept = kept.filter((t) => t.parent === null || has(t.parent));
      const d = { ...desired, tickets: kept, links: desired.links.filter((l) => has(l.from) && has(l.to)) };
      const after = applyLocally(emptySnapshot(), reconcile(emptySnapshot(), d));
      return reconcile(after, d).commands.length === 0;
    }),
  );
});
