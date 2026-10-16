import { expect, test } from "bun:test";
import {
  type ComponentCall,
  ComponentManifest,
  type ProjectCommand,
  type ProjectSnapshot,
  type SprintView,
} from "@kibo/schema";
import { createSdk } from "./sdk";
import type { ProjectBackend, SdkContext } from "./types";

const planner = ComponentManifest.parse({
  id: "planner",
  version: "1.0.0",
  kind: "view",
  title: "Planner",
  reads: ["ticket", "sprint"],
  writes: ["ticket", "sprint"],
});
const ctx: SdkContext = {
  instanceId: "i1",
  config: {},
  viewer: "adam",
  surface: "view",
  format: "full",
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openFile: () => undefined,
  openView: () => undefined,
};
const S44: SprintView = {
  id: "s44",
  code: "S44",
  name: "Rapports",
  start: "2026-10-26",
  end: "2026-10-30",
  state: "planned",
  features: ["f9"],
  delivered: 0,
  total: 1,
};

const backendOf = (runs: ProjectCommand[], calls: ComponentCall[] = []): ProjectBackend => ({
  snapshot: async () => ({ sprints: [S44] }) as unknown as ProjectSnapshot,
  run: async (cmd) => {
    runs.push(cmd);
    return cmd.method === "createSprint"
      ? { id: "s45", code: cmd.code, name: cmd.name, start: cmd.start, end: cmd.end }
      : null;
  },
  call: async (c) => {
    calls.push(c);
    return [S44];
  },
  subscribe: () => () => undefined,
  runs: async () => [],
  subscribeRuns: () => () => undefined,
});

test("a built-in component lists the sprints of the snapshot", async () => {
  expect(await createSdk(backendOf([]), planner, ctx).sprints.list()).toEqual([S44]);
  expect(await createSdk(backendOf([]), planner, ctx).list("sprint")).toEqual([S44]);
});

test("a gated component lists the sprints through the daemon", async () => {
  const calls: ComponentCall[] = [];
  expect(await createSdk(backendOf([], calls), planner, ctx, "gated").sprints.list()).toEqual([S44]);
  expect(calls).toEqual([{ kind: "list", entity: "sprint" }]);
});

test("create, update, remove and assign run the sprint commands", async () => {
  const runs: ProjectCommand[] = [];
  const sprints = createSdk(backendOf(runs), planner, ctx).sprints;
  expect(
    await sprints.create({ code: "S45", name: "Bilan", start: "2026-11-02", end: "2026-11-06" }),
  ).toEqual({
    id: "s45",
    code: "S45",
    name: "Bilan",
    start: "2026-11-02",
    end: "2026-11-06",
  });
  await sprints.update("s44", { end: "2026-10-31" });
  await sprints.remove("s44");
  await sprints.assign("f9", "s44");
  await sprints.assign("f9", null);
  expect(runs).toEqual([
    { method: "createSprint", code: "S45", name: "Bilan", start: "2026-11-02", end: "2026-11-06" },
    { method: "updateSprint", sprintId: "s44", patch: { end: "2026-10-31" } },
    { method: "deleteSprint", sprintId: "s44" },
    { method: "setTicketSprint", ticketId: "f9", sprintId: "s44" },
    { method: "setTicketSprint", ticketId: "f9", sprintId: null },
  ]);
});

test("each sprint call needs its permission: read and write sprint, assign writes the ticket", async () => {
  const runs: ProjectCommand[] = [];
  const reader = { ...planner, reads: ["ticket" as const], writes: ["ticket" as const] };
  const sprints = createSdk(backendOf(runs), reader, ctx).sprints;
  await expect(sprints.list()).rejects.toThrow("PERMISSION_DENIED");
  await expect(
    sprints.create({ code: "S45", name: "Bilan", start: "2026-11-02", end: "2026-11-06" }),
  ).rejects.toThrow("PERMISSION_DENIED");
  await expect(sprints.update("s44", { name: "x" })).rejects.toThrow("PERMISSION_DENIED");
  await expect(sprints.remove("s44")).rejects.toThrow("PERMISSION_DENIED");
  await sprints.assign("f9", "s44");
  expect(runs.map((r) => r.method)).toEqual(["setTicketSprint"]);
  const sprintOnly = { ...planner, writes: ["sprint" as const] };
  await expect(createSdk(backendOf([]), sprintOnly, ctx).sprints.assign("f9", "s44")).rejects.toThrow(
    "PERMISSION_DENIED",
  );
});
