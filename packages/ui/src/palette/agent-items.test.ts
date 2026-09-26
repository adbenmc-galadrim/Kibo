import { expect, test } from "bun:test";
import { runFixture } from "../agents/fixtures";
import { agentItems } from "./agent-items";
import { FILTERS, searchItems } from "./palette-items";

const runs = [
  runFixture({
    id: "r14",
    ticketId: "14@1",
    ticketKey: "KIB-14",
    label: "opus-dev-2",
    state: "waiting_input",
  }),
  runFixture({ id: "r12", ticketId: "12@1", ticketKey: "KIB-12", label: "opus-dev-1", state: "running" }),
];
const active = { projectId: "p1", ticketId: "12@1", keyLabel: "KIB-12" };

test("a waiting run can be answered, the active ticket can be assigned", () => {
  const items = agentItems(runs, active);
  expect(items.map((i) => [i.group, i.label, i.icon])).toEqual([
    ["agents", "Répondre à opus-dev-2 (KIB-14)", "reply"],
    ["agents", "Assigner KIB-12 à un agent…", "assign"],
  ]);
  expect(items.map((i) => i.run)).toEqual([
    { kind: "action", action: { kind: "reply", runId: "r14" } },
    { kind: "action", action: { kind: "assign", projectId: "p1", ticketId: "12@1" } },
  ]);
  expect(agentItems(runs, null).map((i) => i.label)).toEqual(["Répondre à opus-dev-2 (KIB-14)"]);
});

test("agents are searchable without accents and have their own filter", () => {
  const items = agentItems(runs, active);
  expect(searchItems(items, "repondre", "all").map((s) => s.group)).toEqual(["agents"]);
  expect(searchItems(items, "", "agents")[0]?.items).toHaveLength(2);
  expect(FILTERS).toContain("agents");
});
