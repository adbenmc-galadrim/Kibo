import { describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const actions = () => ({
  onSettings: mock(() => {}),
  onComponents: mock(() => {}),
  onChanges: mock(() => {}),
});

describe("workspace switcher", () => {
  test("shows the name alone on one line", () => {
    render(<WorkspaceSwitcher name="Galadrim" icon={null} {...actions()} />);
    const trigger = screen.getByRole("button", { name: "Galadrim" });
    expect(trigger.textContent).not.toContain("Workspace local");
  });

  test("lists the workspace, the components, the changes and the settings", async () => {
    const user = userEvent.setup();
    render(<WorkspaceSwitcher name="Perso" icon={null} {...actions()} />);
    await user.click(screen.getByRole("button", { name: /Perso/ }));
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "PersoWorkspace local",
      "Composants",
      "Changements",
      "Paramètres du workspace",
    ]);
    expect(screen.getByText("Workspaces")).toBeTruthy();
  });

  test("without a git project there is no changes entry", async () => {
    const user = userEvent.setup();
    render(<WorkspaceSwitcher name="Perso" icon={null} {...actions()} onChanges={null} />);
    await user.click(screen.getByRole("button", { name: /Perso/ }));
    const items = await screen.findAllByRole("menuitem");
    expect(items.some((i) => i.textContent === "Changements")).toBe(false);
  });

  test("shows the workspace image in the tile when there is one", () => {
    render(<WorkspaceSwitcher name="Perso" icon="/icons/workspace?v=v1" {...actions()} />);
    const tile = screen.getAllByRole("img", { name: "Image du workspace Perso" })[0];
    expect(tile?.getAttribute("src")).toBe("/icons/workspace?v=v1");
  });

  test("each entry opens its screen", async () => {
    const user = userEvent.setup();
    const a = actions();
    render(<WorkspaceSwitcher name="Perso" icon={null} {...a} />);
    for (const name of ["Composants", "Changements", "Paramètres du workspace"]) {
      await user.click(screen.getByRole("button", { name: /Perso/ }));
      await user.click(await screen.findByRole("menuitem", { name }));
    }
    expect([a.onComponents, a.onChanges, a.onSettings].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });
});
