import { describe, expect, test } from "bun:test";
import { LoroDoc } from "loro-crdt";
import {
  allocateTicketKeys,
  createProjectDoc,
  createTicket,
  deleteTicket,
  enableServerAllocation,
  getKeyAllocator,
  getTicket,
  listTickets,
  pendingTicketOrder,
  readMembers,
  ticketCreationLamport,
  writeMembers,
} from "./index";

const meta = { id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316", worktree: null };

function sharedServer(): LoroDoc {
  const doc = createProjectDoc(meta);
  createTicket(doc, { title: "Existant" });
  enableServerAllocation(doc);
  return doc;
}

function replica(doc: LoroDoc, peer: number): LoroDoc {
  const copy = new LoroDoc();
  copy.setPeerId(peer);
  copy.import(doc.export({ mode: "update" }));
  return copy;
}

describe("enableServerAllocation", () => {
  test("switches the allocator and returns the current sequence", () => {
    const doc = createProjectDoc(meta);
    createTicket(doc, { title: "A" });
    createTicket(doc, { title: "B" });
    expect(enableServerAllocation(doc)).toBe(2);
    expect(getKeyAllocator(doc)).toBe("server");
  });
});

describe("allocateTicketKeys", () => {
  test("continues from meta.ticketSeq", () => {
    const server = sharedServer();
    const client = replica(server, 7);
    const a = createTicket(client, { title: "A" });
    const b = createTicket(client, { title: "B" });
    server.import(client.export({ mode: "update" }));
    expect(allocateTicketKeys(server)).toEqual([
      { ticketId: a.id, key: "KIB-2" },
      { ticketId: b.id, key: "KIB-3" },
    ]);
    expect(server.getMap("meta").get("ticketSeq")).toBe(3);
    expect(getTicket(server, b.id).key).toBe("KIB-3");
    expect(allocateTicketKeys(server)).toEqual([]);
  });

  test("orders by creation Lamport, then by id", () => {
    const server = sharedServer();
    const a = replica(server, 101);
    const b = replica(server, 202);
    const ta = createTicket(a, { title: "A" });
    const tb = createTicket(b, { title: "B" });
    b.import(a.export({ mode: "update" }));
    const tc = createTicket(b, { title: "C" });
    server.import(a.export({ mode: "update" }));
    server.import(b.export({ mode: "update" }));
    expect(ticketCreationLamport(server, ta.id)).toBe(ticketCreationLamport(server, tb.id));
    expect(ticketCreationLamport(server, tc.id)).toBeGreaterThan(ticketCreationLamport(server, ta.id));
    const first = [ta.id, tb.id].sort();
    expect(pendingTicketOrder(server)).toEqual([...first, tc.id]);
  });

  test("is deterministic whatever the import order", () => {
    const base = sharedServer();
    const a = replica(base, 11);
    const b = replica(base, 12);
    createTicket(a, { title: "A1" });
    createTicket(b, { title: "B1" });
    createTicket(a, { title: "A2" });
    const one = replica(base, 21);
    one.import(a.export({ mode: "update" }));
    one.import(b.export({ mode: "update" }));
    const two = replica(base, 22);
    two.import(b.export({ mode: "update" }));
    two.import(a.export({ mode: "update" }));
    expect(allocateTicketKeys(one)).toEqual(allocateTicketKeys(two));
  });

  test("skips a sub-ticket whose parent was deleted concurrently", () => {
    const server = sharedServer();
    const [parent] = listTickets(server);
    const a = replica(server, 31);
    const b = replica(server, 32);
    createTicket(a, { title: "Enfant", parentId: parent?.id ?? null });
    deleteTicket(b, parent?.id ?? "");
    server.import(a.export({ mode: "update" }));
    server.import(b.export({ mode: "update" }));
    expect(allocateTicketKeys(server)).toEqual([]);
    expect(server.getMap("meta").get("ticketSeq")).toBe(1);
  });
});

describe("corrupt sequence", () => {
  test("a non-numeric ticketSeq stops the allocation instead of restarting at 0", () => {
    const server = sharedServer();
    const client = replica(server, 41);
    createTicket(client, { title: "A" });
    server.import(client.export({ mode: "update" }));
    server.getMap("meta").set("ticketSeq", "1");
    server.commit();
    expect(() => allocateTicketKeys(server)).toThrow(expect.objectContaining({ code: "STORE_CORRUPT" }));
    expect(listTickets(server).map((t) => t.key)).toEqual(["KIB-1", null]);
  });
});

describe("members", () => {
  test("writes, updates and removes the display directory", () => {
    const doc = sharedServer();
    writeMembers(doc, [
      { userId: "u-lea", name: "Léa" },
      { userId: "u-adam", name: "Adam" },
    ]);
    expect(readMembers(doc)).toEqual([
      { userId: "u-adam", name: "Adam" },
      { userId: "u-lea", name: "Léa" },
    ]);
    writeMembers(doc, [{ userId: "u-adam", name: "Adam B." }]);
    expect(readMembers(doc)).toEqual([{ userId: "u-adam", name: "Adam B." }]);
  });

  test("a project without directory has no members", () => {
    expect(readMembers(createProjectDoc(meta))).toEqual([]);
  });
});
