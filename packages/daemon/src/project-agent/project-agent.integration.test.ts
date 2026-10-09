import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MEMORY_NOTE_PATH, type NotesInfo } from "@kibo/schema";
import {
  agentsOf,
  decide,
  type Rpc,
  seedKibo,
  send,
  snapshotOf,
  startStack,
  turnDone,
  viewOf,
  waitFor,
} from "./integration.test-helper";

const memoryOf = async (rpc: Rpc, projectId: string): Promise<string> => {
  const info = await rpc<NotesInfo>({ method: "getNotesDir", projectId });
  return readFileSync(join(info.dir, MEMORY_NOTE_PATH), "utf8");
};

test("a project turn reads the project through the real MCP server, its batch is applied as the human, and the next turn reads the digest", async () => {
  const stack = await startStack();
  const { project, receiver, opus } = await seedKibo(stack.rpc);
  const started = await send(stack.rpc, project.id, "Où en est-on ?");
  expect(started).toMatchObject({ kind: "project", ticketTitle: "Agent de projet · Kibo" });
  await turnDone(stack.rpc, started.id, 1);

  const [first] = stack.calls(started.sessionId);
  expect(first?.prompt).toContain("# Projet");
  expect(first?.prompt).toContain("Où en est-on ?");
  expect(first?.mcp.map((c) => [c.tool, c.isError])).toEqual([
    ["project_overview", false],
    ["list_tickets", false],
    ["get_ticket", false],
    ["list_profiles", false],
    ["propose_batch", false],
  ]);
  expect(JSON.parse(first?.mcp[0]?.text ?? "{}")).toMatchObject({ name: "Kibo", key: "KIB" });
  expect(first?.mcp[2]?.text).toContain("Recevoir les hooks de Claude Code.");
  expect(first?.mcp[4]?.text).toBe("Lot 1 enregistré, en attente de validation d'adam.");

  const view = await viewOf(stack.rpc, project.id);
  const [batch] = view.batches;
  expect(view.session).toMatchObject({ runId: started.id, closedAt: null });
  expect(batch).toMatchObject({ seq: 1, status: "pending", summary: "Lancer KIB-1 et noter le plan" });
  expect(batch?.expected).toContainEqual({ actionId: 1, fields: { statusId: "todo" } });
  expect(batch?.actions.find((a) => a.type === "assignAgent")).toMatchObject({ profileId: opus.id });
  expect(stack.notices).toContainEqual({ title: "Lot à valider", body: "Agent de projet · Kibo : lot n° 1" });
  expect((await agentsOf(stack.rpc)).projectAgents).toEqual([
    { projectId: project.id, runId: started.id, state: "done", pendingBatchId: batch?.id ?? "" },
  ]);

  const decided = await decide(stack.rpc, {
    projectId: project.id,
    batchId: batch?.id,
    decision: "apply",
    actionIds: [1, 2, 3, 5],
  });
  expect(decided).toMatchObject({
    status: "partial",
    decidedBy: { kind: "human", ref: "adam" },
    chosen: [1, 2, 3, 5],
  });
  const snapshot = await snapshotOf(stack.rpc, project.id);
  const created = snapshot.tickets.find((t) => t.title === "Tests du récepteur");
  expect(decided.results.map((r) => [r.actionId, r.outcome])).toEqual([
    [1, "applied"],
    [2, "applied"],
    [3, "applied"],
    [4, "skipped"],
    [5, "applied"],
  ]);
  expect(decided.results[2]?.created).toEqual({ ticketId: created?.id ?? "", key: "KIB-3" });
  expect(created).toMatchObject({ key: "KIB-3", parentId: receiver.id });
  expect(snapshot.questions).toEqual([]);
  expect(await memoryOf(stack.rpc, project.id)).toBe("# Mémoire\n- KIB-1 lancé");

  const assigned = await waitFor(async () =>
    (await agentsOf(stack.rpc)).runs.find((r) => r.ticketId === receiver.id && r.state === "done"),
  );
  expect(assigned).toMatchObject({ kind: "ticket", profileId: opus.id, projectId: project.id });
  expect((await snapshotOf(stack.rpc, project.id)).tickets.find((t) => t.id === receiver.id)).toMatchObject({
    assignee: { kind: "agent", ref: "opus" },
  });

  await send(stack.rpc, project.id, "Et maintenant ?");
  await turnDone(stack.rpc, started.id, 2);
  const second = stack.calls(started.sessionId)[1];
  expect(second?.argv).toContain("--resume");
  expect(second?.prompt).toContain("## Depuis ton dernier tour");
  expect(second?.prompt).toContain("Dernier lot : n° 1 — appliqué 4, périmé 0, échec 0, ignoré 1");
  expect(second?.prompt).toContain("KIB-1");
  expect(second?.prompt).toContain("Et maintenant ?");
  const changes = second?.mcp[0];
  expect(changes).toMatchObject({ tool: "project_changes", isError: false });
  expect(second?.prompt.split("\n\n# Message")[0]).toBe(changes?.text.trim());
}, 90_000);

test("an invalid batch is refused by the tool and corrected in the same turn; a stale action keeps the human edit", async () => {
  const stack = await startStack();
  const { project, receiver } = await seedKibo(stack.rpc);
  const run = await send(stack.rpc, project.id, "Fais un lot invalide");
  await turnDone(stack.rpc, run.id, 1);
  const [call] = stack.calls(run.sessionId);
  expect(call?.mcp.map((c) => c.isError)).toEqual([true, false]);
  expect(call?.mcp[0]?.text).toContain("#1 updateTicket : ticket inconnu « KIB-999 »");
  const view = await viewOf(stack.rpc, project.id);
  expect(view.batches.map((b) => [b.seq, b.status])).toEqual([[1, "pending"]]);

  await stack.rpc({
    method: "command",
    projectId: project.id,
    command: { method: "updateTicket", ticketId: receiver.id, title: "Récepteur, version d'Adam" },
  });
  const decided = await decide(stack.rpc, {
    projectId: project.id,
    batchId: view.batches[0]?.id,
    decision: "apply",
  });
  expect(decided.status).toBe("partial");
  expect(decided.results).toEqual([
    { actionId: 1, outcome: "stale", detail: expect.any(String), created: null },
  ]);
  const ticket = (await snapshotOf(stack.rpc, project.id)).tickets.find((t) => t.id === receiver.id);
  expect(ticket?.title).toBe("Récepteur, version d'Adam");
}, 60_000);
