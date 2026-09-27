import { afterEach, beforeEach, expect, test } from "bun:test";
import { type ClientFrame, KiboError, type MemberInfo } from "@kibo/schema";
import { EphemeralStore, type Value } from "loro-crdt";
import { PresenceHub } from "./presence";
import { PRESENCE_LIMITS } from "./presence-guard";

const ME = { userId: "u-me", name: "Moi", deviceId: "dev-me" };
const MEMBERS: MemberInfo[] = [
  { userId: "u-me", name: "Moi", role: "owner" },
  { userId: "u-lea", name: "Léa", role: "editor" },
];
const HOUR = 3_600_000;
const realNow = Date.now;

let sent: ClientFrame[];
let shared: Set<string>;

const state = (userId: string, pageId: string | null = null): Value => ({
  userId,
  name: "Léa",
  pageId,
  ticketId: null,
  runs: [],
});

function withClockShift<T>(shiftMs: number, fn: () => T): T {
  Date.now = () => realNow() + shiftMs;
  try {
    return fn();
  } finally {
    Date.now = realNow;
  }
}

function encode(key: string, value: Value, shiftMs = 0): Uint8Array {
  return withClockShift(shiftMs, () => {
    const store = new EphemeralStore(30_000);
    store.set(key, value);
    const bytes = store.encodeAll();
    store.destroy();
    return bytes;
  });
}

function encodeDeletion(key: string): Uint8Array {
  const store = new EphemeralStore(30_000);
  store.set(key, state("u-lea"));
  store.delete(key);
  const bytes = store.encode(key);
  store.destroy();
  return bytes;
}

function hubWith(timeoutMs: number): PresenceHub {
  return new PresenceHub({
    send: (frame) => sent.push(frame),
    identity: () => ME,
    runs: () => [],
    members: () => MEMBERS,
    shared: (projectId) => shared.has(projectId),
    online: () => true,
    emit: () => {},
    log: () => {},
    timeoutMs,
  });
}

function codeOf(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof KiboError ? e.code : "not-kibo";
  }
}

let hub: PresenceHub;

beforeEach(() => {
  sent = [];
  shared = new Set(["p1"]);
  hub = hubWith(30_000);
});
afterEach(() => {
  Date.now = realNow;
  hub.dispose();
});

test("a device key longer than a sync id is refused", () => {
  const key = "k".repeat(PRESENCE_LIMITS.keyLength + 1);
  expect(codeOf(() => hub.receive("p1", encode(key, state("u-lea"))))).toBe("TOO_LARGE");
  expect(hub.peers("p1")).toEqual([]);
});

test("a state stamped in the future expires after the local timeout", async () => {
  hub.dispose();
  hub = hubWith(150);
  hub.receive("p1", encode("dev-lea", state("u-lea"), HOUR));
  expect(hub.peers("p1")).toHaveLength(1);
  await Bun.sleep(400);
  expect(hub.peers("p1")).toEqual([]);
});

test("after a state stamped in the future, later updates and the withdrawal still apply", async () => {
  hub.receive("p1", encode("dev-lea", state("u-lea", "pg1"), HOUR));
  await Bun.sleep(3);
  hub.receive("p1", encode("dev-lea", state("u-lea", "pg2")));
  expect(hub.peers("p1")[0]?.pageId).toBe("pg2");
  await Bun.sleep(3);
  hub.receive("p1", encodeDeletion("dev-lea"));
  expect(hub.peers("p1")).toEqual([]);
});

test("nothing is published once the project is no longer shared", async () => {
  hub.set("p1", { pageId: "pg1", ticketId: null });
  const before = sent.length;
  await Bun.sleep(3);
  shared.delete("p1");
  hub.refreshRuns();
  await Bun.sleep(10);
  expect(sent).toHaveLength(before);
  shared.add("p1");
  expect(hub.peers("p1")).toEqual([]);
});

test("a frame deleting this device's own key does not remove its state", async () => {
  hub.set("p1", { pageId: "pg1", ticketId: null });
  await Bun.sleep(3);
  hub.receive("p1", encodeDeletion("dev-me"));
  expect(hub.peers("p1").find((p) => p.self)?.pageId).toBe("pg1");
});

test("a clock going backwards publishes at once instead of waiting", () => {
  hub.set("p1", { pageId: "pg1", ticketId: null });
  withClockShift(-HOUR, () => hub.set("p1", { pageId: "pg2", ticketId: null }));
  expect(sent).toHaveLength(2);
});
