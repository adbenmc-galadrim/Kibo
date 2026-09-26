import { describe, expect, test } from "bun:test";
import { LoroDoc } from "loro-crdt";
import {
  addLink,
  addPage,
  allocateTicketKeys,
  createProjectDoc,
  createTicket,
  deleteTicket,
  enableServerAllocation,
  listTickets,
  moveTicket,
  setStatus,
  type UpdateVerdict,
  updateTicket,
  validateProjectUpdate,
  writeMembers,
} from "./index";

const meta = { id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" };

function sharedServer(): LoroDoc {
  const doc = createProjectDoc(meta);
  createTicket(doc, { title: "Noyau" });
  createTicket(doc, { title: "Schéma" });
  enableServerAllocation(doc);
  writeMembers(doc, [{ userId: "u-adam", name: "Adam" }]);
  return doc;
}

function clientOf(server: LoroDoc): LoroDoc {
  const client = new LoroDoc();
  client.import(server.export({ mode: "update" }));
  return client;
}

function verdictFor(server: LoroDoc, edit: (client: LoroDoc) => void): UpdateVerdict {
  const client = clientOf(server);
  edit(client);
  const after = server.fork();
  after.import(client.export({ mode: "update", from: server.oplogVersion() }));
  return validateProjectUpdate(server, after);
}

const firstTicketNode = (doc: LoroDoc) => {
  const [first] = doc.getTree("tickets").roots();
  if (!first) throw new Error("fixture has no ticket");
  return first;
};

describe("refused updates", () => {
  test("a new ticket written with a key", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      const node = c.getTree("tickets").createNode();
      node.data.set("key", "KIB-99");
      node.data.set("pendingSeq", null);
      node.data.set("title", "Forgé");
      node.data.set("statusId", "todo");
      c.commit();
    });
    expect(verdict.ok).toBe(false);
  });

  test("an assigned key rewritten", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      firstTicketNode(c).data.set("key", "KIB-42");
      c.commit();
    });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("KIB-1") });
  });

  test("an assigned key reset to null", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      firstTicketNode(c).data.set("key", null);
      c.commit();
    });
    expect(verdict.ok).toBe(false);
  });

  test("meta.ticketSeq written by a client", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      c.getMap("meta").set("ticketSeq", 10);
      c.commit();
    });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("ticketSeq") });
  });

  test("meta.keyAllocator written by a client", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      c.getMap("meta").set("keyAllocator", "local");
      c.commit();
    });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("keyAllocator") });
  });

  test("meta.members written by a client", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      writeMembers(c, [
        { userId: "u-adam", name: "Adam" },
        { userId: "u-mallory", name: "Mallory" },
      ]);
    });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("members") });
  });
});

describe("reserved fields forged in another shape", () => {
  test("meta.members written as a plain value on a project without directory", () => {
    const server = createProjectDoc(meta);
    enableServerAllocation(server);
    const verdict = verdictFor(server, (c) => {
      c.getMap("meta").set("members", { "u-mallory": { name: "Mallory" } });
      c.commit();
    });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("members") });
  });

  test("a pending ticket given a non-string key", () => {
    const server = sharedServer();
    const client = clientOf(server);
    const pending = createTicket(client, { title: "Brouillon" });
    server.import(client.export({ mode: "update", from: server.oplogVersion() }));
    const verdict = verdictFor(server, (c) => {
      c.getTree("tickets")
        .roots()
        .find((node) => node.id === pending.id)
        ?.data.set("key", 7);
      c.commit();
    });
    expect(verdict.ok).toBe(false);
  });
});

describe("refusal keeps both documents intact", () => {
  test("neither the server state nor the client edits are touched", () => {
    const server = sharedServer();
    const client = clientOf(server);
    const serverVersion = server.oplogVersion();
    updateTicket(client, firstTicketNode(client).id, { title: "Renommé" });
    client.getMap("meta").set("ticketSeq", 10);
    client.commit();
    const after = server.fork();
    after.import(client.export({ mode: "update", from: server.oplogVersion() }));
    const serverJson = server.toJSON();
    const afterJson = after.toJSON();
    expect(validateProjectUpdate(server, after).ok).toBe(false);
    expect(server.oplogVersion().compare(serverVersion)).toBe(0);
    expect(server.toJSON()).toEqual(serverJson);
    expect(after.toJSON()).toEqual(afterJson);
    expect(listTickets(client)[0]?.title).toBe("Renommé");
  });
});

describe("accepted updates", () => {
  test("ordinary edits of tickets, links and pages", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      const [a, b] = listTickets(c);
      if (!a || !b) throw new Error("fixture has two tickets");
      updateTicket(c, a.id, { title: "Noyau de données" });
      setStatus(c, b.id, "blocked", "Attente client");
      moveTicket(c, b.id, a.id);
      addLink(c, { from: a.id, to: b.id, type: "relates" });
      addPage(c, { title: "Kanban", kind: "view" });
    });
    expect(verdict).toEqual({ ok: true });
  });

  test("a concurrent move that resurrects a deleted ticket is resurrected with its key", () => {
    const server = sharedServer();
    const stale = clientOf(server);
    const deleter = clientOf(server);
    const [a, b] = listTickets(deleter);
    if (!a || !b) throw new Error("fixture has two tickets");
    deleteTicket(deleter, b.id);
    server.import(deleter.export({ mode: "update", from: server.oplogVersion() }));
    updateTicket(stale, a.id, { title: "Noyau 1" });
    updateTicket(stale, a.id, { title: "Noyau 2" });
    moveTicket(stale, b.id, a.id);
    const after = server.fork();
    after.import(stale.export({ mode: "update", from: server.oplogVersion() }));
    expect(validateProjectUpdate(server, after)).toEqual({ ok: true });
  });

  test("a new ticket without key", () => {
    expect(verdictFor(sharedServer(), (c) => createTicket(c, { title: "Nouveau" }))).toEqual({ ok: true });
  });

  test("a concurrent title edit of a ticket the server just numbered", () => {
    const server = sharedServer();
    const client = clientOf(server);
    const pending = createTicket(client, { title: "Brouillon" });
    const pushed = client.export({ mode: "update", from: server.oplogVersion() });
    const beforeFirstPush = server.oplogVersion();
    server.import(pushed);
    allocateTicketKeys(server);
    updateTicket(client, pending.id, { title: "Brouillon relu" });
    const after = server.fork();
    after.import(client.export({ mode: "update", from: beforeFirstPush }));
    expect(validateProjectUpdate(server, after)).toEqual({ ok: true });
  });
});
