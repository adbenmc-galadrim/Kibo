import { expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShortcutsDialog } from "./ShortcutsDialog";

test("the dialog shows the three groups of the settings page and links to it", async () => {
  let closed = 0;
  render(<ShortcutsDialog open onClose={() => closed++} />);
  const dialog = await screen.findByRole("dialog", { name: "Raccourcis" });
  const d = within(dialog);
  for (const name of ["Navigation", "Palette", "Code"]) expect(d.getByRole("region", { name })).toBeTruthy();
  const help = d.getByText("Aide des raccourcis").closest("li");
  expect(help?.querySelectorAll("kbd")).toHaveLength(1);
  const link = d.getByRole("link", { name: "Voir dans les Paramètres" });
  expect(link.getAttribute("href")).toBe("#/settings/shortcuts");
  await userEvent.setup().click(link);
  expect(closed).toBe(1);
});

test("Escape closes the dialog", async () => {
  let closed = 0;
  render(<ShortcutsDialog open onClose={() => closed++} />);
  await screen.findByRole("dialog", { name: "Raccourcis" });
  await userEvent.setup().keyboard("{Escape}");
  expect(closed).toBe(1);
});
