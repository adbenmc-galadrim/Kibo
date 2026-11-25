import { afterEach, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REMOTE_CALL_KINDS, REMOTE_METHODS } from "@kibo/remote";
import { EMPTY_DELIVERY, KiboError, RpcRequest } from "@kibo/schema";
import { z } from "zod";
import { answerPhone } from "./phone-view";
import { cleanLaunched, type LaunchedDaemon, launchDaemon, seedSilo } from "./remote.test-helper";

afterEach(cleanLaunched);

const Created = z.object({ id: z.string() });

const ABSOLUTE_PATH = /(^|[\s"'=:(])(\/(Users|home|private|var|tmp|opt|Volumes)\/|~\/)/;

const SIDE_EFFECTS_FAKED_IN_PHONE_VIEW_TEST = new Set<string>([
  "sendProjectAgentMessage",
  "decideBatch",
  "t3.launch",
  "getCiLog",
]);
const CALLS_FAKED_IN_PHONE_VIEW_TEST = new Set<string>(["run", "config.set", "t3.launch"]);

type Seeded = { projectId: string; ticketId: string; ticketKey: string; instanceId: string };

function relayedRequests({ projectId, ticketId, ticketKey }: Seeded): Record<string, unknown> {
  const onTicket = { projectId, ticketKey };
  return {
    getSession: { method: "getSession" },
    listProjects: { method: "listProjects" },
    getProject: { method: "getProject", projectId },
    command: {
      method: "command",
      projectId,
      command: { method: "createTicket", title: "Export des quotas" },
    },
    fileTicket: { method: "fileTicket", projectId, ticketId },
    listProjectEvents: { method: "listProjectEvents", projectId },
    listCiRuns: { method: "listCiRuns", projectId, ticketId: null },
    getProjectAgent: { method: "getProjectAgent", projectId },
    getRunLog: { method: "getRunLog", runId: "run-unknown" },
    "t3.status": { method: "t3.status" },
    "t3.preview": { method: "t3.preview", ...onTicket },
    "t3.threadOf": { method: "t3.threadOf", ...onTicket },
    "t3.refresh": { method: "t3.refresh", projectId },
  };
}

function relayedCalls({ ticketKey }: Seeded): Record<string, unknown> {
  return {
    list: { kind: "list", entity: "ticket" },
    "settings.get": { kind: "settings.get" },
    "project.get": { kind: "project.get" },
    "questions.recipients": { kind: "questions.recipients" },
    "t3.status": { kind: "t3.status" },
    "t3.preview": { kind: "t3.preview", ticketKey },
    "t3.threadOf": { kind: "t3.threadOf", ticketKey },
  };
}

const askMac =
  (launched: LaunchedDaemon) =>
  async (req: RpcRequest): Promise<unknown> => {
    const answer = await launched.call(req);
    if (!answer.ok) throw new KiboError("INTERNAL", JSON.stringify(answer.error));
    return answer.result;
  };

async function seedWithPaths(launched: LaunchedDaemon) {
  const silo = await seedSilo(launched);
  await launched.rpc({
    method: "updateProject",
    projectId: silo.projectId,
    patch: {
      worktree: {
        baseRef: "main",
        pathTemplate: join(silo.folder, "worktrees/{slug}"),
        setup: null,
        recipe: null,
      },
      delivery: { ...EMPTY_DELIVERY, root: silo.folder, memory: join(silo.folder, "memory.md") },
    },
  });
  const command = (cmd: unknown) =>
    launched.rpc(RpcRequest.parse({ method: "command", projectId: silo.projectId, command: cmd }));
  const page = Created.parse(await command({ method: "addPage", title: "Kanban", kind: "view" }));
  const instance = Created.parse(
    await command({ method: "addInstance", pageId: page.id, component: "kanban@1.0.0" }),
  );
  const { tickets } = await launched.rpc({ method: "getProject", projectId: silo.projectId });
  const ticket = tickets.find((t) => t.key !== null);
  if (!ticket?.key) throw new Error("no seeded ticket");
  const seeded = {
    projectId: silo.projectId,
    ticketId: ticket.id,
    ticketKey: ticket.key,
    instanceId: instance.id,
  };
  return { silo, seeded };
}

test("every method of the closed list is relayed by this test or by the faked one", () => {
  const seeded = { projectId: "p", ticketId: "t", ticketKey: "SILO-1", instanceId: "i" };
  const covered = [
    ...Object.keys(relayedRequests(seeded)),
    "componentCall",
    ...SIDE_EFFECTS_FAKED_IN_PHONE_VIEW_TEST,
  ];
  expect(covered.sort()).toEqual([...REMOTE_METHODS].sort());
  const calls = [...Object.keys(relayedCalls(seeded)), ...CALLS_FAKED_IN_PHONE_VIEW_TEST];
  expect(calls.sort()).toEqual([...REMOTE_CALL_KINDS].sort());
});

test("no answer of a seeded Mac reaches the phone with a local path, answers and refusals alike", async () => {
  const launched = await launchDaemon();
  const { silo, seeded } = await seedWithPaths(launched);
  const ask = askMac(launched);
  const requests = [
    ...Object.values(relayedRequests(seeded)),
    ...Object.values(relayedCalls(seeded)).map((call) => ({
      method: "componentCall",
      projectId: seeded.projectId,
      instanceId: seeded.instanceId,
      call,
    })),
  ].map((req) => RpcRequest.parse(req));
  const local = [launched.home, silo.folder, tmpdir()];
  const refused: string[] = [];
  for (const req of requests) {
    const text = await answerPhone(req, ask).then(
      (answer) => JSON.stringify(answer) ?? "",
      (e: unknown) => {
        refused.push(req.method);
        return String(e);
      },
    );
    const leaks = ABSOLUTE_PATH.test(text) || local.some((path) => text.includes(path));
    expect({ req, text, leaks }).toMatchObject({ leaks: false });
  }
  expect(refused).toEqual(["fileTicket", "getRunLog"]);
}, 30_000);
