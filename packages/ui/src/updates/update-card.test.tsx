import { describe, expect, mock, test } from "bun:test";
import type { RpcRequest, Topic } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentsFixture } from "../agents/fixtures";
import type { UpdateInfo, UpdateStatus } from "./update-state";
import { createUpdateStore, type UpdaterPort, type UpdateSnapshot } from "./update-store";

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => Promise.resolve(req.method === "getAgents" ? agentsFixture() : []),
    subscribeTopic: (_: Topic, __: () => void) => () => undefined,
  },
}));
mock.module("../state/use-agents", () => ({ useAgents: () => agentsFixture() }));
const { UpdateCard, UpdatePanel } = await import("./UpdateCard");

const update: UpdateInfo = {
  version: "1.1.0",
  currentVersion: "1.0.0",
  notes: "## Nouveautés\n- Mises à jour intégrées",
  publishedAt: "2026-09-27T10:00:00Z",
};
const snap = (status: UpdateStatus, installed: string | null = "1.0.0"): UpdateSnapshot => ({
  installed,
  status,
});
const noop = () => {};

describe("update panel", () => {
  test("in a browser, it only points to the desktop application", () => {
    render(
      <UpdatePanel
        snapshot={snap({ phase: "idle" }, null)}
        activeRuns={0}
        desktop={false}
        onCheck={noop}
        onInstall={noop}
      />,
    );
    expect(screen.getByText("Les mises à jour se gèrent depuis l'application de bureau.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("shows the installed version and lets the user check", async () => {
    let checks = 0;
    render(
      <UpdatePanel
        snapshot={snap({ phase: "idle" })}
        activeRuns={0}
        desktop
        onCheck={() => checks++}
        onInstall={noop}
      />,
    );
    expect(screen.getByText("Version installée : 1.0.0")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "Rechercher" }));
    expect(checks).toBe(1);
    expect(screen.queryByRole("button", { name: "Installer et redémarrer" })).toBeNull();
  });

  test("says when Kibo is up to date, with the time of the check", () => {
    const at = new Date(2026, 8, 27, 14, 5).getTime();
    render(
      <UpdatePanel
        snapshot={snap({ phase: "current", checkedAt: at })}
        activeRuns={0}
        desktop
        onCheck={noop}
        onInstall={noop}
      />,
    );
    expect(screen.getByText("Kibo est à jour.")).toBeTruthy();
    expect(screen.getByText("Dernière vérification à 14:05")).toBeTruthy();
  });

  test("an available update shows its notes and installs on click", async () => {
    let installs = 0;
    render(
      <UpdatePanel
        snapshot={snap({ phase: "available", update })}
        activeRuns={0}
        desktop
        onCheck={noop}
        onInstall={() => installs++}
      />,
    );
    expect(screen.getByText("Version 1.1.0 disponible")).toBeTruthy();
    expect(screen.getByText(/Mises à jour intégrées/)).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "Installer et redémarrer" }));
    expect(installs).toBe(1);
  });

  test("active runs block the installation and say why", () => {
    render(
      <UpdatePanel
        snapshot={snap({ phase: "available", update })}
        activeRuns={2}
        desktop
        onCheck={noop}
        onInstall={noop}
      />,
    );
    const install = screen.getByRole("button", { name: "Installer et redémarrer" });
    expect(install.hasAttribute("disabled")).toBe(true);
    expect(
      screen.getByText("2 runs sont en cours : attends leur fin ou annule-les avant d'installer."),
    ).toBeTruthy();
  });

  test("a download shows its progress, an install its restart", () => {
    const { rerender } = render(
      <UpdatePanel
        snapshot={snap({ phase: "downloading", update, received: 50, total: 100 })}
        activeRuns={0}
        desktop
        onCheck={noop}
        onInstall={noop}
      />,
    );
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");
    expect(screen.getByText("50 %")).toBeTruthy();
    rerender(
      <UpdatePanel
        snapshot={snap({ phase: "installing", update })}
        activeRuns={0}
        desktop
        onCheck={noop}
        onInstall={noop}
      />,
    );
    expect(screen.getByText("Installation, Kibo va redémarrer…")).toBeTruthy();
  });

  test("the backup before an update is shown, and a failed one says nothing was installed", () => {
    const { rerender } = render(
      <UpdatePanel
        snapshot={snap({ phase: "backingUp", update })}
        activeRuns={0}
        desktop
        onCheck={noop}
        onInstall={noop}
      />,
    );
    expect(screen.getByText("Sauvegarde avant la mise à jour…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rechercher" }).hasAttribute("disabled")).toBe(true);
    rerender(
      <UpdatePanel
        snapshot={snap({ phase: "error", step: "backup", detail: "CONFLICT", update })}
        activeRuns={0}
        desktop
        onCheck={noop}
        onInstall={noop}
      />,
    );
    expect(
      screen.getByText(
        "La sauvegarde a échoué : la mise à jour n'a pas été installée. Vérifie la carte Sauvegardes.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Page des releases" })).toBeNull();
    expect(screen.getByRole("button", { name: "Installer et redémarrer" })).toBeTruthy();
  });

  test("failures are explained, the AppImage case included", () => {
    const { rerender } = render(
      <UpdatePanel
        snapshot={snap({ phase: "error", step: "check", detail: "dns", update: null })}
        activeRuns={0}
        desktop
        onCheck={noop}
        onInstall={noop}
      />,
    );
    expect(
      screen.getByText("Impossible de joindre GitHub. Vérifie la connexion, puis réessaie."),
    ).toBeTruthy();
    rerender(
      <UpdatePanel
        snapshot={snap({ phase: "error", step: "install", detail: "unsupported Linux package", update })}
        activeRuns={0}
        desktop
        onCheck={noop}
        onInstall={noop}
      />,
    );
    expect(screen.getByText(/seule l'AppImage se met à jour/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Page des releases" }).getAttribute("href")).toBe(
      "https://github.com/adbenmc-galadrim/Kibo/releases",
    );
  });
});

test("a channel without release is a neutral status, an invalid release an alert with the releases link", () => {
  const { rerender } = render(
    <UpdatePanel
      snapshot={snap({
        phase: "error",
        step: "check",
        detail: "Could not fetch a valid release JSON from the remote",
        update: null,
      })}
      activeRuns={0}
      desktop
      onCheck={noop}
      onInstall={noop}
    />,
  );
  expect(screen.getByText("Aucune version publiée sur ce canal pour l'instant.")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByText("Mise à jour impossible")).toBeNull();
  rerender(
    <UpdatePanel
      snapshot={snap({ phase: "error", step: "install", detail: "Invalid signature", update })}
      activeRuns={0}
      desktop
      onCheck={noop}
      onInstall={noop}
    />,
  );
  expect(screen.getByText(/La version publiée est invalide \(format ou signature\)/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Page des releases" })).toBeTruthy();
});

describe("update card", () => {
  test("on the desktop, it reads the store and counts the runs holding a slot", async () => {
    const port: UpdaterPort = {
      installedVersion: () => Promise.resolve("1.0.0"),
      check: () => Promise.resolve(update),
      backup: () => Promise.resolve(),
      downloadAndInstall: () => Promise.resolve(),
      relaunch: () => Promise.resolve(),
    };
    const store = createUpdateStore(port);
    await store.check();
    render(<UpdateCard store={store} desktop />);
    expect(await screen.findByText("Version installée : 1.0.0")).toBeTruthy();
    const install = await screen.findByRole("button", { name: "Installer et redémarrer" });
    await screen.findByText(/sont en cours : attends/);
    expect(install.hasAttribute("disabled")).toBe(true);
  });
});
