import { beforeAll, expect, test } from "bun:test";
import {
  HOLD_REASON_MAX,
  type ProjectSnapshot,
  type RpcRequest,
  type TicketView,
} from "../packages/schema/src/index";
import { createMemoryDaemon, type MemoryDaemon, memorySeed } from "./fixtures/memory-daemon";
import {
  SILO_HELD_BY_DEPENDENCY,
  SILO_HOLD_SINCE,
  SILO_HOLD_SOURCE,
  SILO_HOLDS,
} from "./fixtures/silo-attente";
import { SILO_FEATURES, SILO_PROJECT, siloKey, siloSteps } from "./fixtures/silo-maquettes";
import { seedSiloAttente } from "./seed-silo-attente";

const TODAY = "2026-10-16";

let daemon: MemoryDaemon;
let sent: RpcRequest[];
let snapshot: ProjectSnapshot;

beforeAll(async () => {
  daemon = createMemoryDaemon("adam", TODAY);
  sent = [];
  const recorded = async (req: RpcRequest) => {
    sent.push(req);
    return daemon.rpc(req);
  };
  await seedSiloAttente(recorded, memorySeed(daemon));
  snapshot = daemon.snapshot(SILO_PROJECT.key, TODAY);
});

const ticket = (n: number): TicketView => {
  const found = snapshot.tickets.find((t) => t.key === siloKey(n));
  if (found === undefined) throw new Error(`${siloKey(n)} is missing`);
  return found;
};
const feature = (shortKey: string): TicketView => {
  const found = snapshot.tickets.find((t) => t.shortKey === shortKey);
  if (found === undefined) throw new Error(`${shortKey} is missing`);
  return found;
};

test("three holds on steps of the features, each reason within the limit", () => {
  expect(SILO_HOLDS.map((h) => h.n)).toEqual([45, 33, 82]);
  const steps = new Set(siloSteps().map((s) => s.n));
  for (const h of SILO_HOLDS) {
    expect(steps.has(h.n)).toBe(true);
    expect(h.reason.length).toBeLessThanOrEqual(HOLD_REASON_MAX);
  }
  expect(SILO_FEATURES.some((f) => f.steps.some((s) => s.n === SILO_HOLD_SOURCE))).toBe(true);
});

test("the three holds are the last commands, sent after the whole Silo seed", () => {
  const writes = sent.filter((r) => r.method !== "getProject" && r.method !== "listProjects");
  const holds = writes.filter((r) => r.method === "command" && r.command.method === "setHold");
  expect(holds).toHaveLength(3);
  expect(writes.slice(-3)).toEqual(holds);
  expect(
    holds.map((r) => (r.method === "command" && r.command.method === "setHold" ? r.command : null)),
  ).toEqual(
    SILO_HOLDS.map((h) => ({
      method: "setHold",
      ticketId: ticket(h.n).id,
      reason: h.reason,
      since: SILO_HOLD_SINCE,
    })),
  );
});

test("each held step is on hold by itself since the frozen day", () => {
  for (const h of SILO_HOLDS)
    expect(ticket(h.n).onHold).toEqual({
      source: "own",
      key: siloKey(h.n),
      reason: h.reason,
      since: SILO_HOLD_SINCE,
    });
});

test("the steps after SILO-33 wait on it through their links", () => {
  for (const n of SILO_HELD_BY_DEPENDENCY)
    expect(ticket(n).onHold).toMatchObject({ source: "dependency", key: siloKey(SILO_HOLD_SOURCE) });
  const held = snapshot.tickets.filter((t) => t.onHold !== null).map((t) => t.key);
  expect(held.sort()).toEqual(["SILO-33", "SILO-34", "SILO-35", "SILO-45", "SILO-82"]);
});

test("F4 is delivered with one step on hold and F5 keeps three", () => {
  expect(feature("F4").feature).toMatchObject({ status: "delivered", held: 1 });
  expect(feature("F5").feature?.held).toBe(3);
  expect(feature("F7").feature?.held).toBe(1);
});

test("holding keeps the statuses of the maquettes", () => {
  expect(ticket(45).statusId).toBe("in_review");
  expect(ticket(33).statusId).toBe("in_progress");
  expect(ticket(82).statusId).toBe("todo");
});

test("a second seed sends no hold again", async () => {
  const before = daemon.writes();
  await seedSiloAttente(daemon.rpc, memorySeed(daemon));
  const again = daemon.snapshot(SILO_PROJECT.key, TODAY);
  expect(again.tickets.filter((t) => t.onHold?.source === "own")).toHaveLength(3);
  expect(daemon.writes()).toBe(before);
});
