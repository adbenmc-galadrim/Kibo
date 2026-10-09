import { expect, mock, test } from "bun:test";
import type { ProjectSummary } from "@kibo/schema";
import { SidebarMenu, SidebarMenuItem, SidebarProvider } from "@kibo/sdk/ui/sidebar";
import { render, screen } from "@testing-library/react";
import { apiMock } from "../api-mock";

mock.module("../api", () => apiMock({ client: { rpc: async () => null } }));
const { ProjectEntry } = await import("./ProjectEntry");

const summary = (demo: boolean): ProjectSummary => ({
  id: "p",
  name: "Démo Kibo",
  key: "DEMO",
  folder: null,
  color: "#14B8A6",
  worktree: null,
  storybook: null,
  counts: { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 },
  demo,
});

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
            trailing={null}
            link={() => ({ onClick: () => {}, onAuxClick: () => {}, onDoubleClick: () => {} })}
            onOpen={() => {}}
            onNewPage={() => {}}
            onRenamePage={() => {}}
            onDeletePage={() => {}}
            onShare={() => {}}
            onEdit={() => {}}
            onDelete={() => {}}
          />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarProvider>,
  );

test("the demo project carries a Démo badge after its name, other projects do not", () => {
  const { unmount } = show(summary(true));
  expect(screen.getByText("Démo")).toBeTruthy();
  unmount();
  show(summary(false));
  expect(screen.queryByText("Démo")).toBeNull();
});
