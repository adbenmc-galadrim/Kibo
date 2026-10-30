import { expect, mock, test } from "bun:test";
import type { ProjectSummary } from "@kibo/schema";
import { SidebarMenu, SidebarMenuItem, SidebarProvider } from "@kibo/sdk/ui/sidebar";
import { render, screen } from "@testing-library/react";
import { apiMock } from "../api-mock";

mock.module("../api", () => apiMock({ client: { rpc: async () => null } }));
const { ProjectEntry } = await import("./ProjectEntry");

const summary: ProjectSummary = {
  id: "p",
  name: "Silo",
  key: "SILO",
  folder: null,
  color: "#14B8A6",
  worktree: null,
  storybook: null,
  duplication: null,
  delivery: null,
  tracking: null,
  description: null,
  client: null,
  counts: { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 },
};

const show = (project: ProjectSummary) =>
  render(
    <SidebarProvider>
      <SidebarMenu>
        <SidebarMenuItem>
          <ProjectEntry
            project={project}
            active={null}
            activeTarget={null}
            projectActive={false}
            editable={false}
            menuEditable
            current={false}
            link={() => ({ onClick: () => {}, onAuxClick: () => {}, onDoubleClick: () => {} })}
            onOpen={() => {}}
            onNewPage={() => {}}
            onRenamePage={() => {}}
            onDeletePage={() => {}}
            onEdit={() => {}}
            onDelete={() => {}}
          />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarProvider>,
  );

test("the project row reserves the room of its hover actions", () => {
  show(summary);
  const row = screen.getByText("Silo").closest("button");
  expect(row?.classList.contains("k-project-row")).toBe(true);
  expect(row?.getAttribute("data-actions")).toBe("1");
});
