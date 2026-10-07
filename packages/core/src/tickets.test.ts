import { describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import fc from "fast-check";
import { LoroDoc, type TreeID } from "loro-crdt";
import {
  childProgress,
  createProjectDoc,
  createTicket,
  deleteTicket,
  getTicket,
  listTickets,
  moveTicket,
  setStatus,
  ticketTree,
  updateTicket,
  upsertExternalRef,
} from "./index";

const doc = () =>
  createProjectDoc({ id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316", worktree: null });

describe("keys", () => {
  test("keys are flat, sequential and independent from the hierarchy", () => {
    const d = doc();
    const a = createTicket(d, { title: "Parent" });
    const b = createTicket(d, { title: "Enfant", parentId: a.id });
    expect([a.key, b.key]).toEqual(["KIB-1", "KIB-2"]);
    moveTicket(d, b.id, null);
    expect(getTicket(d, b.id).key).toBe("KIB-2");
  });

  test("many tickets under random parents never share a key", () => {
    fc.assert(
      fc.property(fc.array(fc.nat(), { minLength: 1, maxLength: 60 }), (parents) => {
        const d = doc();
        const ids: string[] = [];
        for (const p of parents) {
          const parentId = ids.length > 0 ? (ids[p % ids.length] ?? null) : null;
          ids.push(createTicket(d, { title: "T", parentId }).id);
        }
        const keys = listTickets(d).map((t) => t.key);
        expect(new Set(keys).size).toBe(parents.length);
      }),
    );
  });
});

describe("status", () => {
  test("blocking requires a non-empty reason and unblocking clears it", () => {
    const d = doc();
    const t = createTicket(d, { title: "Maquette" });
    expect(() => setStatus(d, t.id, "blocked")).toThrow("BLOCKED_REASON_REQUIRED");
    expect(() => setStatus(d, t.id, "blocked", "   ")).toThrow("BLOCKED_REASON_REQUIRED");
    expect(getTicket(d, t.id).statusId).toBe("todo");
    expect(setStatus(d, t.id, "blocked", "Attente client").blockedReason).toBe("Attente client");
    expect(setStatus(d, t.id, "in_progress").blockedReason).toBeNull();
  });

  test("a ticket can be born blocked when a reason is given, and not otherwise", () => {
    const d = doc();
    const t = createTicket(d, {
      title: "Audit",
      statusId: "blocked",
      blockedReason: " Audit externe en attente ",
    });
    expect([t.statusId, t.blockedReason]).toEqual(["blocked", "Audit externe en attente"]);
    expect(() => createTicket(d, { title: "B", statusId: "blocked", blockedReason: "   " })).toThrow(
      "BLOCKED_REASON_REQUIRED",
    );
    expect(() => createTicket(d, { title: "C", statusId: "blocked" })).toThrow("BLOCKED_REASON_REQUIRED");
    expect(
      createTicket(d, { title: "D", statusId: "todo", blockedReason: "ignored" }).blockedReason,
    ).toBeNull();
    expect(listTickets(d).map((x) => x.title)).toEqual(["Audit", "D"]);
  });
});

describe("tree", () => {
  test("progress counts direct children only", () => {
    const d = doc();
    const p = createTicket(d, { title: "P" });
    const c1 = createTicket(d, { title: "C1", parentId: p.id });
    createTicket(d, { title: "C2", parentId: p.id });
    const g = createTicket(d, { title: "G", parentId: c1.id });
    setStatus(d, c1.id, "done");
    setStatus(d, g.id, "done");
    expect(childProgress(d, p.id)).toEqual({ done: 1, total: 2 });
  });

  test("refuses to move a ticket under its descendant", () => {
    const d = doc();
    const a = createTicket(d, { title: "A" });
    const b = createTicket(d, { title: "B", parentId: a.id });
    expect(() => moveTicket(d, a.id, b.id)).toThrow("TREE_CYCLE");
    expect(() => moveTicket(d, a.id, a.id)).toThrow("TREE_CYCLE");
    expect(getTicket(d, b.id).parentId).toBe(a.id);
  });

  test("update keeps the key and rejects an empty title", () => {
    const d = doc();
    const t = createTicket(d, { title: "A", description: "v1" });
    const u = updateTicket(d, t.id, {
      title: "B",
      description: "v2",
      assignee: { kind: "agent", ref: "opus-dev-1" },
    });
    expect(u).toMatchObject({
      key: "KIB-1",
      title: "B",
      description: "v2",
      assignee: { kind: "agent", ref: "opus-dev-1" },
    });
    expect(() => updateTicket(d, t.id, { title: "" })).toThrow("INVALID_INPUT");
  });

  test("delete removes the subtree", () => {
    const d = doc();
    const a = createTicket(d, { title: "A" });
    const b = createTicket(d, { title: "B", parentId: a.id });
    expect(deleteTicket(d, a.id).sort()).toEqual([a.id, b.id].sort());
    expect(listTickets(d)).toEqual([]);
  });
});

test("concurrent moves on two peers converge without cycles", () => {
  const move = fc.tuple(fc.boolean(), fc.nat(5), fc.option(fc.nat(5), { nil: null }));
  fc.assert(
    fc.property(fc.array(move, { maxLength: 30 }), (ops) => {
      const base = doc();
      const ids = Array.from({ length: 6 }, (_, i) => createTicket(base, { title: `T${i}` }).id);
      const snapshot = base.export({ mode: "snapshot" });
      const a = LoroDoc.fromSnapshot(snapshot);
      a.setPeerId(101);
      const b = LoroDoc.fromSnapshot(snapshot);
      b.setPeerId(202);
      for (const [onA, i, p] of ops) {
        try {
          moveTicket(onA ? a : b, ids[i] ?? "", p === null ? null : (ids[p] ?? null));
        } catch (e) {
          if (!(e instanceof KiboError && e.code === "TREE_CYCLE")) throw e;
        }
      }
      a.import(b.export({ mode: "update" }));
      b.import(a.export({ mode: "update" }));
      const la = listTickets(a);
      expect(la).toEqual(listTickets(b));
      for (const t of la) {
        const seen = new Set<string>();
        let current: string | null = t.id;
        while (current) {
          expect(seen.has(current)).toBe(false);
          seen.add(current);
          const id: string = current;
          current = la.find((x) => x.id === id)?.parentId ?? null;
        }
      }
    }),
    { numRuns: 200 },
  );
});

test("upsertExternalRef adds a PR once per URL and keeps the latest state", () => {
  const d = doc();
  const t = createTicket(d, { title: "Schéma" });
  expect(t.externalRefs).toEqual([]);
  const url = "https://github.com/kibo/test/pull/3";
  upsertExternalRef(d, t.id, { kind: "github_pr", url, number: 3, state: "draft", base: null, head: null });
  const after = upsertExternalRef(d, t.id, {
    kind: "github_pr",
    url,
    number: 3,
    state: "merged",
    base: null,
    head: null,
  });
  expect(after.externalRefs).toEqual([
    { kind: "github_pr", url, number: 3, state: "merged", base: null, head: null },
  ]);
});

describe("order", () => {
  test("moveTicket with an index puts the ticket at that final position among its siblings", () => {
    const d = doc();
    const a = createTicket(d, { title: "a" });
    createTicket(d, { title: "b" });
    const c = createTicket(d, { title: "c" });
    const p = createTicket(d, { title: "p" });
    createTicket(d, { title: "q", parentId: p.id });
    const order = () => listTickets(d).map((t) => t.title);
    expect(order()).toEqual(["a", "b", "c", "p", "q"]);
    moveTicket(d, a.id, null, 1);
    expect(order()).toEqual(["b", "a", "c", "p", "q"]);
    moveTicket(d, c.id, null, 0);
    expect(order()).toEqual(["c", "b", "a", "p", "q"]);
    moveTicket(d, c.id, null, 3);
    expect(order()).toEqual(["b", "a", "p", "q", "c"]);
    moveTicket(d, a.id, p.id, 1);
    expect(order()).toEqual(["b", "p", "q", "a", "c"]);
  });
});

describe("labels", () => {
  test("labels are normalized at creation and replaced at update, old nodes read as empty", () => {
    const d = doc();
    const t = createTicket(d, { title: "x", labels: ["b", " a", "a"] });
    expect(t.labels).toEqual(["a", "b"]);
    expect(updateTicket(d, t.id, { labels: ["phase:p1"] }).labels).toEqual(["phase:p1"]);
    expect(updateTicket(d, t.id, { title: "y" }).labels).toEqual(["phase:p1"]);
    expect(updateTicket(d, t.id, { labels: [] }).labels).toEqual([]);
    expect(() => updateTicket(d, t.id, { labels: ["Bad"] })).toThrow(KiboError);
    expect(getTicket(d, t.id).labels).toEqual([]);
    expect(() => createTicket(d, { title: "z", labels: ["a b"] })).toThrow(KiboError);
    const legacy = createTicket(d, { title: "legacy" });
    ticketTree(d)
      .getNodeByID(legacy.id as TreeID)
      ?.data.delete("labels");
    expect(getTicket(d, legacy.id).labels).toEqual([]);
  });

  test("concurrent label updates converge to one normalized list", () => {
    const label = fc.stringMatching(/^[a-z][a-z0-9]{0,3}(:[a-z0-9]{1,3})?$/);
    fc.assert(
      fc.property(fc.array(label, { maxLength: 6 }), fc.array(label, { maxLength: 6 }), (left, right) => {
        const base = doc();
        const t = createTicket(base, { title: "x" });
        const snapshot = base.export({ mode: "snapshot" });
        const a = LoroDoc.fromSnapshot(snapshot);
        a.setPeerId(101);
        const b = LoroDoc.fromSnapshot(snapshot);
        b.setPeerId(202);
        updateTicket(a, t.id, { labels: left });
        updateTicket(b, t.id, { labels: right });
        a.import(b.export({ mode: "update" }));
        b.import(a.export({ mode: "update" }));
        const merged = getTicket(a, t.id).labels;
        expect(getTicket(b, t.id).labels).toEqual(merged);
        expect([[...new Set(left)].sort(), [...new Set(right)].sort()]).toContainEqual(merged);
      }),
    );
  });
});
