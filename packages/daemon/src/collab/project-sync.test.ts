import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTicket, listTickets, updateTicket } from "@kibo/core";
import type { ClientFrame, RejectCode, ServerFrame } from "@kibo/schema";
import { openServerDb, ProjectRoom, RoomReject, type ServerDb } from "@kibo/sync-server";
import { ownerSnapshot, type SeededUser, seedUser } from "@kibo/sync-server/testing/fixtures";
import { fromBase64, toBase64 } from "@kibo/trust";
import { LoroDoc, VersionVector } from "loro-crdt";
import { ProjectSync } from "./project-sync";
import { createMemoryHost, type MemoryHost } from "./testing/memory-host";

const NOW = 1_790_000_000_000;
type Down = Extract<ServerFrame, { type: "update" | "ack" | "reject" }>;

let sdb: ServerDb;
let adam: SeededUser;
let room: ProjectRoom;

beforeEach(async () => {
  sdb = openServerDb(":memory:");
  adam = await seedUser(sdb, "Adam", NOW);
  room = ProjectRoom.create(
    sdb,
    { projectId: "p1", name: "Kibo", ownerId: adam.userId, ownerName: "Adam", snapshot: ownerSnapshot() },
    NOW,
  );
});
afterEach(() => sdb.close());

const owner = () => ({ userId: adam.userId, deviceId: adam.deviceId, role: "owner" as const });

function relay() {
  const down: Down[] = [];
  const up: ClientFrame[] = [];
  const answer = (frame: ClientFrame) => {
    if (frame.type === "subscribe") {
      down.push({
        type: "update",
        projectId: "p1",
        bytes: toBase64(room.diffSince(frame.version === null ? null : fromBase64(frame.version))),
        serverSeq: room.serverSeq(),
        version: toBase64(room.version()),
      });
      return;
    }
    if (frame.type !== "push") return;
    try {
      const result = room.push(fromBase64(frame.bytes), owner(), NOW);
      down.push({
        type: "ack",
        projectId: "p1",
        clientBatchId: frame.clientBatchId,
        serverSeq: result.serverSeq,
        version: toBase64(result.version),
      });
      if (result.bytes !== null) {
        down.push({
          type: "update",
          projectId: "p1",
          bytes: toBase64(result.bytes),
          serverSeq: result.serverSeq,
          version: toBase64(result.version),
        });
      }
    } catch (e) {
      if (!(e instanceof RoomReject)) throw e;
      down.push({
        type: "reject",
        projectId: "p1",
        clientBatchId: frame.clientBatchId,
        code: e.code,
        message: e.message,
        version: e.version === null ? null : toBase64(e.version),
      });
    }
  };
  return {
    up,
    down,
    send: (frame: ClientFrame) => up.push(frame),
    serve() {
      for (let f = up.shift(); f !== undefined; f = up.shift()) answer(f);
    },
    deliver(sync: ProjectSync) {
      for (let f = down.shift(); f !== undefined; f = down.shift()) sync.receive(f);
    },
  };
}

type Harness = {
  sync: ProjectSync;
  host: MemoryHost;
  net: ReturnType<typeof relay>;
  timers: (() => void)[];
  saved: (Uint8Array | null)[];
  rejected: { code: RejectCode; message: string }[];
};

function client(initial: LoroDoc, serverVersion: Uint8Array | null): Harness {
  const net = relay();
  const host = createMemoryHost(initial);
  const timers: (() => void)[] = [];
  const saved: (Uint8Array | null)[] = [];
  const rejected: { code: RejectCode; message: string }[] = [];
  let batch = 0;
  const sync = new ProjectSync({
    projectId: "p1",
    host,
    send: net.send,
    serverVersion,
    saveServerVersion: (v) => saved.push(v),
    newBatchId: () => `b${++batch}`,
    schedule: (fn) => timers.push(fn),
    onRejected: (code, message) => rejected.push({ code, message }),
  });
  return { sync, host, net, timers, saved, rejected };
}

const runTimers = (h: Harness) => {
  for (let t = h.timers.shift(); t !== undefined; t = h.timers.shift()) t();
};

const roundTrip = (h: Harness) => {
  h.net.serve();
  h.net.deliver(h.sync);
};

const serverDoc = () => LoroDoc.fromSnapshot(room.snapshotBytes());

const sameVersion = (a: Uint8Array | null | undefined, b: Uint8Array) =>
  a !== null && a !== undefined && VersionVector.decode(a).compare(VersionVector.decode(b)) === 0;

const connectedClient = () => {
  const h = client(serverDoc(), room.version());
  h.sync.connected();
  roundTrip(h);
  return h;
};

describe("subscribe", () => {
  test("a new member catches up from an empty document", () => {
    const h = client(new LoroDoc(), null);
    h.sync.connected();
    expect(h.net.up[0]).toMatchObject({ type: "subscribe", projectId: "p1" });
    roundTrip(h);
    expect(listTickets(h.host.current()).map((t) => t.key)).toEqual(["KIB-1", "KIB-2"]);
    expect(sameVersion(h.saved.at(-1), room.version())).toBe(true);
    expect(h.net.up).toEqual([]);
  });

  test("nothing is pushed before the server version is known", () => {
    const h = client(serverDoc(), null);
    createTicket(h.host.current(), { title: "Hors ligne" });
    h.sync.localChange();
    runTimers(h);
    expect(h.net.up).toEqual([]);
  });

  test("offline changes are pushed right after the catch-up", () => {
    const h = client(serverDoc(), null);
    createTicket(h.host.current(), { title: "Hors ligne" });
    h.sync.connected();
    h.net.serve();
    h.net.deliver(h.sync);
    expect(h.net.up.map((f) => f.type)).toEqual(["push"]);
    roundTrip(h);
    expect(listTickets(serverDoc()).map((t) => t.key)).toEqual(["KIB-1", "KIB-2", "KIB-3"]);
  });
});

describe("push", () => {
  test("three quick commands make a single batch", () => {
    const h = connectedClient();
    for (const title of ["A", "B", "C"]) {
      createTicket(h.host.current(), { title });
      h.sync.localChange();
    }
    expect(h.timers).toHaveLength(1);
    runTimers(h);
    expect(h.net.up.filter((f) => f.type === "push")).toHaveLength(1);
    roundTrip(h);
    expect(listTickets(h.host.current()).map((t) => t.key)).toEqual([
      "KIB-1",
      "KIB-2",
      "KIB-3",
      "KIB-4",
      "KIB-5",
    ]);
    expect(h.sync.inFlight).toBeNull();
    expect(h.net.up).toEqual([]);
  });

  test("a single batch is in flight; the next one leaves after the ack", () => {
    const h = connectedClient();
    createTicket(h.host.current(), { title: "A" });
    h.sync.flush();
    expect(h.sync.inFlight).toBe("b1");
    createTicket(h.host.current(), { title: "B" });
    h.sync.flush();
    expect(h.net.up.filter((f) => f.type === "push")).toHaveLength(1);
    h.net.serve();
    h.net.deliver(h.sync);
    expect(h.net.up.map((f) => f.type)).toEqual(["push"]);
    expect(h.sync.inFlight).toBe("b2");
    roundTrip(h);
    expect(listTickets(serverDoc()).map((t) => t.title)).toEqual([
      "Noyau de données",
      "Schéma Loro des tickets",
      "A",
      "B",
    ]);
  });

  test("a disconnection releases the batch and nothing is sent while offline", () => {
    const h = connectedClient();
    createTicket(h.host.current(), { title: "A" });
    h.sync.flush();
    h.net.up.length = 0;
    h.sync.disconnected();
    expect(h.sync.inFlight).toBeNull();
    h.sync.flush();
    expect(h.net.up).toEqual([]);
  });

  test("an ack of a batch from a previous connection is ignored", () => {
    const h = connectedClient();
    createTicket(h.host.current(), { title: "A" });
    h.sync.flush();
    h.net.serve();
    h.sync.disconnected();
    h.sync.connected();
    const saved = h.saved.length;
    h.net.deliver(h.sync);
    expect(h.sync.inFlight).toBeNull();
    expect(h.saved.length).toBe(saved + 1);
    expect(h.net.up.map((f) => f.type)).toEqual(["subscribe"]);
    roundTrip(h);
    expect(listTickets(h.host.current()).map((t) => t.key)).toEqual(["KIB-1", "KIB-2", "KIB-3"]);
    expect(h.net.up).toEqual([]);
  });
});

describe("rejections", () => {
  test("UPDATE_REJECTED replaces the document and drops the forged change", () => {
    const h = connectedClient();
    const [first] = h.host.current().getTree("tickets").roots();
    first?.data.set("key", "KIB-42");
    h.host.current().commit();
    h.sync.flush();
    h.net.serve();
    h.net.deliver(h.sync);
    expect(h.rejected.map((r) => r.code)).toEqual(["UPDATE_REJECTED"]);
    expect(h.sync.resyncing).toBe(true);
    expect(h.net.up).toEqual([{ type: "subscribe", projectId: "p1", version: null }]);
    roundTrip(h);
    expect(h.host.replaced).toBe(1);
    expect(h.sync.resyncing).toBe(false);
    expect(listTickets(h.host.current()).map((t) => t.key)).toEqual(["KIB-1", "KIB-2"]);
    h.sync.flush();
    expect(h.net.up).toEqual([]);
  });

  test("a resync waits until the fresh document reaches the server version", () => {
    const h = connectedClient();
    h.sync.resync();
    const other = serverDoc();
    const before = room.version();
    createTicket(other, { title: "D'un autre appareil" });
    const pushed = room.push(
      other.export({ mode: "update", from: VersionVector.decode(before) }),
      owner(),
      NOW,
    );
    if (pushed.bytes === null) throw new Error("expected a change");
    h.sync.receive({
      type: "update",
      projectId: "p1",
      bytes: toBase64(pushed.bytes),
      serverSeq: pushed.serverSeq,
      version: toBase64(pushed.version),
    });
    expect(h.host.replaced).toBe(0);
    expect(h.sync.resyncing).toBe(true);
    roundTrip(h);
    expect(h.host.replaced).toBe(1);
    expect(listTickets(h.host.current()).map((t) => t.key)).toEqual(["KIB-1", "KIB-2", "KIB-3"]);
  });

  test("OUT_OF_DATE resends from the server version", () => {
    const local = serverDoc();
    const t = createTicket(local, { title: "A" });
    const pretended = local.oplogVersion().encode();
    updateTicket(local, t.id, { title: "A bis" });
    const h = client(local, pretended);
    h.sync.connected();
    h.net.up.length = 0;
    h.sync.flush();
    h.net.serve();
    h.net.deliver(h.sync);
    expect(h.rejected).toEqual([]);
    roundTrip(h);
    expect(listTickets(serverDoc()).find((x) => x.id === t.id)?.title).toBe("A bis");
  });

  test("OUT_OF_DATE from the version the batch left from is reported, not resent", () => {
    const h = connectedClient();
    createTicket(h.host.current(), { title: "A" });
    h.sync.flush();
    h.net.up.length = 0;
    h.sync.receive({
      type: "reject",
      projectId: "p1",
      clientBatchId: "b1",
      code: "OUT_OF_DATE",
      message: "update depends on changes the server does not have",
      version: toBase64(room.version()),
    });
    expect(h.rejected.map((r) => r.code)).toEqual(["OUT_OF_DATE"]);
    expect(h.sync.inFlight).toBeNull();
    expect(h.net.up).toEqual([]);
  });

  test("other rejections release the batch without resending", () => {
    const h = connectedClient();
    createTicket(h.host.current(), { title: "A" });
    h.sync.flush();
    h.net.up.length = 0;
    h.sync.receive({
      type: "reject",
      projectId: "p1",
      clientBatchId: "b1",
      code: "FORBIDDEN",
      message: "viewers cannot write",
      version: null,
    });
    expect(h.rejected.map((r) => r.code)).toEqual(["FORBIDDEN"]);
    expect(h.sync.inFlight).toBeNull();
    expect(h.sync.resyncing).toBe(false);
    expect(h.net.up).toEqual([]);
  });
});
