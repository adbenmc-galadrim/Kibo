import { describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const actions = () => ({ onSettings: mock(() => {}) });

describe("workspace switcher", () => {
  test("shows the name alone on one line", () => {
    render(<WorkspaceSwitcher name="Galadrim" icon={null} {...actions()} />);
    const trigger = screen.getByRole("button", { name: "Galadrim" });
    expect(trigger.textContent).not.toContain("Workspace local");
  });

  test("lists the workspace and its settings", async () => {
    const user = userEvent.setup();
    render(<WorkspaceSwitcher name="Perso" icon={null} {...actions()} />);
    await user.click(screen.getByRole("button", { name: /Perso/ }));
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["PersoWorkspace local", "Paramètres du workspace"]);
    expect(screen.getByText("Workspaces")).toBeTruthy();
  });

  test("shows the workspace image in the tile when there is one", () => {
    render(<WorkspaceSwitcher name="Perso" icon="/icons/workspace?v=v1" {...actions()} />);
    const tile = screen.getAllByRole("img", { name: "Image du workspace Perso" })[0];
    expect(tile?.getAttribute("src")).toBe("/icons/workspace?v=v1");
  });

  test("the settings entry opens its screen", async () => {
    const user = userEvent.setup();
    const a = actions();
    render(<WorkspaceSwitcher name="Perso" icon={null} {...a} />);
    await user.click(screen.getByRole("button", { name: /Perso/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Paramètres du workspace" }));
    expect(a.onSettings.mock.calls.length).toBe(1);
  });
});
