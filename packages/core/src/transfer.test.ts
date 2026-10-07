import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
  addLink,
  createProjectDoc,
  createTicket,
  enableServerAllocation,
  getTicket,
  listLinks,
  listTickets,
  readProject,
  transferTicket,
  upsertExternalRef,
} from "./index";

const inboxMeta = { id: "inbox", key: "INB", name: "Inbox", folder: null, color: "#64748B", worktree: null };
const kibo = { id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316", worktree: null };

function seeded() {
  const from = createProjectDoc(inboxMeta);
  const to = createProjectDoc(kibo);
  createTicket(to, { title: "Existing" });
  const root = createTicket(from, {
    title: "Root",
    description: "desc",
    statusId: "blocked",
    blockedReason: "Audit",
    domainId: "core",
    assignee: { kind: "human", ref: "adam" },
  });
  const child = createTicket(from, { title: "Child", parentId: root.id });
  const grand = createTicket(from, { title: "Grand", parentId: child.id, statusId: "in_progress" });
  const other = createTicket(from, { title: "Other" });
  addLink(from, { from: child.id, to: grand.id, type: "blocks" });
  addLink(from, { from: root.id, to: grand.id, type: "relates" });
  addLink(from, { from: other.id, to: root.id, type: "relates" });
  return { from, to, root, child, grand, other };
}

describe("transferTicket", () => {
  test("recreates the subtree in order with new keys, keeps internal links, drops external ones, empties the source", () => {
    const { from, to, root, other } = seeded();
    const result = transferTicket(from, to, root.id, null);
    expect(result.created.map((c) => c.key)).toEqual(["KIB-2", "KIB-3", "KIB-4"]);
    expect([result.recreatedLinks, result.droppedLinks]).toEqual([2, 1]);
    const moved = getTicket(to, result.ticketId);
    expect([
      moved.title,
      moved.description,
      moved.statusId,
      moved.blockedReason,
      moved.domainId,
      moved.assignee,
    ]).toEqual(["Root", "desc", "blocked", "Audit", "core", { kind: "human", ref: "adam" }]);
    expect(
      listTickets(to).map((t) => [
        t.title,
        t.statusId,
        t.parentId === null ? null : getTicket(to, t.parentId).title,
      ]),
    ).toEqual([
      ["Existing", "todo", null],
      ["Root", "blocked", null],
      ["Child", "todo", "Root"],
      ["Grand", "in_progress", "Child"],
    ]);
    const byId = new Map(listTickets(to).map((t) => [t.id, t.title]));
    expect(
      listLinks(to)
        .map((l) => [byId.get(l.from), byId.get(l.to), l.type])
        .sort(),
    ).toEqual([
      ["Child", "Grand", "blocks"],
      ["Root", "Grand", "relates"],
    ]);
    expect(listTickets(from).map((t) => t.title)).toEqual(["Other"]);
    expect(listLinks(from)).toEqual([]);
    expect(getTicket(from, other.id).title).toBe("Other");
  });

  test("human assignees and external refs follow, agent assignees do not", () => {
    const from = createProjectDoc(inboxMeta);
    const to = createProjectDoc(kibo);
    const t = createTicket(from, { title: "T", assignee: { kind: "agent", ref: "dev" } });
    const ref = {
      kind: "github_pr",
      url: "https://github.com/a/b/pull/3",
      number: 3,
      state: "open",
      base: null,
      head: null,
    } as const;
    upsertExternalRef(from, t.id, ref);
    const result = transferTicket(from, to, t.id, null);
    const moved = getTicket(to, result.ticketId);
    expect(moved.assignee).toBeNull();
    expect(moved.externalRefs).toEqual([ref]);
  });

  test("a parent in the target is honoured; unknown ids are NOT_FOUND and nothing changes", () => {
    const { from, to, root } = seeded();
    const [existing] = listTickets(to);
    if (!existing) throw new Error("seed missing");
    const result = transferTicket(from, to, root.id, existing.id);
    expect(getTicket(to, result.ticketId).parentId).toBe(existing.id);
    const fresh = seeded();
    const before = [fresh.from.export({ mode: "snapshot" }), fresh.to.export({ mode: "snapshot" })];
    expect(() => transferTicket(fresh.from, fresh.to, "9@9", null)).toThrow("NOT_FOUND");
    expect(() => transferTicket(fresh.from, fresh.to, fresh.root.id, "9@9")).toThrow("NOT_FOUND");
    expect(listTickets(fresh.from)).toHaveLength(4);
    expect(listTickets(fresh.to)).toHaveLength(1);
    expect([fresh.from.export({ mode: "snapshot" }), fresh.to.export({ mode: "snapshot" })]).toEqual(before);
  });

  test("into a shared project the keys are pending", () => {
    const { from, to, root } = seeded();
    enableServerAllocation(to);
    const result = transferTicket(from, to, root.id, null);
    expect(result.key).toBeNull();
    expect(result.created.every((c) => c.key === null)).toBe(true);
    expect(getTicket(to, result.ticketId).pendingSeq).not.toBeNull();
    expect(readProject(to).nextTicketKey).toBeNull();
  });

  test("keys stay unique and ticketSeq consistent after any sequence of transfers", () => {
    fc.assert(
      fc.property(fc.array(fc.nat({ max: 3 }), { minLength: 1, maxLength: 8 }), (picks) => {
        const from = createProjectDoc(inboxMeta);
        const to = createProjectDoc(kibo);
        const roots = [0, 1, 2, 3].map((i) => createTicket(from, { title: `R${i}` }));
        for (const r of roots) createTicket(from, { title: "c", parentId: r.id });
        for (const pick of picks) {
          const root = roots[pick];
          if (root && listTickets(from).some((t) => t.id === root.id))
            transferTicket(from, to, root.id, null);
          createTicket(to, { title: "local" });
        }
        const keys = listTickets(to).map((t) => t.key);
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys.every((k) => k !== null && /^KIB-\d+$/.test(k))).toBe(true);
        expect(readProject(to).nextTicketKey).toBe(`KIB-${keys.length + 1}`);
      }),
    );
  });
});
