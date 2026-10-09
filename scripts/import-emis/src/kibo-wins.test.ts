import { expect, test } from "bun:test";
import type { StatusId, Ticket } from "@kibo/schema";
import fc from "fast-check";
import type { DesiredTicket } from "./desired";
import { reconcile } from "./reconcile";
import { applyLocally, emptySnapshot, fixtureDesired, withLegacyArbitrages } from "./reconcile.test-kit";

const desired = fixtureDesired();
const first = reconcile(emptySnapshot(), desired);
const imported = applyLocally(emptySnapshot(), first);
const STATUSES: StatusId[] = ["todo", "in_progress", "in_review", "done"];

const editKibo = (refId: string, patch: Partial<Ticket>) => ({
  ...imported,
  tickets: imported.tickets.map((t) =>
    t.externalRefs.some((r) => r.kind === "import_ref" && r.id === refId) ? { ...t, ...patch } : t,
  ),
});
const editPlan = (refId: string, patch: Partial<DesiredTicket>) => ({
  ...desired,
  tickets: desired.tickets.map((t) => (t.ref.id === refId ? { ...t, ...patch } : t)),
});
function idOf(refId: string): string {
  const id = imported.tickets.find((t) =>
    t.externalRefs.some((r) => r.kind === "import_ref" && r.id === refId),
  )?.id;
  if (id === undefined) throw new Error(`${refId} is not imported`);
  return id;
}

test("a status moved in Kibo is never put back by the plan: C0-10 in review, plan still todo", () => {
  const kibo = editKibo("C1-2", { statusId: "in_review" });
  const r = reconcile(kibo, desired, first.memory);
  expect(r.commands).toEqual([]);
  expect(r.changes).toContainEqual({ kind: "kept", what: "ticket C1-2", detail: "status (Kibo)" });
  expect(r.memory["plan:C1-2"]).toEqual(first.memory["plan:C1-2"]);
});

test("a plan change applies when Kibo did not move, and only then", () => {
  const plan = editPlan("C1-2", { statusId: "in_progress" });
  const r = reconcile(imported, plan, first.memory);
  expect(r.commands).toEqual([{ method: "setStatus", ticketId: idOf("C1-2"), statusId: "in_progress" }]);
  expect(r.memory["plan:C1-2"]?.status).toEqual({ statusId: "in_progress", blockedReason: null });
  const both = reconcile(editKibo("C1-2", { statusId: "in_review" }), plan, first.memory);
  expect(both.commands).toEqual([]);
  expect(both.changes).toContainEqual({ kind: "kept", what: "ticket C1-2", detail: "status (Kibo)" });
});

test("title, description, labels and parent edited in Kibo win; the plan still edits untouched fields", () => {
  const kibo = editKibo("C1-2", {
    title: "C1-2 · Renommée par Adam",
    description: "Réécrite\n",
    labels: ["area:web"],
    parentId: idOf("C0"),
  });
  const plan = editPlan("C1-2", { labels: ["area:api"], title: "C1-2 · Nouveau titre du plan" });
  const r = reconcile(kibo, plan, first.memory);
  expect(r.commands).toEqual([]);
  expect(r.changes).toContainEqual({
    kind: "kept",
    what: "ticket C1-2",
    detail: "title (Kibo), description (Kibo), labels (Kibo), parent (Kibo)",
  });
  const untouched = editKibo("C1-2", { title: "C1-2 · Renommée par Adam" });
  const mixed = reconcile(untouched, editPlan("C1-2", { description: "Plan revu\n" }), first.memory);
  expect(mixed.commands).toEqual([
    { method: "updateTicket", ticketId: idOf("C1-2"), description: "Plan revu\n" },
  ]);
  expect(mixed.changes).toContainEqual({
    kind: "updated",
    what: "ticket C1-2",
    detail: "description; title (Kibo)",
  });
});

test("a branch edited or removed in Kibo is not rewritten", () => {
  const removed = editKibo("C1-2", {
    externalRefs: imported.tickets
      .find((t) => t.id === idOf("C1-2"))
      ?.externalRefs.filter((r) => r.kind !== "git_branch"),
  });
  const plan = editPlan("C1-2", { refs: [{ kind: "git_branch", branch: "feat/connexion", base: null }] });
  expect(reconcile(removed, plan, first.memory).commands).toEqual([]);
});

test("a branch changed by the plan is written when Kibo still has the imported one", () => {
  const target = { kind: "git_branch" as const, branch: "feat/connexion-v2", base: null };
  const r = reconcile(imported, editPlan("C1-2", { refs: [target] }), first.memory);
  expect(r.commands).toEqual([{ method: "upsertExternalRef", ticketId: idOf("C1-2"), ref: target }]);
  expect(r.changes).toContainEqual({ kind: "updated", what: "ticket C1-2", detail: "git_branch" });
  expect(r.memory["plan:C1-2"]?.branch).toEqual(target);
});

test("a first run on the old import, without memory: old texts stay Kibo's, questions still migrate", () => {
  const oldDescription = "Questions ouvertes du plan Emis, par groupe.\n";
  const oldReason = "Q1 · Compte AWS au nom du client. Estelle.";
  const old = withLegacyArbitrages({
    ...imported,
    questions: [],
    tickets: imported.tickets.map((t) =>
      t.id === idOf("arbitrages")
        ? { ...t, description: oldDescription }
        : t.id === idOf("C0-3")
          ? { ...t, blockedReason: oldReason }
          : t,
    ),
  });
  const r = reconcile(old, desired);
  expect(r.changes).toContainEqual({ kind: "kept", what: "ticket arbitrages", detail: "description (Kibo)" });
  expect(r.changes).toContainEqual({ kind: "kept", what: "ticket C0-3", detail: "status (Kibo)" });
  const touches = (id: string) =>
    r.commands.some((c) => "ticketId" in c && c.ticketId === id && c.method !== "createQuestion");
  expect(touches(idOf("arbitrages"))).toBe(false);
  expect(touches(idOf("C0-3"))).toBe(false);
  expect(r.commands.filter((c) => c.method === "createQuestion")).toHaveLength(3);
  expect(r.commands.filter((c) => c.method === "removeLink")).toHaveLength(2);
  expect(r.commands.filter((c) => c.method === "deleteTicket")).toHaveLength(5);
  expect(r.changes.filter((c) => c.kind === "migrated")).toHaveLength(5);
  const relinked = {
    ...old,
    links: old.links.filter((l) => !(l.from === idOf("C0-1") && l.to === idOf("C0-2"))),
  };
  expect(reconcile(relinked, desired).commands).toContainEqual({
    method: "addLink",
    from: idOf("C0-1"),
    to: idOf("C0-2"),
    type: "blocks",
  });
  const after = applyLocally(old, r);
  expect(after.tickets.find((t) => t.id === idOf("arbitrages"))?.description).toBe(oldDescription);
  expect(after.tickets.find((t) => t.id === idOf("C0-3"))?.blockedReason).toBe(oldReason);
  expect(reconcile(after, desired, r.memory).commands).toEqual([]);
});

test("a ticket imported before the memory keeps its Kibo values and the memory starts from the plan", () => {
  const kibo = editKibo("C1-2", { statusId: "in_review" });
  const legacy = reconcile(kibo, desired);
  expect(legacy.commands).toEqual([]);
  expect(legacy.changes).toContainEqual({ kind: "kept", what: "ticket C1-2", detail: "status (Kibo)" });
  expect(legacy.memory["plan:C1-2"]).toEqual(first.memory["plan:C1-2"]);
  expect(reconcile(kibo, editPlan("C1-2", { statusId: "done" }), legacy.memory).commands).toEqual([]);
  const same = reconcile(imported, desired);
  expect(same.memory).toEqual(first.memory);
});

test("whatever Kibo and the plan change, a second pass changes nothing and Kibo edits are never written", () => {
  const prs = desired.tickets.filter((t) => /^C\d-\d$/.test(t.ref.id)).map((t) => t.ref.id);
  const edit = fc.record({ id: fc.constantFrom(...prs), status: fc.constantFrom(...STATUSES) });
  fc.assert(
    fc.property(fc.array(edit, { maxLength: 4 }), fc.array(edit, { maxLength: 4 }), (inKibo, inPlan) => {
      let kibo = imported;
      for (const e of inKibo)
        kibo = {
          ...kibo,
          tickets: kibo.tickets.map((t) =>
            t.id === idOf(e.id) ? { ...t, statusId: e.status, blockedReason: null } : t,
          ),
        };
      let plan = desired;
      for (const e of inPlan)
        plan = {
          ...plan,
          tickets: plan.tickets.map((t) =>
            t.ref.id === e.id ? { ...t, statusId: e.status, blockedReason: null } : t,
          ),
        };
      const touched = new Set(
        kibo.tickets.filter((t, i) => t.statusId !== imported.tickets[i]?.statusId).map((t) => t.id),
      );
      const r = reconcile(kibo, plan, first.memory);
      const overwrites = r.commands.filter((c) => c.method === "setStatus" && touched.has(c.ticketId));
      const again = reconcile(applyLocally(kibo, r), plan, r.memory);
      return overwrites.length === 0 && again.commands.length === 0;
    }),
  );
});
