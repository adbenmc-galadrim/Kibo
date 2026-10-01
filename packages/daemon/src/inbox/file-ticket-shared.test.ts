import { afterEach, beforeEach, expect, test } from "bun:test";
import { getKeyAllocator, getTicket, listTickets } from "@kibo/core";
import { INBOX_ID, type ProjectMeta, type ProjectSnapshot, type RpcRequest, type Ticket } from "@kibo/schema";
import { shareProject } from "../collab/share";
import { type HarnessDaemon, type SyncHarness, startSyncHarness } from "../testing/sync-harness";

let h: SyncHarness;
const adam = (): HarnessDaemon => {
  const d = h.daemons[0];
  if (!d) throw new Error("no daemon");
  return d;
};
const rpc = (req: RpcRequest) => adam().service.handle(req);

beforeEach(async () => {
  h = await startSyncHarness({ daemons: 1 });
  await h.connect(0, "Adam");
});
afterEach(async () => {
  await h.stop();
});

async function sharedProject(): Promise<string> {
  const meta = rpc({
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#14B8A6",
  }) as ProjectMeta;
  await shareProject(adam().share, meta.id);
  await h.waitUntil(() => getKeyAllocator(adam().hosts.host(meta.id).doc()) === "server");
  return meta.id;
}

const inboxTicket = (title: string) =>
  rpc({ method: "command", projectId: INBOX_ID, command: { method: "createTicket", title } }) as Ticket;

test("a ticket filed into a shared project waits for its key, then gets it from the server", async () => {
  const p = await sharedProject();
  const t = inboxTicket("Appeler le comptable");
  const filed = rpc({ method: "fileTicket", ticketId: t.id, projectId: p }) as {
    ticketId: string;
    key: string | null;
  };
  expect(filed.key).toBeNull();
  const doc = () => adam().hosts.host(p).doc();
  expect(getTicket(doc(), filed.ticketId).pendingSeq).not.toBeNull();
  await h.waitUntil(() => getTicket(doc(), filed.ticketId).key !== null);
  expect(getTicket(doc(), filed.ticketId).key).toMatch(/^KIB-\d+$/);
  expect((rpc({ method: "getProject", projectId: INBOX_ID }) as ProjectSnapshot).tickets).toEqual([]);
  expect(adam().hosts.projectIds()).toEqual([p]);
  expect(
    adam()
      .client.status()
      .projects.map((s) => s.projectId),
  ).toEqual([p]);
});

test("filing into a project being shared is refused and nothing moves", async () => {
  const p = await sharedProject();
  const t = inboxTicket("T");
  adam().hosts.setLocked(p, true);
  expect(() => rpc({ method: "fileTicket", ticketId: t.id, projectId: p })).toThrow("CONFLICT");
  adam().hosts.setLocked(p, false);
  expect(listTickets(adam().hosts.host(p).doc())).toEqual([]);
  expect(
    (rpc({ method: "getProject", projectId: INBOX_ID }) as ProjectSnapshot).tickets.map((x) => x.id),
  ).toEqual([t.id]);
});
