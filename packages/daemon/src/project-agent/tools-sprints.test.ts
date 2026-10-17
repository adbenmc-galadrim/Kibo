import { afterEach, expect, test } from "bun:test";
import { Sprint } from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import { fakeSignals } from "../signals/signals.test-helper";
import { type Harness, harness } from "./fakes.test-helper";
import { handleProjectTool } from "./tools";

const open: Harness[] = [];
afterEach(() => {
  for (const h of open.splice(0)) h.close();
});

async function world() {
  const h = harness();
  open.push(h);
  await h.data.writeNote(h.project.id, "agent-de-projet/memoire.md", "", "create");
  const sprint = (code: string, start: string, end: string) =>
    Sprint.parse(h.command({ method: "createSprint", code, name: `Sprint ${code}`, start, end }));
  const s43 = sprint("S43", "2026-10-19", "2026-10-23");
  const s42 = sprint("S42", "2026-10-12", "2026-10-16");
  const f5 = h.ticket("Rapports");
  for (const [title, statusId] of [
    ["Modèle", "done"],
    ["Export", "todo"],
    ["Envoi", "in_progress"],
  ] as const) {
    const step = h.ticket(title, statusId);
    h.command({ method: "moveTicket", ticketId: step.id, parentId: f5.id });
  }
  h.command({ method: "setTicketSprint", ticketId: f5.id, sprintId: s42.id });
  const run = runView({
    id: "p-run",
    projectId: h.project.id,
    ticketId: null,
    kind: "project",
    state: "running",
  });
  const deps = {
    data: h.data,
    signals: fakeSignals(),
    agents: () => h.agents,
    store: { fingerprint: () => null, lastDecided: () => null },
    propose: () => "",
  };
  const json = async (tool: "list_sprints" | "project_overview") =>
    JSON.parse(await handleProjectTool(deps, run, tool, {}));
  return { h, s42, s43, json };
}

test("list_sprints lists the sprints by start date with their features and what remains", async () => {
  const w = await world();
  const sprints = await w.json("list_sprints");
  expect(sprints.map((s: { code: string }) => s.code)).toEqual(["S42", "S43"]);
  expect(sprints[0]).toMatchObject({
    id: w.s42.id,
    name: "Sprint S42",
    start: "2026-10-12",
    end: "2026-10-16",
    features: [{ shortKey: expect.any(String), title: "Rapports", remaining: 2 }],
  });
  expect(sprints[1]).toMatchObject({ id: w.s43.id, features: [] });
});

test("project_overview carries the same sprints", async () => {
  const w = await world();
  expect((await w.json("project_overview")).sprints).toEqual(await w.json("list_sprints"));
});
