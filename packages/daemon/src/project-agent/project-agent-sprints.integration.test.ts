import { afterEach, expect, test } from "bun:test";
import type { Sprint } from "@kibo/schema";
import {
  decide,
  type Rpc,
  type Seeded,
  seedKibo,
  send,
  snapshotOf,
  startStack,
  stopDaemons,
  turnDone,
  viewOf,
} from "./integration.test-helper";

afterEach(stopDaemons);

const WAKEUP =
  "S42 est terminé : KIB-1 a 1 étape restante (KIB-3). Propose un report ou un retrait du planning.";

async function seedSprints(rpc: Rpc, seeded: Seeded) {
  const { project, receiver, docs } = seeded;
  const command = <T>(cmd: Record<string, unknown>) =>
    rpc<T>({ method: "command", projectId: project.id, command: cmd });
  const sprint = (code: string, start: string, end: string) =>
    command<Sprint>({ method: "createSprint", code, name: `Sprint ${code}`, start, end });
  const s42 = await sprint("S42", "2026-10-12", "2026-10-16");
  const s43 = await sprint("S43", "2026-10-19", "2026-10-23");
  const step = await command<{ id: string }>({ method: "createTicket", title: "Tests", statusId: "todo" });
  await command({ method: "moveTicket", ticketId: step.id, parentId: docs.id });
  await command({ method: "setTicketSprint", ticketId: receiver.id, sprintId: s42.id });
  return { s42, s43 };
}

const sprintOf = async (rpc: Rpc, projectId: string, ticketId: string) =>
  (await snapshotOf(rpc, projectId)).tickets.find((t) => t.id === ticketId)?.sprintId;

test("the end of sprint message yields a pending setSprint that moves nothing until decided", async () => {
  const stack = await startStack();
  const seeded = await seedKibo(stack.rpc);
  const { s42, s43 } = await seedSprints(stack.rpc, seeded);
  const { project, receiver } = seeded;
  const run = await send(stack.rpc, project.id, WAKEUP);
  await turnDone(stack.rpc, run.id, 1);
  const [call] = stack.calls(run.sessionId);
  expect(call?.mcp.map((c) => [c.tool, c.isError])).toEqual([
    ["list_sprints", false],
    ["propose_batch", false],
  ]);
  expect(JSON.parse(call?.mcp[0]?.text ?? "[]").map((s: { code: string }) => s.code)).toEqual(["S42", "S43"]);
  const [batch] = (await viewOf(stack.rpc, project.id)).batches;
  expect(batch).toMatchObject({
    status: "pending",
    expected: [{ actionId: 1, fields: { sprintId: s42.id } }],
  });
  expect(await sprintOf(stack.rpc, project.id, receiver.id)).toBe(s42.id);

  const decided = await decide(stack.rpc, { projectId: project.id, batchId: batch?.id, decision: "apply" });
  expect(decided.results.map((r) => r.outcome)).toEqual(["applied"]);
  expect(await sprintOf(stack.rpc, project.id, receiver.id)).toBe(s43.id);
}, 60_000);

test("invalid sprint actions are refused by the tool, then the corrected batch creates and plans", async () => {
  const stack = await startStack();
  const seeded = await seedKibo(stack.rpc);
  await seedSprints(stack.rpc, seeded);
  const { project, receiver } = seeded;
  const run = await send(stack.rpc, project.id, "Fais un sprint invalide");
  await turnDone(stack.rpc, run.id, 1);
  const [call] = stack.calls(run.sessionId);
  expect(call?.mcp.map((c) => c.isError)).toEqual([true, false]);
  const refusal = call?.mcp[0]?.text ?? "";
  expect(refusal).toContain(
    "#1 setSprint : le sprint d'une étape vient de sa fonctionnalité : pose S43 sur F1",
  );
  expect(refusal).toContain("#2 setSprint : sprint inconnu « S99 »");
  expect(refusal).toContain("#3 createSprint : code de sprint déjà pris « S42 »");
  const [batch] = (await viewOf(stack.rpc, project.id)).batches;
  const decided = await decide(stack.rpc, { projectId: project.id, batchId: batch?.id, decision: "apply" });
  expect(decided.results.map((r) => r.outcome)).toEqual(["applied", "applied"]);
  const snapshot = await snapshotOf(stack.rpc, project.id);
  const s45 = snapshot.sprints.find((s) => s.code === "S45");
  expect(s45).toMatchObject({ name: "Clôture" });
  expect(snapshot.tickets.find((t) => t.id === receiver.id)?.sprintId).toBe(s45?.id ?? "");
}, 60_000);
