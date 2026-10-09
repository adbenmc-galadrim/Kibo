import { expect, test } from "bun:test";
import fc from "fast-check";
import { LoroDoc } from "loro-crdt";
import {
  allocateTicketKeys,
  createProjectDoc,
  createTicket,
  deleteTicket,
  enableServerAllocation,
  getProjectMeta,
  isDescendant,
  listTickets,
  migrateForSharing,
  moveTicket,
  type UpdateAuthor,
  updateTicket,
  validateProjectUpdate,
} from "./index";

const OWNER: UpdateAuthor = { userId: "u-adam", role: "owner" };

type Step =
  | { kind: "create"; replica: number; parent: number | null }
  | { kind: "delete"; replica: number; pick: number }
  | { kind: "move"; replica: number; pick: number; parent: number | null }
  | { kind: "rename"; replica: number; pick: number }
  | { kind: "push"; replica: number }
  | { kind: "pull"; replica: number };

const meta = {
  id: "p1",
  key: "KIB",
  name: "Kibo",
  folder: "/Users/adam/kibo",
  color: "#F97316",
  worktree: null,
  storybook: null,
};

const replicaIndex = fc.nat({ max: 4 });
const pick = fc.nat({ max: 20 });
const step: fc.Arbitrary<Step> = fc.oneof(
  fc.record({ kind: fc.constant("create" as const), replica: replicaIndex, parent: fc.option(pick) }),
  fc.record({ kind: fc.constant("delete" as const), replica: replicaIndex, pick }),
  fc.record({ kind: fc.constant("move" as const), replica: replicaIndex, pick, parent: fc.option(pick) }),
  fc.record({ kind: fc.constant("rename" as const), replica: replicaIndex, pick }),
  fc.record({ kind: fc.constant("push" as const), replica: replicaIndex }),
  fc.record({ kind: fc.constant("pull" as const), replica: replicaIndex }),
);

function sharedServer(): LoroDoc {
  const doc = createProjectDoc(meta);
  createTicket(doc, { title: "Existant" });
  migrateForSharing(doc, { localUser: "adam", userId: "u-adam", domains: [] });
  enableServerAllocation(doc);
  return doc;
}

function replicaOf(server: LoroDoc, peer: number): LoroDoc {
  const copy = new LoroDoc();
  copy.setPeerId(peer);
  copy.import(server.export({ mode: "update" }));
  return copy;
}

function push(server: LoroDoc, client: LoroDoc): void {
  const bytes = client.export({ mode: "update", from: server.oplogVersion() });
  const after = server.fork();
  after.import(bytes);
  expect(validateProjectUpdate(server, after, OWNER)).toEqual({ ok: true });
  server.import(bytes);
  allocateTicketKeys(server);
}

function pull(server: LoroDoc, client: LoroDoc): void {
  client.import(server.export({ mode: "update", from: client.oplogVersion() }));
}

function nth<T>(items: T[], index: number | null): T | undefined {
  return index === null || items.length === 0 ? undefined : items[index % items.length];
}

function play(server: LoroDoc, client: LoroDoc, s: Step): void {
  const ids = listTickets(client).map((t) => t.id);
  const tree = client.getTree("tickets");
  if (s.kind === "create") createTicket(client, { title: "T", parentId: nth(ids, s.parent) ?? null });
  if (s.kind === "delete") {
    const id = nth(ids, s.pick);
    if (id) deleteTicket(client, id);
  }
  if (s.kind === "move") {
    const id = nth(ids, s.pick);
    const parent = nth(ids, s.parent) ?? null;
    const legal = parent === null || (parent !== id && id !== undefined && !isDescendant(tree, id, parent));
    if (id) moveTicket(client, id, legal ? parent : null);
  }
  if (s.kind === "rename") {
    const id = nth(ids, s.pick);
    if (id) updateTicket(client, id, { title: `T${client.peerIdStr}` });
  }
  if (s.kind === "push") push(server, client);
  if (s.kind === "pull") pull(server, client);
}

function allKeys(doc: LoroDoc): string[] {
  return doc
    .getTree("tickets")
    .getNodes({ withDeleted: true })
    .flatMap((node) => {
      const key = node.data.get("key");
      return typeof key === "string" ? [key] : [];
    });
}

test("server keys stay unique and contiguous across concurrent replicas", () => {
  fc.assert(
    fc.property(fc.integer({ min: 2, max: 5 }), fc.array(step, { maxLength: 40 }), (count, steps) => {
      const server = sharedServer();
      const replicas = Array.from({ length: count }, (_, i) => replicaOf(server, 100 + i));
      for (const s of steps) {
        const client = replicas[s.replica % count];
        if (client) play(server, client, s);
      }
      for (const client of replicas) push(server, client);
      for (const client of replicas) pull(server, client);
      const seq = server.getMap("meta").get("ticketSeq");
      const expected = Array.from({ length: Number(seq) }, (_, i) => `KIB-${i + 1}`);
      expect(allKeys(server).sort()).toEqual(expected.sort());
      expect(listTickets(server).every((t) => t.key !== null)).toBe(true);
      for (const client of replicas) {
        expect(client.oplogVersion().compare(server.oplogVersion())).toBe(0);
        expect(listTickets(client)).toEqual(listTickets(server));
        expect(getProjectMeta(client)).toMatchObject({ id: "p1", key: "KIB", folder: null });
        expect(client.getMap("meta").get("folder")).toBeUndefined();
      }
    }),
    { numRuns: 100 },
  );
});
