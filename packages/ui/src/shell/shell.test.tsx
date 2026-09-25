import { expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, type ProjectSnapshot } from "@kibo/schema";
import { act, render } from "@testing-library/react";

const project: ProjectSnapshot = {
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW,
  pages: [{ id: "1@1", title: "Board", kind: "view", parentId: null }],
  tickets: [],
  links: [],
  instances: [],
};

mock.module("../state/use-projects", () => ({
  useProjects: () => [project.meta],
  useProject: (id: string | null) => (id === "p1" ? project : null),
}));

const { Shell } = await import("./Shell");

test("a page missing from the snapshot does not redirect to the first page", async () => {
  location.hash = "";
  render(<Shell viewer="adam" />);
  await act(async () => {
    location.hash = "#/p/p1/2%401";
    await new Promise((r) => setTimeout(r, 20));
  });
  expect(location.hash).toBe("#/p/p1/2%401");
});
