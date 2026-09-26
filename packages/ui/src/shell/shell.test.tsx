import { expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, type ProjectSnapshot } from "@kibo/schema";
import { act, render, screen, within } from "@testing-library/react";

const project: ProjectSnapshot = {
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW,
  pages: [{ id: "1@1", title: "Board", kind: "view", parentId: null }],
  tickets: [],
  links: [],
  instances: [],
  nextTicketKey: "KIB-1",
};

mock.module("../state/use-projects", () => ({
  useProjects: () => [
    { ...project.meta, counts: { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 } },
  ],
  useProject: (id: string | null) => (id === "p1" ? project : null),
}));

mock.module("../api", () => ({ client: { rpc: () => Promise.resolve(null) } }));
mock.module("../state/use-agents", () => ({
  useAgents: () => null,
  useConfig: () => null,
  useNow: () => 0,
  useRunLog: () => null,
  useDaemonOnline: () => false,
}));

const { Shell } = await import("./Shell");

test("a page missing from the snapshot does not redirect to the first page", async () => {
  location.hash = "";
  render(<Shell viewer="adam" notifications="native" />);
  await act(async () => {
    location.hash = "#/p/p1/2%401";
    await new Promise((r) => setTimeout(r, 20));
  });
  expect(location.hash).toBe("#/p/p1/2%401");
});

test("the header shows a Project › Page breadcrumb", async () => {
  render(<Shell viewer="adam" notifications="native" />);
  await act(async () => {
    location.hash = "#/p/p1/1%401";
    await new Promise((r) => setTimeout(r, 20));
  });
  const crumbs = within(screen.getByRole("navigation", { name: "Fil d'Ariane" }));
  expect(crumbs.getByText("Kibo")).toBeTruthy();
  expect(crumbs.getByText("Board").getAttribute("aria-current")).toBe("page");
});
