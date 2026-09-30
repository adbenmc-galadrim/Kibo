import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { type ClientFrame, KiboError, type MemberInfo, type ServerFrame } from "@kibo/schema";
import { fromBase64, toBase64 } from "@kibo/trust";
import { EphemeralStore, type Value } from "loro-crdt";
import { type PresenceDeps, PresenceHub, routePresenceFrames } from "./presence";
import { PRESENCE_LIMITS } from "./presence-guard";

const ME = { userId: "u-me", name: "Moi", deviceId: "dev-me" };
const MEMBERS: MemberInfo[] = [
  { userId: "u-me", name: "Moi", role: "owner" },
  { userId: "u-lea", name: "Léa", role: "editor" },
];

let sent: ClientFrame[];
let logs: string[];
let hub: PresenceHub;

type Extra = { pageId?: string; runs?: Value[] };
const state = (userId: string, name: string, extra: Extra = {}): Value => ({
  userId,
  name,
  pageId: null,
  ticketId: null,
  runs: [],
  ...extra,
});

function encode(states: Record<string, Value>): Uint8Array {
  const store = new EphemeralStore(30_000);
  for (const [key, value] of Object.entries(states)) store.set(key, value);
  const bytes = store.encodeAll();
  store.destroy();
  return bytes;
}

function codeOf(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof KiboError ? e.code : "not-kibo";
  }
}

const T0 = Date.UTC(2026, 8, 30, 12);

const deps = (): PresenceDeps => ({
  send: (frame) => sent.push(frame),
  identity: () => ME,
  runs: () => [],
  members: () => MEMBERS,
  shared: (projectId) => projectId === "p1",
  online: () => true,
  emit: () => {},
  log: (message) => logs.push(message),
  timeoutMs: 30_000,
});

beforeEach(() => {
  sent = [];
  logs = [];
  hub = new PresenceHub(deps());
});

afterEach(() => {
  hub.dispose();
  setSystemTime();
});

test("a state from someone who is not a member is not shown", () => {
  hub.receive("p1", encode({ "dev-lea": state("u-lea", "Léa"), "dev-x": state("u-stranger", "X") }));
  expect(hub.peers("p1").map((p) => p.deviceId)).toEqual(["dev-lea"]);
});

test("the displayed name is the member's name, not the one claimed", () => {
  hub.receive("p1", encode({ "dev-lea": state("u-lea", "Adam") }));
  expect(hub.peers("p1")[0]?.name).toBe("Léa");
});

test("an oversized text is refused and only that entry is dropped", () => {
  const long = "x".repeat(PRESENCE_LIMITS.textLength + 1);
  const bytes = encode({
    "dev-lea": state("u-lea", "Léa"),
    "dev-me2": state("u-me", "Moi", { pageId: long }),
  });
  expect(codeOf(() => hub.receive("p1", bytes))).toBe("INVALID_INPUT");
  expect(hub.peers("p1").map((p) => p.deviceId)).toEqual(["dev-lea"]);
});

test("too many runs are refused", () => {
  const run = { ticketKey: "KIB-1", profile: "opus-dev-1", state: "running" };
  const runs = Array.from({ length: 51 }, () => run);
  expect(codeOf(() => hub.receive("p1", encode({ "dev-lea": state("u-lea", "Léa", { runs }) })))).toBe(
    "INVALID_INPUT",
  );
  expect(hub.peers("p1")).toEqual([]);
});

test("a frame with too many devices is refused whole", () => {
  const states: Record<string, Value> = {};
  for (let i = 0; i <= PRESENCE_LIMITS.peers; i++) states[`dev-${i}`] = state("u-lea", "Léa");
  expect(codeOf(() => hub.receive("p1", encode(states)))).toBe("TOO_LARGE");
  expect(hub.peers("p1")).toEqual([]);
});

test("the total number of devices kept per project is bounded", () => {
  for (let i = 0; i < PRESENCE_LIMITS.peers; i++)
    hub.receive("p1", encode({ [`dev-${i}`]: state("u-lea", "Léa") }));
  expect(codeOf(() => hub.receive("p1", encode({ "dev-extra": state("u-lea", "Léa") })))).toBe("TOO_LARGE");
  expect(hub.peers("p1")).toHaveLength(PRESENCE_LIMITS.peers);
});

test("an oversized frame is refused before decoding", () => {
  expect(codeOf(() => hub.receive("p1", new Uint8Array(PRESENCE_LIMITS.frameBytes + 1)))).toBe("TOO_LARGE");
});

test("undecodable bytes are refused", () => {
  expect(codeOf(() => hub.receive("p1", new Uint8Array([1, 2, 3, 4, 5])))).toBe("INVALID_INPUT");
});

test("presence for a project that is not shared is refused", () => {
  expect(codeOf(() => hub.receive("p2", encode({ "dev-lea": state("u-lea", "Léa") })))).toBe("NOT_FOUND");
  expect(hub.peers("p2")).toEqual([]);
});

test("a received state cannot replace this device's own state", () => {
  hub.set("p1", { pageId: "pg1", ticketId: null });
  hub.receive("p1", encode({ "dev-me": state("u-me", "Moi", { pageId: "elsewhere" }) }));
  const self = hub.peers("p1").find((p) => p.self);
  expect(self?.pageId).toBe("pg1");
});

test("the own state is published only for the local device key", () => {
  hub.set("p1", { pageId: "pg1", ticketId: null });
  const frame = sent[0];
  if (frame?.type !== "presence") throw new Error("no presence frame");
  const store = new EphemeralStore(30_000);
  store.apply(fromBase64(frame.bytes));
  expect(store.keys()).toEqual(["dev-me"]);
  store.destroy();
});

function receivedOwnState(): Value | undefined {
  const receiver = new EphemeralStore(30_000);
  for (const frame of sent) if (frame.type === "presence") receiver.apply(fromBase64(frame.bytes));
  const own = receiver.get("dev-me");
  receiver.destroy();
  return own;
}

async function framesSent(count: number): Promise<void> {
  while (sent.length < count) await Bun.sleep(1);
}

test("two changes in the same millisecond both reach the peers", async () => {
  setSystemTime(new Date(T0));
  hub.set("p1", { pageId: "pg1", ticketId: null });
  hub.set("p1", { pageId: "pg2", ticketId: null });
  expect(sent).toHaveLength(1);
  setSystemTime(new Date(T0 + 1));
  await framesSent(2);
  expect(receivedOwnState()).toMatchObject({ pageId: "pg2" });
});

test("a change right after a publish that crossed a millisecond still reaches the peers", async () => {
  setSystemTime(new Date(T0));
  let first = true;
  const slow = new PresenceHub({
    ...deps(),
    runs: () => {
      if (first) setSystemTime(new Date(T0 + 1));
      first = false;
      return [];
    },
  });
  slow.set("p1", { pageId: "pg1", ticketId: null });
  slow.set("p1", { pageId: "pg2", ticketId: null });
  setSystemTime(new Date(T0 + 2));
  await framesSent(2);
  expect(receivedOwnState()).toMatchObject({ pageId: "pg2" });
  slow.dispose();
});

test("a refused frame from the server is logged with its code, never thrown", () => {
  const listeners = new Set<(frame: ServerFrame) => void>();
  const off = routePresenceFrames(
    {
      onFrame: (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    },
    hub,
    (message) => logs.push(message),
  );
  const frame: ServerFrame = {
    type: "presence",
    projectId: "p1",
    bytes: toBase64(new Uint8Array([1, 2, 3])),
  };
  for (const l of listeners) expect(() => l(frame)).not.toThrow();
  expect(logs.some((m) => m.includes("INVALID_INPUT"))).toBe(true);
  off();
  expect(listeners.size).toBe(0);
});
