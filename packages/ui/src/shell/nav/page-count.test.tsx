import { expect, mock, test } from "bun:test";
import type { Page, ProjectSnapshot } from "@kibo/schema";
import { SidebarMenu, SidebarMenuItem, SidebarProvider } from "@kibo/sdk/ui/sidebar";
import { render, screen } from "@testing-library/react";
import { apiMock } from "../../api-mock";

mock.module("../../api", () =>
  apiMock({
    client: {
      rpc: async () => null,
      subscribe: () => () => {},
      subscribeTopic: () => () => {},
      subscribeEvents: () => () => {},
    },
  }),
);
const { ProjectPages } = await import("../ProjectPages");
const { siloFeatureProject } = await import("../feature/fixture");

const page = (id: string, title: string, parentId: string | null): Page => ({
  id,
  title,
  kind: "view",
  parentId,
});

const countedPages = (access: ProjectSnapshot["sync"]["access"]) => {
  const silo = siloFeatureProject();
  const counted: ProjectSnapshot = {
    ...silo,
    sync: { ...silo.sync, access },
    pages: [page("p-questions", "Questions", null)],
    instances: [
      {
        id: "i-questions",
        pageId: "p-questions",
        component: "questions@1.0.0",
        layout: { x: 0, y: 0, w: 12, h: 8 },
        config: {},
        componentHash: null,
      },
    ],
  };
  render(
    <SidebarProvider>
      <SidebarMenu>
        <SidebarMenuItem>
          <ProjectPages
            project={counted}
            activeTarget={null}
            header={<span>Silo</span>}
            onOpen={() => {}}
            onNewPage={() => {}}
            onRenamePage={() => {}}
            onDeletePage={() => {}}
          />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarProvider>,
  );
  const row = screen.getByRole("button", { name: "Questions" });
  const count = row.querySelector(".k-count");
  if (count === null) throw new Error("the Questions row shows no count");
  return { row, count };
};

test("the ⋯ of an editable row shows for its own row only and its count yields to it", () => {
  const { row, count } = countedPages("write");
  const line = row.parentElement;
  expect(line?.classList.contains("k-page-row")).toBe(true);
  expect(count.classList.contains("k-yield")).toBe(true);
  const action = line?.querySelector('[data-sidebar="menu-action"]');
  expect(action?.classList.contains("k-page-action")).toBe(true);
  expect(action?.className).not.toContain("group-hover/menu-item");
  expect(action?.className).not.toContain("group-focus-within/menu-item");
});

test("the count of a read-only row has no ⋯ to yield to and stays shown", () => {
  const { count } = countedPages("read-only");
  expect(count.classList.contains("k-yield")).toBe(false);
});
