import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Trash2 } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "./context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./dropdown-menu";
import { ContextMenuEntries, DropdownMenuEntries, isSeparator, isSubmenu, type MenuEntry } from "./menu-entries";

const entries = (log: string[]): MenuEntry[] => [
  { label: "Ouvrir", onSelect: () => log.push("open") },
  { label: "Statut", items: [{ label: "En cours", onSelect: () => log.push("in_progress") }] },
  { separator: true },
  { label: "Supprimer…", icon: Trash2, destructive: true, onSelect: () => log.push("remove") },
];

test("type guards tell separators and submenus apart", () => {
  const [action, sub, sep] = entries([]);
  expect(isSeparator(sep as MenuEntry)).toBe(true);
  expect(isSubmenu(sub as MenuEntry)).toBe(true);
  expect(isSubmenu(action as MenuEntry)).toBe(false);
});

test("a dropdown renders every entry and runs the selected action", async () => {
  const log: string[] = [];
  render(
    <DropdownMenu>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuEntries entries={entries(log)} />
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actions" }));
  expect(screen.getByRole("separator")).toBeTruthy();
  await user.click(screen.getByRole("menuitem", { name: "Statut" }));
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(await screen.findByRole("menuitem", { name: "En cours" }));
  await user.keyboard("{Enter}");
  expect(log).toEqual(["in_progress"]);
});

test("a context menu opens on right click and marks the destructive entry", async () => {
  const log: string[] = [];
  render(
    <ContextMenu>
      <ContextMenuTrigger>Ligne</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuEntries entries={entries(log)} />
      </ContextMenuContent>
    </ContextMenu>,
  );
  const user = userEvent.setup();
  await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Ligne") });
  const remove = await screen.findByRole("menuitem", { name: "Supprimer…" });
  expect(remove.getAttribute("data-variant")).toBe("destructive");
  await user.click(remove);
  expect(log).toEqual(["remove"]);
});
