import { describe, expect, test } from "bun:test";
import { LoroDoc } from "loro-crdt";
import {
  addLink,
  createProjectDoc,
  createTicket,
  enableServerAllocation,
  getKeyAllocator,
  getTicket,
  importExternalTicket,
  listTickets,
  nextPendingSeq,
  peekTicketKey,
  readProject,
  restoreLocalAllocation,
} from "./index";

const meta = { id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" };

function serverAllocated(): LoroDoc {
  const doc = createProjectDoc(meta);
  createTicket(doc, { title: "Existant" });
  doc.getMap("meta").set("keyAllocator", "server");
  doc.commit();
  return doc;
}

function peerCopy(doc: LoroDoc, peer: number): LoroDoc {
  const copy = LoroDoc.fromSnapshot(doc.export({ mode: "snapshot" }));
  copy.setPeerId(peer);
  return copy;
}

describe("local allocator", () => {
  test("is the default and keeps v0.6 behaviour", () => {
    const doc = createProjectDoc(meta);
    expect(getKeyAllocator(doc)).toBe("local");
    const a = createTicket(doc, { title: "A" });
    const b = createTicket(doc, { title: "B" });
    expect([a.key, b.key]).toEqual(["KIB-1", "KIB-2"]);
    expect([a.pendingSeq, b.pendingSeq]).toEqual([null, null]);
    expect(peekTicketKey(doc)).toBe("KIB-3");
  });

  test("readProject exposes an unshared, writable project", () => {
    const snapshot = readProject(createProjectDoc(meta));
    expect(snapshot.sync).toEqual({
      shared: false,
      keyAllocator: "local",
      role: null,
      access: "write",
      members: [],
    });
    expect(snapshot.nextTicketKey).toBe("KIB-1");
  });
});

describe("server allocator", () => {
  test("a new ticket has no key and a pending sequence", () => {
    const doc = peerCopy(serverAllocated(), 11);
    const a = createTicket(doc, { title: "A" });
    const b = createTicket(doc, { title: "B", parentId: a.id });
    expect([a.key, b.key]).toEqual([null, null]);
    expect([a.pendingSeq, b.pendingSeq]).toEqual([1, 2]);
    expect(getTicket(doc, b.id).pendingSeq).toBe(2);
  });

  test("the client never advances meta.ticketSeq", () => {
    const doc = peerCopy(serverAllocated(), 12);
    createTicket(doc, { title: "A" });
    createTicket(doc, { title: "B" });
    expect(doc.getMap("meta").get("ticketSeq")).toBe(1);
  });

  test("each peer counts its own pending tickets", () => {
    const shared = serverAllocated();
    const a = peerCopy(shared, 21);
    const b = peerCopy(shared, 22);
    createTicket(a, { title: "A1" });
    createTicket(a, { title: "A2" });
    b.import(a.export({ mode: "update" }));
    expect(nextPendingSeq(b)).toBe(1);
    expect(createTicket(b, { title: "B1" }).pendingSeq).toBe(1);
    expect(nextPendingSeq(a)).toBe(3);
  });

  test("the snapshot shows labels and no upcoming key", () => {
    const doc = peerCopy(serverAllocated(), 31);
    createTicket(doc, { title: "A" });
    const snapshot = readProject(doc);
    expect(snapshot.nextTicketKey).toBeNull();
    expect(snapshot.sync.keyAllocator).toBe("server");
    expect(snapshot.sync.shared).toBe(true);
    expect(snapshot.tickets.map((t) => t.keyLabel)).toEqual(["KIB-1", "KIB-…"]);
  });

  test("a dependency on a pending ticket is shown with its label", () => {
    const doc = peerCopy(serverAllocated(), 41);
    const [existing] = listTickets(doc);
    if (!existing) throw new Error("fixture has no ticket");
    const pending = createTicket(doc, { title: "Nouveau" });
    addLink(doc, { from: pending.id, to: existing.id, type: "blocks" });
    const view = readProject(doc).tickets.find((t) => t.id === existing.id);
    expect(view?.waitingOn).toEqual(["KIB-…"]);
  });

  test("an imported external ticket also waits for its key", () => {
    const doc = peerCopy(serverAllocated(), 51);
    const imported = importExternalTicket(doc, {
      title: "Issue #12",
      ref: {
        kind: "github_issue",
        bindingId: "b1",
        repo: "adam/kibo",
        number: 12,
        nodeId: "I_12",
        url: "https://github.com/adam/kibo/issues/12",
      },
    });
    expect(imported.key).toBeNull();
    expect(imported.pendingSeq).toBe(1);
  });
});

test("restoreLocalAllocation keys pending tickets and gives allocation back to the daemon", () => {
  const doc = createProjectDoc({ id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#14B8A6" });
  enableServerAllocation(doc);
  createTicket(doc, { title: "En attente" });
  expect(listTickets(doc)[0]?.key).toBeNull();
  expect(restoreLocalAllocation(doc)).toEqual([{ ticketId: listTickets(doc)[0]?.id ?? "", key: "KIB-1" }]);
  expect(getKeyAllocator(doc)).toBe("local");
  expect(createTicket(doc, { title: "Local" }).key).toBe("KIB-2");
});
