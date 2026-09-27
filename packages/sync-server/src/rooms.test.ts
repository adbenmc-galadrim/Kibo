import { afterEach, beforeEach, expect, test } from "bun:test";
import { SYNC_LIMITS } from "@kibo/schema";
import { VersionVector } from "loro-crdt";
import { openServerDb, type ServerDb } from "./db";
import { RoomRegistry } from "./rooms";
import { ownerSnapshot, type SeededUser, seedUser } from "./testing/fixtures";

let sdb: ServerDb;
let adam: SeededUser;
let clock: number;
let rooms: RoomRegistry;

beforeEach(async () => {
  clock = 1_790_000_000_000;
  sdb = openServerDb(":memory:");
  adam = await seedUser(sdb, "Adam", clock);
  rooms = new RoomRegistry(sdb, { now: () => clock, unloadAfterMs: SYNC_LIMITS.unloadAfterMs });
  rooms.create({
    projectId: "p1",
    name: "Kibo",
    ownerId: adam.userId,
    ownerName: "Adam",
    snapshot: ownerSnapshot(),
  });
  rooms.drop("p1");
});
afterEach(() => sdb.close());

test("loads a room lazily and keeps a single instance", () => {
  expect(rooms.loaded()).toEqual([]);
  const room = rooms.get("p1");
  expect(rooms.get("p1")).toBe(room);
  expect(rooms.loaded()).toEqual(["p1"]);
});

test("an unknown project is not found", () => {
  expect(() => rooms.get("nope")).toThrow("NOT_FOUND");
});

test("unloads a room ten minutes after its last client left", () => {
  rooms.attach("p1", "c1");
  clock += SYNC_LIMITS.unloadAfterMs * 2;
  expect(rooms.sweep()).toEqual([]);
  rooms.detach("p1", "c1");
  clock += SYNC_LIMITS.unloadAfterMs - 1;
  expect(rooms.sweep()).toEqual([]);
  clock += 1;
  expect(rooms.sweep()).toEqual(["p1"]);
  expect(rooms.loaded()).toEqual([]);
});

test("a room loaded without client is also unloaded", () => {
  rooms.get("p1");
  clock += SYNC_LIMITS.unloadAfterMs;
  expect(rooms.sweep()).toEqual(["p1"]);
});

test("a reloaded room has the same state", () => {
  const version = rooms.get("p1").version();
  rooms.drop("p1");
  expect(VersionVector.decode(rooms.get("p1").version()).compare(VersionVector.decode(version))).toBe(0);
});
