import { afterAll, beforeAll, expect, test } from "bun:test";
import { currentTicketSeq, executeProjectCommand, listPages, listTickets } from "@kibo/core";
import { KiboError, type KiboErrorCode, type ProjectCommand, type StatusId } from "@kibo/schema";
import { type Actor, openServerDb, ProjectRoom, type ServerDb } from "@kibo/sync-server";
import { ownerSnapshot, type SeededUser, seedUser } from "@kibo/sync-server/testing/fixtures";
import fc from "fast-check";
import { LoroDoc, VersionVector } from "loro-crdt";
import { InMemoryNetwork, type NetClient } from "./testing/in-memory-network";

const NOW = 1_790_000_000_000;
const RUNS = Math.max(200, Number(process.env.KIBO_PROPERTY_RUNS ?? 0));
const SEED = Number(process.env.KIBO_PROPERTY_SEED ?? 20260927);
const INITIAL_KEYS = ["KIB-1", "KIB-2"];
const TOLERATED = new Set<KiboErrorCode>(["TREE_CYCLE", "LINK_CYCLE", "INVALID_INPUT", "NOT_FOUND"]);
const STATUSES: StatusId[] = ["backlog", "todo", "in_progress", "in_review", "blocked", "done"];

type Edit =
  | { kind: "create"; parent: number | null; title: string }
  | { kind: "rename"; ticket: number; title: string }
  | { kind: "status"; ticket: number; status: StatusId }
  | { kind: "move"; ticket: number; parent: number | null }
  | { kind: "delete"; ticket: number }
  | { kind: "page"; title: string }
  | { kind: "movePage"; page: number; parent: number | null }
  | { kind: "link"; from: number; to: number; blocks: boolean };
type Step =
  | { kind: "edit"; client: number; edit: Edit }
  | { kind: "up" | "down" | "timers" | "toggle"; client: number };

const pick = fc.nat(20);
const maybePick = fc.option(fc.nat(20), { nil: null });
const title = fc.constantFrom("Schéma", "Kanban", "Hooks", "Sandbox", "Notes");
const edit: fc.Arbitrary<Edit> = fc.oneof(
  { weight: 3, arbitrary: fc.record({ kind: fc.constant("create" as const), parent: maybePick, title }) },
  fc.record({ kind: fc.constant("rename" as const), ticket: pick, title }),
  fc.record({ kind: fc.constant("status" as const), ticket: pick, status: fc.constantFrom(...STATUSES) }),
  fc.record({ kind: fc.constant("move" as const), ticket: pick, parent: maybePick }),
  fc.record({ kind: fc.constant("delete" as const), ticket: pick }),
  fc.record({ kind: fc.constant("page" as const), title }),
  fc.record({ kind: fc.constant("movePage" as const), page: pick, parent: maybePick }),
  fc.record({ kind: fc.constant("link" as const), from: pick, to: pick, blocks: fc.boolean() }),
);
const step = (clients: number): fc.Arbitrary<Step> => {
  const client = fc.nat(clients - 1);
  return fc.oneof(
    { weight: 4, arbitrary: fc.record({ kind: fc.constant("edit" as const), client, edit }) },
    { weight: 3, arbitrary: fc.record({ kind: fc.constant("up" as const), client }) },
    { weight: 3, arbitrary: fc.record({ kind: fc.constant("down" as const), client }) },
    { weight: 2, arbitrary: fc.record({ kind: fc.constant("timers" as const), client }) },
    { weight: 1, arbitrary: fc.record({ kind: fc.constant("toggle" as const), client }) },
  );
};
const scenario = fc.integer({ min: 2, max: 5 }).chain((clients) =>
  fc.record({
    clients: fc.constant(clients),
    steps: fc.array(step(clients), { maxLength: 120, size: "max" }),
  }),
);

function toCommand(doc: LoroDoc, e: Edit): ProjectCommand | null {
  const tickets = listTickets(doc);
  const pages = listPages(doc);
  const ticket = (i: number) => tickets[i % Math.max(tickets.length, 1)]?.id ?? null;
  const page = (i: number) => pages[i % Math.max(pages.length, 1)]?.id ?? null;
  switch (e.kind) {
    case "create":
      return {
        method: "createTicket",
        title: e.title,
        parentId: e.parent === null ? null : ticket(e.parent),
      };
    case "rename": {
      const id = ticket(e.ticket);
      return id === null ? null : { method: "updateTicket", ticketId: id, title: `${e.title} bis` };
    }
    case "status": {
      const id = ticket(e.ticket);
      if (id === null) return null;
      return e.status === "blocked"
        ? { method: "setStatus", ticketId: id, statusId: e.status, reason: "Attente client" }
        : { method: "setStatus", ticketId: id, statusId: e.status };
    }
    case "move": {
      const id = ticket(e.ticket);
      if (id === null) return null;
      return { method: "moveTicket", ticketId: id, parentId: e.parent === null ? null : ticket(e.parent) };
    }
    case "delete": {
      const id = ticket(e.ticket);
      return id === null ? null : { method: "deleteTicket", ticketId: id };
    }
    case "page":
      return { method: "addPage", title: e.title, kind: "view", parentId: null };
    case "movePage": {
      const id = page(e.page);
      if (id === null) return null;
      return { method: "movePage", pageId: id, parentId: e.parent === null ? null : page(e.parent) };
    }
    case "link": {
      const from = ticket(e.from);
      const to = ticket(e.to);
      if (from === null || to === null) return null;
      return { method: "addLink", from, to, type: e.blocks ? "blocks" : "relates" };
    }
  }
}

function applyEdit(c: NetClient, e: Edit): void {
  const command = toCommand(c.host.doc(), e);
  if (command === null) return;
  try {
    executeProjectCommand(c.host.doc(), command);
  } catch (err) {
    if (err instanceof KiboError && TOLERATED.has(err.code)) return;
    throw err;
  }
  c.sync.localChange();
}

const isEmptyContainer = (value: unknown): boolean =>
  Array.isArray(value)
    ? value.length === 0
    : typeof value === "object" && value !== null && Object.keys(value).length === 0;

function rootState(doc: LoroDoc): Record<string, unknown> {
  const roots: Record<string, unknown> = doc.toJSON();
  return Object.fromEntries(Object.entries(roots).filter(([, value]) => !isEmptyContainer(value)));
}

let sdb: ServerDb;
let owner: SeededUser;
let projects = 0;

beforeAll(async () => {
  sdb = openServerDb(":memory:");
  owner = await seedUser(sdb, "Adam", NOW);
});
afterAll(() => sdb.close());

test("N clients with random edits and partitions converge, with unique and contiguous keys", () => {
  fc.assert(
    fc.property(scenario, ({ clients, steps }) => {
      projects += 1;
      const projectId = `p${projects}`;
      const room = ProjectRoom.create(
        sdb,
        {
          projectId,
          name: "Kibo",
          ownerId: owner.userId,
          ownerName: "Adam",
          snapshot: ownerSnapshot(projectId),
        },
        NOW,
      );
      const actor: Actor = { userId: owner.userId, deviceId: owner.deviceId, role: "editor" };
      const net = new InMemoryNetwork(room, actor, () => NOW);
      for (let i = 0; i < clients; i++) {
        const doc = new LoroDoc();
        doc.import(room.diffSince(null));
        net.connect(net.addClient(doc));
      }
      for (const s of steps) {
        const c = net.clients[s.client];
        if (!c) continue;
        if (s.kind === "edit") applyEdit(c, s.edit);
        else if (s.kind === "up") net.stepUp(c);
        else if (s.kind === "down") net.stepDown(c);
        else if (s.kind === "timers") net.runTimers(c);
        else if (c.connected) net.disconnect(c);
        else net.connect(c);
      }
      for (const c of net.clients) net.connect(c);
      net.drain();

      const server = LoroDoc.fromSnapshot(room.snapshotBytes());
      const serverVersion = VersionVector.decode(room.version());
      const expected = rootState(server);
      for (const c of net.clients) {
        expect(c.rejected).toEqual([]);
        expect(c.host.current().oplogVersion().compare(serverVersion)).toBe(0);
        expect(rootState(c.host.current())).toEqual(expected);
      }
      const live = listTickets(server).map((t) => t.key);
      expect(live.every((k) => k !== null)).toBe(true);
      expect(new Set(live).size).toBe(live.length);
      const ticketSeq = currentTicketSeq(server);
      const ever = [...INITIAL_KEYS, ...net.allocated.map((a) => a.key)];
      expect(ever).toHaveLength(ticketSeq);
      expect(new Set(ever)).toEqual(new Set(Array.from({ length: ticketSeq }, (_, i) => `KIB-${i + 1}`)));
    }),
    { numRuns: RUNS, seed: SEED, includeErrorInReport: true },
  );
}, 300_000);
