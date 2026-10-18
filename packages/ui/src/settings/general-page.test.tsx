import { expect, mock, test } from "bun:test";
import type { BackupStatus, RpcRequest } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const BACKUP_STATUS: BackupStatus = {
  settings: { enabled: true, dir: null },
  dir: "/Users/adam/.kibo/backups",
  displayDir: "~/.kibo/backups",
  last: null,
  nextAt: null,
  running: false,
};

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        if (req.method === "getBackups") return Promise.resolve({ status: BACKUP_STATUS, backups: [] });
        if (req.method === "getEnvironment" || req.method === "getSandboxStatus")
          return new Promise(() => {});
        return Promise.resolve({ path: "/Users/adam/.local/bin/kibo", installed: false });
      },
      subscribe: () => () => undefined,
      subscribeEvents: () => () => undefined,
    },
  }),
);
const { GeneralPage } = await import("./GeneralPage");

test("the general settings hold the application card, the updates, the backups and the kibo command", async () => {
  render(<GeneralPage />);
  expect(screen.getByRole("heading", { level: 1, name: "Général" })).toBeTruthy();
  expect(screen.getByText("Mises à jour et outils en ligne de commande.")).toBeTruthy();
  const titles = screen
    .getAllByText(/^(Application|Mises à jour|Sauvegardes|Commande kibo|Machine)$/)
    .map((e) => e.textContent);
  expect(titles).toEqual(["Application", "Mises à jour", "Sauvegardes", "Commande kibo", "Machine"]);
  expect(screen.queryByText("Exécution des agents dans Kibo")).toBeNull();
  expect(screen.queryByRole("switch", { name: "Exécution des agents dans Kibo" })).toBeNull();
  expect(screen.getByText("Ce réglage vit dans l'application de bureau.")).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Langue" })).toBeNull();
  expect(screen.queryByRole("switch", { name: "Ouvrir Kibo à l'ouverture de session" })).toBeNull();
  expect(await screen.findByText("Aucune sauvegarde pour l'instant")).toBeTruthy();
  expect(screen.getByText("Mises à jour")).toBeTruthy();
  expect(screen.getByText("Les mises à jour se gèrent depuis l'application de bureau.")).toBeTruthy();
  expect(screen.getByText("Commande kibo")).toBeTruthy();
  expect(await screen.findByText("Non installée")).toBeTruthy();
});

test("the settings navigation marks Général and leads to the integrations", async () => {
  location.hash = "#/settings/general";
  render(<GeneralPage />);
  const nav = within(screen.getByRole("navigation", { name: "Paramètres" }));
  expect(nav.getByRole("link", { name: "Général" }).getAttribute("aria-current")).toBe("page");
  await userEvent.setup().click(nav.getByRole("link", { name: "Intégrations" }));
  expect(location.hash).toBe("#/settings/integrations");
});
