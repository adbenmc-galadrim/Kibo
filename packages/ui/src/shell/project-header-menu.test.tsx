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
};
const actions = () => ({
  newPage: () => {},
  share: () => {},
  edit: () => {},
  remove: () => {},
});

function mount(editable: boolean, shifted: boolean) {
  return render(
    <SidebarProvider>
      <SidebarMenu>
        <SidebarMenuItem>
          <ProjectHeaderMenu
            project={project}
            current
            editable={editable}
            shifted={shifted}
            actions={actions()}
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

test("⋯ and right click render the same entries, share labelled by frShare", async () => {
  mount(true, false);
  await userEvent.click(screen.getByRole("button", { name: "Actions de Kibo" }));
  const names = () => screen.getAllByRole("menuitem").map((m) => m.textContent);
  expect(names()).toEqual(["Nouvelle page", "Partager", "Modifier…", "Fichiers du projet…", "Supprimer…"]);
  await userEvent.keyboard("{Escape}");
  fireEvent.contextMenu(screen.getByRole("button", { name: "Kibo" }));
  expect(names()).toEqual(["Nouvelle page", "Partager", "Modifier…", "Fichiers du projet…", "Supprimer…"]);
});

test("a non editable project only shares and removes", () => {
  mount(false, false);
  fireEvent.contextMenu(screen.getByRole("button", { name: "Kibo" }));
  expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual([
    "Partager",
    "Fichiers du projet…",
    "Supprimer…",
  ]);
});
