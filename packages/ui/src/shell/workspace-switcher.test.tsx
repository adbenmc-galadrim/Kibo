import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

describe("workspace switcher", () => {
  test("shows the name and the local subtitle", () => {
    render(<WorkspaceSwitcher name="Perso" icon={null} onSettings={() => {}} />);
    expect(screen.getByRole("button", { name: /Perso/ }).textContent).toContain("Workspace local");
  });

  test("lists the current workspace and the settings entry only", async () => {
    const user = userEvent.setup();
    render(<WorkspaceSwitcher name="Perso" icon={null} onSettings={() => {}} />);
    await user.click(screen.getByRole("button", { name: /Perso/ }));
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["PersoWorkspace local", "Paramètres du workspace"]);
    expect(screen.getByText("Workspaces")).toBeTruthy();
  });

  test("shows the workspace image in the tile when there is one", () => {
    render(<WorkspaceSwitcher name="Perso" icon="/icons/workspace?v=v1" onSettings={() => {}} />);
    const tile = screen.getAllByRole("img", { name: "Image du workspace Perso" })[0];
    expect(tile?.getAttribute("src")).toBe("/icons/workspace?v=v1");
  });

  test("settings entry opens the workspace settings", async () => {
    const user = userEvent.setup();
    let opened = 0;
    render(
      <WorkspaceSwitcher
        name="Perso"
        icon={null}
        onSettings={() => {
          opened += 1;
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Perso/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Paramètres du workspace" }));
    expect(opened).toBe(1);
  });
});
