import { expect, test } from "bun:test";
import type { Presence } from "./remote-client";
import { canWrite, presenceWrites, writeBlockOf } from "./write-block";

const at = (macOnline: boolean, phoneOnline: boolean): Presence => ({
  macOnline,
  phoneOnline,
  stale: false,
  lastSnapshotAt: null,
});

test("the write block names the band reason, the phone network first", () => {
  expect(writeBlockOf(at(true, true))).toBeNull();
  expect(writeBlockOf(at(false, true))).toBe("Mac éteint");
  expect(writeBlockOf(at(true, false))).toBe("Hors connexion");
  expect(writeBlockOf(at(false, false))).toBe("Hors connexion");
  expect(canWrite(at(true, true))).toBe(true);
  expect(canWrite(at(false, true))).toBe(false);
});

test("presenceWrites follows the presence of the client", () => {
  let presence = at(true, true);
  const listeners = new Set<(p: Presence) => void>();
  const writes = presenceWrites({
    presence: () => presence,
    onPresence(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
  const seen: (string | null)[] = [];
  const off = writes.subscribe(() => seen.push(writes.blocked()));
  expect(writes.blocked()).toBeNull();
  presence = at(false, true);
  for (const l of listeners) l(presence);
  expect(seen).toEqual(["Mac éteint"]);
  off();
  expect(listeners.size).toBe(0);
});

test("writes stay open while only the event socket reconnects", () => {
  expect(writeBlockOf({ macOnline: false, phoneOnline: true, reconnecting: true })).toBeNull();
  expect(writeBlockOf({ macOnline: false, phoneOnline: false, reconnecting: true })).not.toBeNull();
});
