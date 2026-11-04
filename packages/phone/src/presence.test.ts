import { beforeEach, expect, test } from "bun:test";
import type { PhoneEvent } from "@kibo/remote";
import {
  createPresence,
  type PresenceEnvironment,
  type PresenceSocket,
  type SocketHandlers,
} from "./presence";

class FakeSocket implements PresenceSocket {
  closed = false;
  constructor(
    readonly url: string,
    readonly handlers: SocketHandlers,
  ) {}
  close() {
    this.closed = true;
  }
  open() {
    this.handlers.onOpen();
  }
  receive(event: PhoneEvent) {
    this.handlers.onMessage(JSON.stringify(event));
  }
  drop(code: number) {
    this.handlers.onClose(code);
  }
}

let sockets: FakeSocket[];
let timers: { ms: number; run(): void }[];
let env: PresenceEnvironment & { fire(name: string): void; online: boolean; visible: boolean };
let events: PhoneEvent[];
let revoked: number;
let opened: number;
let resumed: number;
let unopened: number;

const start = () => {
  const presence = createPresence({
    url: "wss://kibo.example/api/phone/events",
    openSocket: (url, handlers) => {
      const socket = new FakeSocket(url, handlers);
      sockets.push(socket);
      return socket;
    },
    env,
    onEvent: (e) => events.push(e),
    onOpen: () => opened++,
    onRevoked: () => revoked++,
    onResume: () => resumed++,
    onUnopened: () => unopened++,
  });
  presence.start();
  return presence;
};

beforeEach(() => {
  sockets = [];
  timers = [];
  events = [];
  revoked = 0;
  opened = 0;
  resumed = 0;
  unopened = 0;
  const handlers = new Map<string, () => void>();
  env = {
    online: true,
    visible: true,
    isOnline: () => env.online,
    isVisible: () => env.visible,
    listen: (name, handler) => {
      handlers.set(name, handler);
      return () => handlers.delete(name);
    },
    schedule: (run, ms) => {
      timers.push({ ms, run });
      return () => {};
    },
    fire: (name) => handlers.get(name)?.(),
  };
});

test("mac.presence events set macOnline and every event is forwarded", () => {
  const presence = start();
  expect(presence.get()).toEqual({ macOnline: false, phoneOnline: true, reconnecting: true });
  sockets[0]?.open();
  expect(opened).toBe(1);
  sockets[0]?.receive({ type: "mac.presence", online: true, lastSeenAt: 5 });
  expect(presence.get()).toEqual({ macOnline: true, phoneOnline: true, reconnecting: false });
  sockets[0]?.receive({ type: "snapshot.changed", projectId: "silo", kind: "project", seq: 3 });
  expect(events.map((e) => e.type)).toEqual(["mac.presence", "snapshot.changed"]);
});

test("a closed socket marks the mac offline and reconnects with backoff", () => {
  const presence = start();
  sockets[0]?.receive({ type: "mac.presence", online: true, lastSeenAt: 5 });
  sockets[0]?.drop(1006);
  expect(presence.get().macOnline).toBe(false);
  expect(timers.map((t) => t.ms)).toEqual([1_000]);
  timers[0]?.run();
  sockets[1]?.drop(1006);
  expect(timers.map((t) => t.ms)).toEqual([1_000, 2_000]);
  expect(sockets).toHaveLength(2);
});

test("the phone going offline is reported, and coming back reconnects", () => {
  const presence = start();
  const seen: boolean[] = [];
  presence.subscribe(() => seen.push(presence.get().phoneOnline));
  env.online = false;
  env.fire("offline");
  sockets[0]?.drop(1006);
  expect(presence.get()).toMatchObject({ macOnline: false, phoneOnline: false });
  expect(timers).toEqual([]);
  env.online = true;
  env.fire("online");
  expect(seen.at(-1)).toBe(true);
  expect(sockets).toHaveLength(2);
});

test("coming back to the foreground reconnects at once", () => {
  start();
  env.visible = false;
  sockets[0]?.drop(1006);
  expect(timers).toEqual([]);
  env.visible = true;
  env.fire("visibilitychange");
  expect(sockets).toHaveLength(2);
});

test("a revoked phone is reported without reconnecting", () => {
  start();
  sockets[0]?.drop(4401);
  expect(revoked).toBe(1);
  expect(timers).toEqual([]);
});

test("coming back online or to the foreground asks for a resync", () => {
  start();
  sockets[0]?.open();
  env.fire("visibilitychange");
  env.fire("online");
  expect(resumed).toBe(2);
});

test("a socket closed before it ever opened is reported, an opened one is not", () => {
  start();
  sockets[0]?.drop(1006);
  expect(unopened).toBe(1);
  timers[0]?.run();
  sockets[1]?.open();
  sockets[1]?.drop(1006);
  expect(unopened).toBe(1);
});

test("coming back to the foreground replaces a zombie socket and keeps its late events out", () => {
  const presence = start();
  sockets[0]?.open();
  sockets[0]?.receive({ type: "mac.presence", online: true, lastSeenAt: 5 });
  env.fire("visibilitychange");
  expect(sockets[0]?.closed).toBe(true);
  expect(sockets).toHaveLength(2);
  expect(resumed).toBe(1);
  sockets[0]?.receive({ type: "snapshot.changed", projectId: "silo", kind: "project", seq: 3 });
  sockets[0]?.drop(1006);
  expect(events.map((e) => e.type)).toEqual(["mac.presence"]);
  expect(timers).toEqual([]);
  sockets[1]?.open();
  expect(opened).toBe(2);
  expect(presence.get().macOnline).toBe(true);
});

test("a dropped socket is reconnecting until the server says the mac is offline", () => {
  const presence = start();
  sockets[0]?.open();
  sockets[0]?.receive({ type: "mac.presence", online: true, lastSeenAt: 5 });
  sockets[0]?.drop(1006);
  expect(presence.get()).toEqual({ macOnline: false, phoneOnline: true, reconnecting: true });
  timers[0]?.run();
  sockets[1]?.receive({ type: "mac.presence", online: false, lastSeenAt: 5 });
  expect(presence.get()).toEqual({ macOnline: false, phoneOnline: true, reconnecting: false });
});
