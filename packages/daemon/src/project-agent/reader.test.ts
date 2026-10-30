import { afterEach, expect, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { call } from "../service";
import { type ProjectAgentBoot, startProjectAgent } from "./bootstrap";
import { type Harness, harness, readOnly } from "./fakes.test-helper";
import { openProjectAgentStore } from "./store";

let h: Harness | null = null;
let boot: ProjectAgentBoot | null = null;
afterEach(() => {
  boot?.stop();
  boot = null;
  h?.close();
  h = null;
});

const untouched = async (): Promise<never> => {
  throw new KiboError("INTERNAL", "the notes of a read-only project must not be touched");
};

function readerAgent(x: Harness): ProjectAgentBoot {
  return startProjectAgent({
    home: x.dir,
    service: x.service,
    notes: {
      handle: untouched,
      info: () => ({ dir: "", displayDir: "", obsidian: false, folderRelative: null }),
    },
    settings: { get: () => null },
    orchestrator: () => ({
      ...x.agents,
      hooks: { verify: () => true, receive: () => null },
      onRunState: () => () => undefined,
    }),
    notify: () => {},
  });
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

test("on a read-only project nobody can see, message, reset nor decide the project agent; nothing is applied", async () => {
  const x = harness();
  h = x;
  const ticket = x.ticket("Récepteur de hooks", "todo");
  const projectId = x.project.id;
  readOnly(x);
  boot = readerAgent(x);
  const store = openProjectAgentStore(x.dir);
  const pending = store.createBatch({
    id: "b1",
    projectId,
    runId: "p-run",
    sessionId: "s1",
    summary: "Lancer SILO-1",
    actions: [{ id: 1, why: "prêt", type: "setStatus", ticket: "SILO-1", statusId: "in_progress" }],
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

  const reopened = openProjectAgentStore(x.dir);
  expect(reopened.batch(pending.id)?.status).toBe("pending");
  reopened.close();
  const snapshot = call(x.service, { method: "getProject", projectId });
  expect(snapshot.tickets.find((t) => t.id === ticket.id)?.statusId).toBe("todo");
  expect(x.agents.cancelled).toEqual([]);
});
