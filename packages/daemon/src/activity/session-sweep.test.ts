import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { type ProjectEventInput, SESSION_TIMEOUT_MS } from "@kibo/schema";
import type { SessionTicket } from "./session-events";
import { createSessionStore } from "./session-store";
import { createSessionSweep } from "./session-sweep";

const T0 = 1_760_000_000_000;
const ticket = (id: string, parentId: string | null): SessionTicket => ({
  id,
  key: `EMIS-${id}`,
  keyLabel: `EMIS-${id}`,
  parentId,
  delivery: null,
});
const TICKETS = [ticket("1", null), ticket("2", "1")];

function setup() {
  const store = createSessionStore(new Database(":memory:", { strict: true }));
  const clock = { now: T0 };
  const events: { projectId: string; event: ProjectEventInput }[] = [];
  const emitted: string[] = [];
  const errors: string[] = [];
  const sweep = createSessionSweep({
    store,
    tickets: (projectId) => {
      if (projectId === "gone") throw new Error("project gone");
      return TICKETS;
    },
    now: () => clock.now,
    sink: { record: (projectId, event) => events.push({ projectId, event }) },
    emit: (projectId) => emitted.push(projectId),
    log: (what) => () => errors.push(what),
  });
  return { store, clock, events, emitted, errors, sweep };
}

test("each pass closes the sessions silent for two hours and journals them", () => {
  const { store, clock, events, emitted, sweep } = setup();
  store.start("p", "2", "T3 Code", T0);
  store.ping("p", "2", T0 + 20 * 60_000);
  clock.now = T0 + 20 * 60_000 + SESSION_TIMEOUT_MS - 1;
  sweep.pass();
  expect(events).toEqual([]);
  clock.now += 1;
  sweep.pass();
  expect(events).toEqual([
    {
      projectId: "p",
      event: {
        kind: "session_stopped",
        ticketId: "2",
        featureId: "1",
        source: "full-delivery",
        data: { ticketKey: "EMIS-2", tool: "T3 Code", durationMs: 20 * 60_000, ended: "timeout" },
      },
    },
  ]);
  expect(emitted).toEqual(["p"]);
  sweep.pass();
  expect(events).toHaveLength(1);
  expect(emitted).toEqual(["p"]);
});

test("a session of a vanished project or ticket is closed without an event", () => {
  const { store, clock, events, emitted, errors, sweep } = setup();
  store.start("gone", "2", "T3 Code", T0);
  store.start("p", "9", "T3 Code", T0);
  clock.now = T0 + SESSION_TIMEOUT_MS;
  sweep.pass();
  expect(events).toEqual([]);
  expect(errors).toEqual(["journaling the silent session of 2"]);
  expect(emitted.sort()).toEqual(["gone", "p"]);
  expect(store.sweep(clock.now)).toEqual([]);
});
