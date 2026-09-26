import { expect, mock, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

mock.module("../api", () => ({
  client: {
    rpc: (_: RpcRequest) => Promise.resolve({ path: "/Users/adam/.local/bin/kibo", installed: false }),
    subscribe: () => () => undefined,
  },
}));
const { GeneralPage } = await import("./GeneralPage");

test("the general settings hold the application and the kibo command", async () => {
  render(<GeneralPage />);
  expect(screen.getByRole("heading", { level: 1, name: "Général" })).toBeTruthy();
  expect(screen.getByText("Langue, démarrage et outils en ligne de commande.")).toBeTruthy();
  expect(screen.getByText("Application")).toBeTruthy();
  expect(screen.getByText("Commande kibo")).toBeTruthy();
  expect(await screen.findByText("Non installée")).toBeTruthy();
});

test("the application settings are shown but not yet available", () => {
  render(<GeneralPage />);
  expect(screen.getByRole("combobox", { name: "Langue" }).hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByRole("switch", { name: "Ouvrir Kibo à l'ouverture de session" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(screen.getByRole("button", { name: "Ouvrir" }).hasAttribute("disabled")).toBe(true);
});

test("the settings navigation marks Général and leads to the domains", async () => {
  location.hash = "#/settings/general";
  render(<GeneralPage />);
  const nav = within(screen.getByRole("navigation", { name: "Paramètres" }));
  expect(nav.getByRole("link", { name: "Général" }).getAttribute("aria-current")).toBe("page");
  await userEvent.setup().click(nav.getByRole("link", { name: "Domaines & guidelines" }));
  expect(location.hash).toBe("#/settings/domains");
});
