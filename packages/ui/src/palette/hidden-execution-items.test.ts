import { expect, test } from "bun:test";
import { agentsFixture, kiboProject, projectsFixture, runFixture } from "../agents/fixtures";
import type { PaletteContext } from "./palette-items";
import { paletteFilters, paletteItems } from "./visible-items";

const agents = agentsFixture();
const context = (executionShown: boolean): PaletteContext => ({
  projects: projectsFixture,
  snapshots: new Map([["kibo", kiboProject()]]),
  recents: [{ kind: "screen", screen: "agents" }],
  activeProjectId: "kibo",
  activeTicketId: "t12",
  agents: {
    ...agents,
    runs: [runFixture({ id: "r12", projectId: "kibo", ticketId: "t12", state: "waiting_input" })],
    queue: [{ runId: "r12", position: 1, reason: { kind: "host", used: 3, total: 3 } }],
  },
  executionShown,
});

const labels = (shown: boolean) => paletteItems(context(shown)).map((i) => i.label);

test("hidden execution: no Agents, Files d'attente nor Skills page, even among the recents", () => {
  const items = paletteItems(context(false));
  expect(items.filter((i) => i.id.endsWith("screen:agents") || i.id.endsWith("screen:queue"))).toEqual([]);
  expect(items.some((i) => i.id.endsWith("screen:skills"))).toBe(false);
  expect(items.some((i) => i.group === "recents")).toBe(false);
});

test("shown execution: the agent screens stay retired, as pages and as recents", () => {
  const ids = paletteItems(context(true)).map((i) => i.id);
  for (const id of ["screen:agents", "screen:queue", "screen:skills", "recent:screen:agents"])
    expect(ids).not.toContain(id);
});

test("hidden execution: no assign nor reply entry, and no Agents filter", () => {
  expect(labels(false).some((l) => l.startsWith("Assigner") || l.startsWith("Répondre"))).toBe(false);
  expect(paletteItems(context(false)).some((i) => i.group === "agents")).toBe(false);
  expect(paletteFilters(false)).not.toContain("agents");
});

test("shown execution: assign, reply and the Agents filter come back", () => {
  expect(labels(true)).toContain("Assigner KIB-12 à un agent…");
  expect(labels(true).some((l) => l.startsWith("Répondre"))).toBe(true);
  expect(paletteFilters(true)).toContain("agents");
});

test("hidden execution: a queued ticket shows its status, not its queue position", () => {
  const ticket = (shown: boolean) => paletteItems(context(shown)).find((i) => i.id === "ticket:kibo:t12");
  expect(ticket(false)?.detail).toBe("En cours");
  expect(ticket(true)?.detail).toBe("En file #1");
});
