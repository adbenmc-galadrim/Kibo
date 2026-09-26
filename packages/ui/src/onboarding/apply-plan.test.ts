import { expect, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { applyStarterPlan } from "./apply-plan";

function fakeClient(failOn: string | null = null) {
  const calls: RpcRequest[] = [];
  let n = 0;
  return {
    calls,
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (req.method !== "command") return null;
      if (req.command.method === "addPage") {
        if (req.command.title === failOn) throw new KiboError("INTERNAL", "boom");
        n += 1;
        return { id: `pg${n}`, title: req.command.title, kind: req.command.kind, parentId: null };
      }
      return { id: `i${calls.length}` };
    },
  };
}
const refs = new Map([
  ["kanban", "kanban@1.0.0"],
  ["tickets", "tickets@1.0.0"],
]);

test("creates pages and instances, placing dashboard widgets side by side", async () => {
  const client = fakeClient();
  const failures = await applyStarterPlan(
    client as never,
    "p1",
    [
      {
        title: "Tableau de bord",
        kind: "dashboard",
        components: [
          { id: "kanban", config: {} },
          { id: "tickets", config: { filter: "mine" } },
        ],
      },
      { title: "Kanban", kind: "view", components: [{ id: "kanban", config: {} }] },
    ],
    refs,
  );
  expect(failures).toEqual([]);
  expect(client.calls.map((c) => (c.method === "command" ? c.command : null))).toEqual([
    { method: "addPage", title: "Tableau de bord", kind: "dashboard" },
    {
      method: "addInstance",
      pageId: "pg1",
      component: "kanban@1.0.0",
      config: {},
      layout: { x: 0, y: 0, w: 6, h: 6 },
    },
    {
      method: "addInstance",
      pageId: "pg1",
      component: "tickets@1.0.0",
      config: { filter: "mine" },
      layout: { x: 6, y: 0, w: 6, h: 6 },
    },
    { method: "addPage", title: "Kanban", kind: "view" },
    { method: "addInstance", pageId: "pg2", component: "kanban@1.0.0", config: {} },
  ]);
});

test("skips components without a ref and reports a failing page without stopping", async () => {
  const client = fakeClient("Tickets");
  const failures = await applyStarterPlan(
    client as never,
    "p1",
    [
      { title: "Tickets", kind: "view", components: [{ id: "tickets", config: {} }] },
      { title: "Graphe", kind: "view", components: [{ id: "graph", config: {} }] },
    ],
    refs,
  );
  expect(failures).toEqual([{ title: "Tickets", message: "INTERNAL: boom" }]);
  expect(client.calls).toHaveLength(2);
});
