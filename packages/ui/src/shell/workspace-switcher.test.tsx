import { describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const openRename = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /Perso/ }));
  await user.click(await screen.findByRole("menuitem", { name: "Renommer le workspace…" }));
};

describe("workspace switcher", () => {
  test("shows the name and the local subtitle", () => {
    render(<WorkspaceSwitcher name="Perso" onRename={async () => {}} onSettings={() => {}} />);
    expect(screen.getByRole("button", { name: /Perso/ }).textContent).toContain("Workspace local");
  });

  test("lists the current workspace without switching entries", async () => {
    const user = userEvent.setup();
    render(<WorkspaceSwitcher name="Perso" onRename={async () => {}} onSettings={() => {}} />);
    await user.click(screen.getByRole("button", { name: /Perso/ }));
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "PersoWorkspace local",
      "Renommer le workspace…",
      "Paramètres du workspace",
    ]);
    expect(screen.getByText("Workspaces")).toBeTruthy();
  });

  test("renames from the menu", async () => {
    const user = userEvent.setup();
    const names: string[] = [];
    render(
      <WorkspaceSwitcher
        name="Perso"
        onRename={async (n) => {
          names.push(n);
        }}
        onSettings={() => {}}
      />,
    );
    await openRename(user);
    const field = await screen.findByLabelText("Nom");
    expect((field as HTMLInputElement).value).toBe("Perso");
    await user.clear(field);
    await user.type(field, "Maison");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(names).toEqual(["Maison"]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("a failed rename is shown, the dialog stays open", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceSwitcher
        name="Perso"
        onRename={async () => {
          throw new Error("nope");
        }}
        onSettings={() => {}}
      />,
    );
    await openRename(user);
    await user.click(await screen.findByRole("button", { name: "Enregistrer" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Impossible de renommer le workspace.");
    expect(screen.getByRole("dialog", { name: "Renommer le workspace" })).toBeTruthy();
  });

  test("a daemon error adds its known message", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceSwitcher
        name="Perso"
        onRename={async () => {
          throw new KiboError("INVALID_INPUT", "too long");
        }}
        onSettings={() => {}}
      />,
    );
    await openRename(user);
    await user.click(await screen.findByRole("button", { name: "Enregistrer" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Impossible de renommer le workspace.");
    expect(alert.textContent).toContain("Requête invalide.");
  });

  test("settings entry opens the workspace settings", async () => {
    const user = userEvent.setup();
    let opened = 0;
    render(
      <WorkspaceSwitcher
        name="Perso"
        onRename={async () => {}}
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
