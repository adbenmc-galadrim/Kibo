import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError, type ProjectCommand, ProjectMeta, type RunView, Ticket } from "@kibo/schema";
import type { CommandMeta } from "../docs";
import { runView } from "../questions/questions.test-helper";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { createService } from "../service";
import { openStore } from "../store";
import { deliveryStepRpc, type StepDocs, setDeliveryStep } from "./step-rpc";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function setup(runs: (projectId: string, ticketId: string) => RunView[] = () => []) {
  const dir = mkdtempSync(join(tmpdir(), "kibo-step-rpc-"));
  dirs.push(dir);
  const service = createService(openStore(dir), { user: "adam" });
  const project = ProjectMeta.parse(
    service.handle({ method: "createProject", name: "Emis", key: "EMIS", folder: null, color: "#336699" }),
  );
  const ticket = Ticket.parse(
    service.handle({
      method: "command",
      projectId: project.id,
      command: { method: "createTicket", title: "Porte qualité" },
    }),
  );
  const events: { command: ProjectCommand; meta: CommandMeta | undefined }[] = [];
  const docs: StepDocs = {
    project: (id) => service.docs.project(id),
    activity: (id) => service.docs.activity(id),
    assertWritable: (id) => service.docs.assertWritable(id),
    run(id, command, meta) {
      events.push({ command, meta });
      return service.docs.run(id, command, meta);
    },
  };
  const deps = { docs, runs: () => runs(project.id, ticket.id), now: () => 1_700 };
  return { service, project, ticket, events, deps };
}

test("writes the step as a Kibo command and returns the ticket view", () => {
  const { project, ticket, events, deps } = setup();
  const view = setDeliveryStep(deps, {
    method: "setDeliveryStep",
    projectId: project.id,
    ticketKey: "EMIS-1",
    step: 7,
    note: "porte qualité",
  });
  expect(view.id).toBe(ticket.id);
  expect(view.delivery).toEqual({ step: 7, note: "porte qualité", at: 1_700, runId: null });
  expect(events.map((e) => [e.command.method, e.meta?.origin])).toEqual([["setTicketDelivery", "kibo"]]);
});

test("ties the step to the ticket's active run of the same project", () => {
  const { project, deps } = setup((projectId, ticketId) => [
    runView({ id: "r-old", projectId, ticketId, state: "done" }),
    runView({ id: "r-other", projectId: "elsewhere", ticketId, state: "running" }),
    runView({ id: "r-live", projectId, ticketId, state: "running" }),
  ]);
  const view = setDeliveryStep(deps, {
    method: "setDeliveryStep",
    projectId: project.id,
    ticketKey: "EMIS-1",
    step: 0,
  });
  expect(view.delivery).toEqual({ step: 0, note: "", at: 1_700, runId: "r-live" });
});

test("refuses an unknown key and a read-only project without writing", () => {
  const { service, project, events, deps } = setup();
  const req = { method: "setDeliveryStep", projectId: project.id, ticketKey: "EMIS-9", step: 3 } as const;
  expect(() => setDeliveryStep(deps, req)).toThrow(new KiboError("NOT_FOUND", "ticket EMIS-9 not found"));
  service.docs.setWriteGuard(() => {
    throw new KiboError("FORBIDDEN", "read-only project");
  });
  expect(() => setDeliveryStep(deps, { ...req, ticketKey: "EMIS-1" })).toThrow("read-only project");
  expect(events).toEqual([]);
});

test("serves the setDeliveryStep method only", async () => {
  const { project, deps } = setup();
  const rpc = deliveryStepRpc(deps);
  expect(rpc.methods).toEqual(["setDeliveryStep"]);
  const view = await rpc.handle(
    { method: "setDeliveryStep", projectId: project.id, ticketKey: "EMIS-1", step: 11, note: "PR #12" },
    LOCAL_CONTEXT,
  );
  expect(view).toMatchObject({ key: "EMIS-1", delivery: { step: 11, note: "PR #12" } });
  await expect(rpc.handle({ method: "listProjects" }, LOCAL_CONTEXT)).rejects.toMatchObject({
    code: "INTERNAL",
  });
});
