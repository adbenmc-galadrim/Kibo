import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { addInstance, addPage, getInstance, listInstances, setInstanceLayout } from "@kibo/core";
import { type Instance, layoutFor } from "@kibo/schema";
import { LoroDoc, LoroMap, VersionVector } from "loro-crdt";
import { openServerDb, type ServerDb } from "./db";
import { type Actor, ProjectRoom, RoomReject } from "./room";
import { ownerSnapshot, type SeededUser, seedUser } from "./testing/fixtures";

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

const create = (snapshot: Uint8Array): ProjectRoom =>
  ProjectRoom.create(
    sdb,
    { projectId: "p1", name: "Kibo", ownerId: adam.userId, ownerName: "Adam", snapshot },
    NOW,
  );

function clientOf(room: ProjectRoom): LoroDoc {
  const client = new LoroDoc();
  client.import(room.diffSince(null));
  return client;
}

const changesSince = (client: LoroDoc, room: ProjectRoom): Uint8Array =>
  client.export({ mode: "update", from: VersionVector.decode(room.version()) });

const sameVersion = (a: Uint8Array | null, b: Uint8Array): boolean =>
  a !== null && VersionVector.decode(a).compare(VersionVector.decode(b)) === 0;

function rejection(fn: () => unknown): RoomReject {
  try {
    fn();
  } catch (e) {
    if (e instanceof RoomReject) return e;
    throw e;
  }
  throw new Error("expected a RoomReject");
}

function roomWithWidget(): { room: ProjectRoom; pageId: string; widget: Instance } {
  const room = create(ownerSnapshot());
  const client = clientOf(room);
  const page = addPage(client, { title: "Tableau", kind: "dashboard", parentId: null });
  const widget = addInstance(client, {
    pageId: page.id,
    component: "kanban@1.0.0",
    layout: layoutFor("large", 0, 0),
  });
  room.push(changesSince(client, room), actor(adam, "owner"), NOW);
  return { room, pageId: page.id, widget };
}

function forged(room: ProjectRoom, edit: (instances: LoroMap) => void): Uint8Array {
  const client = clientOf(room);
  edit(client.getMap("instances"));
  client.commit();
  return changesSince(client, room);
}

const auditCount = (): unknown =>
  sdb.db.query("SELECT COUNT(*) AS n FROM audit WHERE kind = 'update-rejected'").get();

describe("instances of a shared project", () => {
  test("a push that resizes an instance to 5 × 5 is rejected, audited and changes nothing", () => {
    const { room, widget } = roomWithWidget();
    const before = room.version();
    const bytes = forged(room, (m) => m.set(widget.id, { ...widget, layout: { x: 0, y: 0, w: 5, h: 5 } }));
    const reject = rejection(() => room.push(bytes, actor(lea, "editor"), NOW));
    expect(reject.code).toBe("UPDATE_REJECTED");
    expect(reject.message).toContain(`instance ${widget.id}: layout is not a component format`);
    expect(sameVersion(room.version(), before)).toBe(true);
    expect(getInstance(clientOf(room), widget.id).layout).toEqual(layoutFor("large", 0, 0));
    expect(auditCount()).toEqual({ n: 1 });
  });

  test("a push with a widget outside the grid, a container, a foreign key or no layout is rejected", () => {
    const { room, widget } = roomWithWidget();
    const before = room.version();
    const { layout: _layout, ...withoutLayout } = widget;
    const attempts = [
      forged(room, (m) => m.set(widget.id, { ...widget, layout: { x: 8, y: 0, w: 6, h: 3 } })),
      forged(room, (m) => m.setContainer("i9", new LoroMap())),
      forged(room, (m) => m.set("i9", { ...widget, id: "other" })),
      forged(room, (m) => m.set(widget.id, withoutLayout)),
    ];
    for (const bytes of attempts) {
      expect(rejection(() => room.push(bytes, actor(lea, "editor"), NOW)).code).toBe("UPDATE_REJECTED");
    }
    expect(sameVersion(room.version(), before)).toBe(true);
    expect(auditCount()).toEqual({ n: attempts.length });
  });

  test("a rejected batch applies none of its valid changes", () => {
    const { room, pageId, widget } = roomWithWidget();
    const client = clientOf(room);
    setInstanceLayout(client, widget.id, layoutFor("half", 0, 6));
    addInstance(client, { pageId, component: "tickets@1.0.0", layout: layoutFor("medium", 6, 0) });
    client.getMap("instances").set("i9", { ...widget, id: "i9", layout: { x: 0, y: 20, w: 5, h: 5 } });
    client.commit();
    expect(rejection(() => room.push(changesSince(client, room), actor(lea, "editor"), NOW)).code).toBe(
      "UPDATE_REJECTED",
    );
    const state = clientOf(room);
    expect(listInstances(state).map((i) => i.id)).toEqual([widget.id]);
    expect(getInstance(state, widget.id).layout).toEqual(layoutFor("large", 0, 0));
  });

  test("a push that overlaps two instances is accepted", () => {
    const { room, pageId } = roomWithWidget();
    const mine = clientOf(room);
    const theirs = clientOf(room);
    const a = addInstance(mine, { pageId, component: "notes@1.0.0", layout: layoutFor("large", 6, 0) });
    const b = addInstance(theirs, { pageId, component: "graph@1.0.0", layout: layoutFor("large", 6, 0) });
    room.push(changesSince(mine, room), actor(adam, "owner"), NOW);
    room.push(changesSince(theirs, room), actor(lea, "editor"), NOW);
    const state = clientOf(room);
    expect(getInstance(state, a.id).layout).toEqual(getInstance(state, b.id).layout);
    expect(auditCount()).toEqual({ n: 0 });
  });

  test("a first snapshot with an instance off format is refused", () => {
    const doc = LoroDoc.fromSnapshot(ownerSnapshot());
    const page = addPage(doc, { title: "Tableau", kind: "dashboard", parentId: null });
    const widget = addInstance(doc, { pageId: page.id, component: "kanban@1.0.0" });
    doc.getMap("instances").set(widget.id, { ...widget, layout: { x: 0, y: 0, w: 5, h: 5 } });
    doc.commit();
    expect(() => create(doc.export({ mode: "snapshot" }))).toThrow("INVALID_INPUT");
    expect(sdb.db.query("SELECT COUNT(*) AS n FROM projects").get()).toEqual({ n: 0 });
  });
});
