import { beforeAll, expect, test } from "bun:test";
import type { ProjectSnapshot, RpcRequest, TicketView } from "../packages/schema/src/index";
import { createMemoryDaemon, type MemoryDaemon, memorySeed } from "./fixtures/memory-daemon";
import { SILO_GRAPHE_FEATURE, SILO_GRAPHE_TITLE } from "./fixtures/silo-graphe";
import { SILO_FEATURES, SILO_PROJECT } from "./fixtures/silo-maquettes";
import { seedSiloGraphe } from "./seed-silo-graphe";

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
  await seedSiloGraphe(recorded, memorySeed(daemon));
  snapshot = daemon.snapshot(SILO_PROJECT.key, TODAY);
});

const feature = (shortKey: string): TicketView => {
  const found = snapshot.tickets.find((t) => t.shortKey === shortKey);
  if (found === undefined) throw new Error(`${shortKey} is missing`);
  return found;
};
const seededF1 = () => {
  const found = SILO_FEATURES.find((f) => f.shortKey === SILO_GRAPHE_FEATURE);
  if (found === undefined) throw new Error(`${SILO_GRAPHE_FEATURE} is not in the Silo fixture`);
  return found;
};

test("the scenario renames F1, whose seeded title is another one", () => {
  expect(SILO_GRAPHE_FEATURE).toBe("F1");
  expect(SILO_GRAPHE_TITLE).toBe("Connexion, environnements et hébergement");
  expect(seededF1().title).not.toBe(SILO_GRAPHE_TITLE);
});

test("the three holds come first, then a single rename of F1 as the last write", () => {
  const writes = sent.filter((r) => r.method !== "getProject" && r.method !== "listProjects");
  const holds = writes.filter((r) => r.method === "command" && r.command.method === "setHold");
  const renames = writes.filter((r) => r.method === "command" && r.command.method === "updateTicket");
  expect(holds).toHaveLength(3);
  expect(renames).toHaveLength(1);
  expect(writes.slice(-4)).toEqual([...holds, ...renames]);
  expect(renames[0]).toEqual({
    method: "command",
    projectId: snapshot.meta.id,
    command: { method: "updateTicket", ticketId: feature("F1").id, title: SILO_GRAPHE_TITLE },
  });
});

test("F1 carries the new title and its steps keep theirs", () => {
  const f1 = feature("F1");
  expect(f1.title).toBe(SILO_GRAPHE_TITLE);
  const steps = snapshot.tickets.filter((t) => t.parentId === f1.id).map((t) => t.title);
  expect(steps).toEqual(seededF1().steps.map((s) => s.title));
});

test("the holds of the on-hold scenario stay: F4 delivered with one, F5 with three", () => {
  expect(feature("F4").feature).toMatchObject({ status: "delivered", held: 1 });
  expect(feature("F5").feature?.held).toBe(3);
});

test("a second seed writes nothing", async () => {
  const before = daemon.writes();
  await seedSiloGraphe(daemon.rpc, memorySeed(daemon));
  expect(daemon.writes()).toBe(before);
  expect(daemon.snapshot(SILO_PROJECT.key, TODAY).tickets.find((t) => t.shortKey === "F1")?.title).toBe(
    SILO_GRAPHE_TITLE,
  );
});
