import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTicket, getKeyAllocator, listTickets, readMembers, updateTicket } from "@kibo/core";
import { MAX_FRAME_BYTES } from "@kibo/schema";
import { LoroDoc, VersionVector } from "loro-crdt";
import { openServerDb, type ServerDb } from "./db";
import { type Actor, ProjectRoom, RoomReject } from "./room";
import { addMember, ownerSnapshot, type SeededUser, seedUser } from "./testing/fixtures";

const NOW = 1_790_000_000_000;
let sdb: ServerDb;
let adam: SeededUser;
let lea: SeededUser;

beforeEach(async () => {
  sdb = openServerDb(":memory:");
  adam = await seedUser(sdb, "Adam", NOW);
  lea = await seedUser(sdb, "Léa", NOW);
});
afterEach(() => sdb.close());

const actor = (u: SeededUser, role: Actor["role"]): Actor => ({
  userId: u.userId,
  deviceId: u.deviceId,
  role,
});

function share(limits?: { projectBytes?: number; compactEvery?: number }, projectId = "p1"): ProjectRoom {
  return ProjectRoom.create(
    sdb,
    { projectId, name: "Kibo", ownerId: adam.userId, ownerName: "Adam", snapshot: ownerSnapshot() },
    NOW,
    limits,
  );
}

function docOf(room: ProjectRoom): LoroDoc {
  return LoroDoc.fromSnapshot(room.snapshotBytes());
}

function clientOf(room: ProjectRoom): LoroDoc {
  const client = new LoroDoc();
  client.import(room.diffSince(null));
  return client;
}

const changesSince = (client: LoroDoc, room: ProjectRoom): Uint8Array =>
  client.export({ mode: "update", from: VersionVector.decode(room.version()) });

function rejection(fn: () => unknown): RoomReject {
  try {
    fn();
  } catch (e) {
    if (e instanceof RoomReject) return e;
    throw e;
  }
  throw new Error("expected a RoomReject");
}

describe("create", () => {
  test("imports the owner's snapshot and takes over key allocation", () => {
    const room = share();
    const doc = docOf(room);
    expect(getKeyAllocator(doc)).toBe("server");
    expect(readMembers(doc)).toEqual([{ userId: adam.userId, name: "Adam" }]);
    expect(listTickets(doc).map((t) => t.key)).toEqual(["KIB-1", "KIB-2"]);
    const project = sdb.db.query("SELECT ownerId, ticketSeq FROM projects WHERE id = ?1").get("p1");
    expect(project).toEqual({ ownerId: adam.userId, ticketSeq: 2 });
    const member = sdb.db
      .query("SELECT role FROM members WHERE projectId = ?1 AND userId = ?2")
      .get("p1", adam.userId);
    expect(member).toEqual({ role: "owner" });
    expect(room.serverSeq()).toBe(0);
  });

  test("refuses a snapshot with a ticket that has no key", () => {
    const doc = new LoroDoc();
    doc.import(ownerSnapshot());
    doc.getMap("meta").set("keyAllocator", "server");
    doc.commit();
    createTicket(doc, { title: "Sans clé" });
    expect(() =>
      ProjectRoom.create(
        sdb,
        {
          projectId: "p2",
          name: "X",
          ownerId: adam.userId,
          ownerName: "Adam",
          snapshot: doc.export({ mode: "snapshot" }),
        },
        NOW,
      ),
    ).toThrow("INVALID_INPUT");
  });

  test("refuses a snapshot larger than a frame", () => {
    expect(() =>
      ProjectRoom.create(
        sdb,
        {
          projectId: "p3",
          name: "X",
          ownerId: adam.userId,
          ownerName: "Adam",
          snapshot: new Uint8Array(MAX_FRAME_BYTES + 1),
        },
        NOW,
      ),
    ).toThrow("INVALID_INPUT");
  });
});

describe("push", () => {
  test("a viewer is refused", () => {
    const room = share();
    const client = clientOf(room);
    createTicket(client, { title: "Lecture seule" });
    expect(rejection(() => room.push(changesSince(client, room), actor(lea, "viewer"), NOW)).code).toBe(
      "FORBIDDEN",
    );
  });

  test("an editor writing a key is refused and audited", () => {
    const room = share();
    const before = room.version();
    const client = clientOf(room);
    const [first] = client.getTree("tickets").roots();
    first?.data.set("key", "KIB-42");
    client.commit();
    const reject = rejection(() => room.push(changesSince(client, room), actor(lea, "editor"), NOW));
    expect(reject.code).toBe("UPDATE_REJECTED");
    expect(reject.version).toEqual(before);
    expect(room.version()).toEqual(before);
    const row = sdb.db
      .query("SELECT kind, userId, projectId FROM audit WHERE kind = 'update-rejected'")
      .get();
    expect(row).toEqual({ kind: "update-rejected", userId: lea.userId, projectId: "p1" });
  });

  test("a valid batch gets its keys, in order, with a growing sequence", () => {
    const room = share();
    const client = clientOf(room);
    const a = createTicket(client, { title: "A" });
    const b = createTicket(client, { title: "B" });
    const first = room.push(changesSince(client, room), actor(adam, "owner"), NOW);
    expect(first.allocated).toEqual([
      { ticketId: a.id, key: "KIB-3" },
      { ticketId: b.id, key: "KIB-4" },
    ]);
    expect(first.serverSeq).toBe(1);
    expect(first.bytes).not.toBeNull();
    client.import(first.bytes ?? new Uint8Array());
    expect(listTickets(client).map((t) => t.key)).toEqual(["KIB-1", "KIB-2", "KIB-3", "KIB-4"]);
    const c = createTicket(client, { title: "C" });
    const second = room.push(changesSince(client, room), actor(adam, "owner"), NOW);
    expect(second.allocated).toEqual([{ ticketId: c.id, key: "KIB-5" }]);
    expect(second.serverSeq).toBe(2);
  });

  test("the same batch pushed twice changes nothing the second time", () => {
    const room = share();
    const client = clientOf(room);
    createTicket(client, { title: "A" });
    const batch = changesSince(client, room);
    const first = room.push(batch, actor(adam, "owner"), NOW);
    const again = room.push(batch, actor(adam, "owner"), NOW);
    expect(again).toEqual({ bytes: null, serverSeq: first.serverSeq, version: first.version, allocated: [] });
    const keys = listTickets(docOf(room)).map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    const count = sdb.db.query("SELECT COUNT(*) AS n FROM updates WHERE projectId = ?1").get("p1");
    expect(count).toEqual({ n: 1 });
  });

  test("a batch with missing dependencies is out of date", () => {
    const room = share();
    const client = clientOf(room);
    const t = createTicket(client, { title: "A" });
    const afterFirst = client.oplogVersion();
    updateTicket(client, t.id, { title: "A bis" });
    const onlySecond = client.export({ mode: "update", from: afterFirst });
    const reject = rejection(() => room.push(onlySecond, actor(adam, "owner"), NOW));
    expect(reject.code).toBe("OUT_OF_DATE");
    expect(reject.version).toEqual(room.version());
  });

  test("a pending batch never reaches the room, even once its gap is filled", () => {
    const room = share();
    const client = clientOf(room);
    const [first] = listTickets(client);
    const start = client.oplogVersion();
    updateTicket(client, first?.id ?? "", { title: "Comble le trou" });
    const gap = client.export({ mode: "update", from: start });
    const afterGap = client.oplogVersion();
    client.getMap("meta").set("ticketSeq", 999);
    client.commit();
    const forged = client.export({ mode: "update", from: afterGap });
    expect(rejection(() => room.push(forged, actor(lea, "editor"), NOW)).code).toBe("OUT_OF_DATE");
    const filled = room.push(gap, actor(lea, "editor"), NOW);
    expect(filled.serverSeq).toBe(1);
    expect(docOf(room).getMap("meta").get("ticketSeq")).toBe(2);
    expect(sdb.db.query("SELECT ticketSeq FROM projects WHERE id = ?1").get("p1")).toEqual({ ticketSeq: 2 });
    expect(rejection(() => room.push(forged, actor(lea, "editor"), NOW)).code).toBe("UPDATE_REJECTED");
    const next = clientOf(room);
    createTicket(next, { title: "Suivant" });
    expect(
      room.push(changesSince(next, room), actor(adam, "owner"), NOW).allocated.map((a) => a.key),
    ).toEqual(["KIB-3"]);
  });

  test("a batch larger than a frame is rejected before any import", () => {
    const room = share();
    const before = room.version();
    const reject = rejection(() => room.push(new Uint8Array(MAX_FRAME_BYTES + 1), actor(adam, "owner"), NOW));
    expect(reject.code).toBe("UPDATE_REJECTED");
    expect(room.version()).toEqual(before);
  });

  test("a rejected batch leaves the room and the other peers untouched", () => {
    const room = share();
    const forger = clientOf(room);
    const [first] = forger.getTree("tickets").roots();
    first?.data.set("key", "KIB-42");
    forger.commit();
    rejection(() => room.push(changesSince(forger, room), actor(lea, "editor"), NOW));
    const peer = clientOf(room);
    createTicket(peer, { title: "Honnête" });
    const pushed = room.push(changesSince(peer, room), actor(adam, "owner"), NOW);
    const fresh = new LoroDoc();
    fresh.import(room.diffSince(null));
    const keys = listTickets(fresh).map((t) => t.key);
    expect(keys).toEqual(["KIB-1", "KIB-2", "KIB-3"]);
    expect(pushed.allocated.map((a) => a.key)).toEqual(["KIB-3"]);
  });

  test("an unreadable batch is rejected", () => {
    const room = share();
    const reject = rejection(() => room.push(new Uint8Array([1, 2, 3]), actor(adam, "owner"), NOW));
    expect(reject.code).toBe("UPDATE_REJECTED");
  });

  test("the size quota is enforced", () => {
    const limit = share(undefined, "probe").sizeBytes() + 16;
    const room = share({ projectBytes: limit });
    const client = clientOf(room);
    createTicket(client, { title: "x".repeat(200), description: "y".repeat(500) });
    expect(rejection(() => room.push(changesSince(client, room), actor(adam, "owner"), NOW)).code).toBe(
      "QUOTA_EXCEEDED",
    );
  });
});

describe("history", () => {
  test("compacts every compactEvery updates and reloads identically", () => {
    const room = share({ compactEvery: 3 });
    const client = clientOf(room);
    for (const title of ["A", "B", "C", "D"]) {
      createTicket(client, { title });
      const r = room.push(changesSince(client, room), actor(adam, "owner"), NOW);
      client.import(r.bytes ?? new Uint8Array());
    }
    const snapshots = sdb.db
      .query("SELECT uptoSeq FROM snapshots WHERE projectId = ?1 ORDER BY uptoSeq")
      .all("p1");
    expect(snapshots).toEqual([{ uptoSeq: 0 }, { uptoSeq: 3 }]);
    const reloaded = ProjectRoom.load(sdb, "p1");
    expect(docOf(reloaded).toJSON()).toEqual(docOf(room).toJSON());
    expect(reloaded.serverSeq()).toBe(4);
  });

  test("diffSince(null) rebuilds the whole document", () => {
    const room = share();
    const client = clientOf(room);
    createTicket(client, { title: "A" });
    room.push(changesSince(client, room), actor(adam, "owner"), NOW);
    const rebuilt = new LoroDoc();
    rebuilt.import(room.diffSince(null));
    expect(rebuilt.oplogVersion().encode()).toEqual(room.version());
    expect(listTickets(rebuilt)).toEqual(listTickets(docOf(room)));
    expect(rebuilt.getMap("meta").toJSON()).toEqual(docOf(room).getMap("meta").toJSON());
  });

  test("syncMembers writes the directory once", async () => {
    const room = share();
    await addMember(sdb, { projectId: "p1", user: lea, role: "editor", owner: adam }, NOW);
    const result = room.syncMembers(NOW);
    expect(result?.bytes).not.toBeNull();
    expect(
      readMembers(docOf(room))
        .map((m) => m.name)
        .sort(),
    ).toEqual(["Adam", "Léa"]);
    expect(room.syncMembers(NOW)).toBeNull();
  });
});

describe("restart", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "kibo-room-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("the key sequence continues after a server restart", async () => {
    const file = join(dir, "sync.db");
    const first = openServerDb(file);
    const owner = await seedUser(first, "Adam", NOW);
    const room = ProjectRoom.create(
      first,
      { projectId: "p1", name: "Kibo", ownerId: owner.userId, ownerName: "Adam", snapshot: ownerSnapshot() },
      NOW,
    );
    const client = clientOf(room);
    createTicket(client, { title: "Avant" });
    const pushed = room.push(changesSince(client, room), actor(owner, "owner"), NOW);
    client.import(pushed.bytes ?? new Uint8Array());
    first.close();
    const second = openServerDb(file);
    const reloaded = ProjectRoom.load(second, "p1");
    expect(reloaded.serverSeq()).toBe(1);
    createTicket(client, { title: "Après" });
    const after = reloaded.push(
      client.export({ mode: "update", from: VersionVector.decode(reloaded.version()) }),
      actor(owner, "owner"),
      NOW,
    );
    expect(after.allocated.map((a) => a.key)).toEqual(["KIB-4"]);
    expect(after.serverSeq).toBe(2);
    expect(second.db.query("SELECT ticketSeq FROM projects WHERE id = ?1").get("p1")).toEqual({
      ticketSeq: 4,
    });
    second.close();
  });
});
