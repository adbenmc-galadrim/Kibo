import { expect, test } from "bun:test";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from "@kibo/sdk/ui/sidebar";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectHeaderMenu } from "./ProjectHeaderMenu";

const project = {
  id: "p1",
  key: "KIB",
  name: "Kibo",
  folder: null,
  color: "#F97316",
  worktree: null,
  storybook: null,
  duplication: null,
  delivery: null,
  tracking: null,
  description: null,
  client: null,
};
const actions = () => ({
  newPage: () => {},
  edit: () => {},
  remove: () => {},
});

function mount(editable: boolean, shifted: boolean, onOverviewAdded: ((id: string) => void) | null = null) {
  return render(
    <SidebarProvider>
      <SidebarMenu>
        <SidebarMenuItem>
          <ProjectHeaderMenu
            project={project}
            editable={editable}
            shifted={shifted}
            actions={actions()}
            onPlanningAdded={null}
            onOverviewAdded={onOverviewAdded}
          >
            <SidebarMenuButton>Kibo</SidebarMenuButton>
          </ProjectHeaderMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarProvider>,
  );
}

test("the ⋯ action is a sibling of the project button and shifts when a + follows (screen 107)", () => {
  mount(true, true);
  const item = screen
    .getByRole("button", { name: "Kibo" })
    .closest<HTMLElement>('[data-sidebar="menu-item"]');
  if (!item) throw new Error("menu item not found");
  const more = within(item).getByRole("button", { name: "Actions de Kibo" });
  expect(more.parentElement).toBe(item);
  expect(more.className).toContain("right-7");
});

test("⋯ and right click render the same entries", async () => {
  mount(true, false);
  await userEvent.click(screen.getByRole("button", { name: "Actions de Kibo" }));
  const names = () => screen.getAllByRole("menuitem").map((m) => m.textContent);
  expect(names()).toEqual(["Nouvelle page", "Modifier…", "Fichiers du projet…", "Supprimer…"]);
  await userEvent.keyboard("{Escape}");
  fireEvent.contextMenu(screen.getByRole("button", { name: "Kibo" }));
  expect(names()).toEqual(["Nouvelle page", "Modifier…", "Fichiers du projet…", "Supprimer…"]);
});

test("a non editable project only lists its files and removes", () => {
  mount(false, false);
  fireEvent.contextMenu(screen.getByRole("button", { name: "Kibo" }));
  expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual([
    "Fichiers du projet…",
    "Supprimer…",
  ]);
});

test("a project without its Vue d'ensemble page offers to add it after « Nouvelle page »", async () => {
  mount(true, false, () => {});
  await userEvent.click(screen.getByRole("button", { name: "Actions de Kibo" }));
  expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual([
    "Nouvelle page",
    "Ajouter la page Vue d'ensemble",
    "Modifier…",
    "Fichiers du projet…",
    "Supprimer…",
  ]);
});
