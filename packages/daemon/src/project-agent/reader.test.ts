import { afterEach, beforeEach, expect, test } from "bun:test";
import { KiboError, type RpcRequest, Ticket } from "@kibo/schema";
import { shareProject } from "../collab/share";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { call } from "../service";
import { type HarnessDaemon, type SyncHarness, startSyncHarness } from "../testing/sync-harness";
import { type ProjectAgentBoot, startProjectAgent } from "./bootstrap";
import { type FakeAgents, fakeAgents } from "./fakes.test-helper";
import { openProjectAgentStore } from "./store";

let h: SyncHarness;
let boot: ProjectAgentBoot | null = null;
const d = (i: number): HarnessDaemon => {
  const x = h.daemons[i];
  if (!x) throw new Error("no daemon");
  return x;
};
beforeEach(async () => {
  h = await startSyncHarness({ daemons: 2 });
  await h.connect(0, "Adam");
  await h.connect(1, "Léa");
});
afterEach(async () => {
  boot?.stop();
  boot = null;
  await h.stop();
});

const untouched = async (): Promise<never> => {
  throw new KiboError("INTERNAL", "the notes of a read-only project must not be touched");
};

function readerAgent(agents: FakeAgents): ProjectAgentBoot {
  const reader = d(1);
  return startProjectAgent({
    home: reader.home,
    service: reader.service,
    notes: {
      handle: untouched,
      info: () => ({ dir: "", displayDir: "", obsidian: false, folderRelative: null }),
    },
    settings: { get: () => null },
    orchestrator: () => ({ ...agents, hooks: { verify: () => true, receive: () => null } }),
    notify: () => {},
  });
}

async function sharedForReading(): Promise<{ projectId: string; ticket: Ticket }> {
  const owner = d(0).service;
  const meta = call(owner, {
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#14B8A6",
  });
  const ticket = Ticket.parse(
    call(owner, {
      method: "command",
      projectId: meta.id,
      command: { method: "createTicket", title: "Récepteur de hooks", statusId: "todo" },
    }),
  );
  await shareProject(d(0).share, meta.id);
  const projectId = await h.joinRaw(1, await h.inviteRaw(0, meta.id, "viewer"));
  expect(d(1).share.syncInfo(projectId).access).toBe("read-only");
  return { projectId, ticket };
}

const forbidden = async (req: RpcRequest): Promise<string> => {
  if (!boot) throw new Error("no project agent");
  try {
    await boot.agent.rpc.handle(req, LOCAL_CONTEXT);
    return "allowed";
  } catch (e) {
    return e instanceof KiboError ? e.code : String(e);
  }
};

test("a reader of a shared project can neither see, message, reset nor decide the project agent; nothing is applied", async () => {
  const { projectId, ticket } = await sharedForReading();
  const agents = fakeAgents();
  boot = readerAgent(agents);
  const store = openProjectAgentStore(d(1).home);
  const pending = store.createBatch({
    id: "b1",
    projectId,
    runId: "p-run",
    sessionId: "s1",
    summary: "Lancer KIB-1",
    actions: [{ id: 1, why: "prêt", type: "setStatus", ticket: "KIB-1", statusId: "in_progress" }],
    expected: [{ actionId: 1, fields: { statusId: "todo" } }],
    createdAt: 1,
  });
  store.close();

  expect(await forbidden({ method: "getProjectAgent", projectId })).toBe("FORBIDDEN");
  expect(await forbidden({ method: "sendProjectAgentMessage", projectId, text: "Bonjour" })).toBe(
    "FORBIDDEN",
  );
  expect(await forbidden({ method: "resetProjectAgent", projectId })).toBe("FORBIDDEN");
  expect(await forbidden({ method: "decideBatch", projectId, batchId: pending.id, decision: "apply" })).toBe(
    "FORBIDDEN",
  );
  expect(
    await forbidden({
      method: "decideBatch",
      projectId,
      batchId: pending.id,
      decision: "reject",
      comment: "Non",
    }),
  ).toBe("FORBIDDEN");

  const reopened = openProjectAgentStore(d(1).home);
  expect(reopened.batch(pending.id)?.status).toBe("pending");
  reopened.close();
  const snapshot = call(d(1).service, { method: "getProject", projectId });
  expect(snapshot.tickets.find((t) => t.id === ticket.id)?.statusId).toBe("todo");
  expect(agents.assigned).toEqual([]);
  expect(agents.cancelled).toEqual([]);
});
