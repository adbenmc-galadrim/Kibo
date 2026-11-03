import { expect, test } from "bun:test";
import { manifest as kanban } from "@kibo/component-kanban";
import type { Instance, ProjectSnapshot } from "@kibo/schema";
import { instanceFor } from "./instance-of";

const instance = (id: string, component: string, config: Record<string, unknown>): Instance => ({
  id,
  pageId: "page-1",
  component,
  layout: { x: 0, y: 0, w: 12, h: 9 },
  config,
  componentHash: null,
});

const withInstances = (instances: Instance[]) => ({ instances }) as Pick<ProjectSnapshot, "instances">;

test("the first kanban instance of the project is mounted with its own config", () => {
  const snapshot = withInstances([
    instance("i-graph", "graph@1.0.0", {}),
    instance("i-kanban", "kanban@1.0.0", { filter: "mine-and-agents" }),
    instance("i-kanban-2", "kanban@1.0.0", { filter: "all" }),
  ]);
  expect(instanceFor(snapshot, kanban)).toEqual({ id: "i-kanban", config: { filter: "mine-and-agents" } });
});

test("a project without a kanban instance gets phone:kanban with the default config", () => {
  const snapshot = withInstances([instance("i-graph", "graph@1.0.0", {})]);
  expect(instanceFor(snapshot, kanban)).toEqual({ id: "phone:kanban", config: { filter: "all" } });
});

test("a component id that only prefixes another one is not taken for it", () => {
  const snapshot = withInstances([instance("i-x", "kanban-extra@1.0.0", {})]);
  expect(instanceFor(snapshot, kanban).id).toBe("phone:kanban");
});
