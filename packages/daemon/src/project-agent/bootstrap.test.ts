import { afterEach, expect, test } from "bun:test";
import { PROJECT_AGENT_PROFILE_ID, type ProjectAgentSummary } from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import { startProjectAgent } from "./bootstrap";
import { type Harness, harness } from "./fakes.test-helper";

const open: Harness[] = [];
afterEach(() => {
  for (const h of open.splice(0)) h.close();
});

function boot() {
  const h = harness();
  open.push(h);
  const attached: string[] = [];
  const project = runView({ id: "p-run", projectId: h.project.id, ticketId: null, state: "running" });
  h.agents.runs.push({ ...project, kind: "project", profileId: PROJECT_AGENT_PROFILE_ID });
  const started = startProjectAgent({
    home: h.dir,
    service: {
      docs: h.service.docs,
      agentData: h.service.agentData,
      deliverAnswers: h.service.deliverAnswers,
      attachProjectAgent(port: { summaries(): ProjectAgentSummary[] }) {
        attached.push(`attach:${port.summaries().length}`);
        return () => attached.push("detach");
      },
    },
    notes: h.notes,
    settings: { get: () => null },
    orchestrator: () => ({ ...h.agents, hooks: { verify: () => true, receive: () => null } }),
    notify: () => {},
    signals: h.signals,
  });
  return { h, started, attached };
}

test("the project agent is wired to the real project data and tools, and detaches on stop", async () => {
  const { h, started, attached } = boot();
  h.ticket("Récepteur de hooks");
  expect(started.agent.view(h.project.id)).toMatchObject({ session: null, batches: [], past: [] });
  const run = started.agent.mcp.run("p-run");
  if (!run) throw new Error("p-run is not known");
  const sheet = await started.agent.mcp.call(run, "get_ticket", { key: "EMIS-1" });
  expect(JSON.parse(sheet)).toMatchObject({ key: "EMIS-1", title: "Récepteur de hooks", statusId: "todo" });
  await expect(started.agent.mcp.call(run, "propose_batch", {})).rejects.toThrow("INVALID_INPUT");
  h.signals.add(1, { projectId: h.project.id, title: "Tests du récepteur" });
  const listed = JSON.parse(await started.agent.mcp.call(run, "list_signals", {}));
  expect(listed).toMatchObject({ items: [{ ref: "sig:1", title: "Tests du récepteur" }], total: 1 });
  expect(started.agent.signals).toBe(h.signals);
  started.stop();
  expect(attached).toEqual(["attach:0", "detach"]);
});
