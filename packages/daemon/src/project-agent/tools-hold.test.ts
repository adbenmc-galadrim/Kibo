import { afterEach, expect, test } from "bun:test";
import type { ProjectAgentTool } from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import { type Harness, harness } from "./fakes.test-helper";
import { handleProjectTool } from "./tools";

const open: Harness[] = [];
afterEach(() => {
  for (const h of open.splice(0)) h.close();
});

const REASON = "Serveur MinIO de recette indisponible";

async function world() {
  const h = harness();
  open.push(h);
  await h.data.writeNote(h.project.id, "agent-de-projet/memoire.md", "", "create");
  const f5 = h.ticket("Saisie hors ligne");
  const [send, sync, done] = [
    h.ticket("Écran d'envoi"),
    h.ticket("Synchronisation"),
    h.ticket("Modèle", "done"),
  ];
  for (const step of [send, sync, done])
    h.command({ method: "moveTicket", ticketId: step.id, parentId: f5.id });
  h.command({ method: "addLink", from: send.id, to: sync.id, type: "blocks" });
  h.command({ method: "setHold", ticketId: send.id, reason: REASON });
  const run = runView({
    id: "p-run",
    projectId: h.project.id,
    ticketId: null,
    kind: "project",
    state: "running",
  });
  const deps = {
    data: h.data,
    agents: () => h.agents,
    store: { fingerprint: () => null, lastDecided: () => null },
    propose: () => "",
  };
  const json = async (tool: ProjectAgentTool, input: unknown = {}) =>
    JSON.parse(await handleProjectTool(deps, run, tool, input));
  return { send, sync, done, json, today: h.service.docs.today() };
}

test("list_tickets carries the own hold and the hold by dependency", async () => {
  const w = await world();
  const items: { key: string; onHold: unknown }[] = (await w.json("list_tickets")).items;
  const of = (key: string | null) => items.find((t) => t.key === key)?.onHold;
  expect(of(w.send.key)).toEqual({ source: "own", key: w.send.key, reason: REASON, since: w.today });
  expect(of(w.sync.key)).toEqual({ source: "dependency", key: w.send.key, reason: REASON, since: w.today });
  expect(of(w.done.key)).toBeNull();
});

test("get_ticket carries the hold of the step", async () => {
  const w = await world();
  expect((await w.json("get_ticket", { key: w.sync.key })).onHold).toMatchObject({
    source: "dependency",
    key: w.send.key,
  });
});

test("project_overview lists the held steps, own and by dependency", async () => {
  const w = await world();
  const held: { key: string | null }[] = (await w.json("project_overview")).held;
  expect(held.map((t) => t.key)).toEqual([w.send.key, w.sync.key]);
});
