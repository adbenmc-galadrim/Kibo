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

test("the general settings hold the application card, the updates and the kibo command", async () => {
  render(<GeneralPage />);
  expect(screen.getByRole("heading", { level: 1, name: "Général" })).toBeTruthy();
  expect(screen.getByText("Mises à jour et outils en ligne de commande.")).toBeTruthy();
  const titles = screen.getAllByText(/^(Application|Mises à jour|Commande kibo)$/).map((e) => e.textContent);
  expect(titles).toEqual(["Application", "Mises à jour", "Commande kibo"]);
  expect(screen.getByText("Ce réglage vit dans l'application de bureau.")).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Langue" })).toBeNull();
  expect(screen.queryByRole("switch")).toBeNull();
  expect(screen.getByText("Mises à jour")).toBeTruthy();
  expect(screen.getByText("Les mises à jour se gèrent depuis l'application de bureau.")).toBeTruthy();
  expect(screen.getByText("Commande kibo")).toBeTruthy();
  expect(await screen.findByText("Non installée")).toBeTruthy();
});

test("the settings navigation marks Général and leads to the domains", async () => {
  location.hash = "#/settings/general";
  render(<GeneralPage />);
  const nav = within(screen.getByRole("navigation", { name: "Paramètres" }));
  expect(nav.getByRole("link", { name: "Général" }).getAttribute("aria-current")).toBe("page");
  await userEvent.setup().click(nav.getByRole("link", { name: "Domaines & guidelines" }));
  expect(location.hash).toBe("#/settings/domains");
});
