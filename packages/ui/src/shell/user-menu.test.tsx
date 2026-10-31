import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { TabTarget } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: () => Promise.resolve(null),
      subscribeEvents: () => () => undefined,
    },
  }),
);
const { UserMenu } = await import("./UserMenu");

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => document.documentElement.classList.remove("dark"));

test("the avatar opens a menu with the name, the theme submenu and settings, no sessions (screen 112)", async () => {
  const opened: TabTarget[] = [];
  render(<UserMenu viewer="adam" onOpen={(t) => opened.push(t)} onHelp={() => {}} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Menu de adam" }));
  const menu = await screen.findByRole("menu", { name: "Menu de adam" });
  expect(await within(menu).findByText("adam")).toBeTruthy();
  expect(within(menu).queryByText(/·/)).toBeNull();
  await user.click(within(menu).getByRole("menuitem", { name: "Thème" }));
  const system = await screen.findByRole("menuitemradio", { name: "Système" });
  expect(system.getAttribute("aria-checked")).toBe("true");
  expect(system.querySelector("svg.lucide-check")).not.toBeNull();
  expect(screen.getByRole("menuitemradio", { name: "Sombre" }).querySelector("svg")).toBeNull();
  screen.getByRole("menuitemradio", { name: "Sombre" }).focus();
  await user.keyboard("{Enter}");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  await user.click(screen.getByRole("button", { name: "Menu de adam" }));
  expect(screen.queryByRole("menuitem", { name: "Sessions" })).toBeNull();
  await user.click(await screen.findByRole("menuitem", { name: "Paramètres" }));
  expect(opened).toEqual([{ kind: "screen", screen: "general" }]);
});

test("the help group lists its four entries and opens the chosen dialog", async () => {
  const asked: string[] = [];
  render(<UserMenu viewer="adam" onOpen={() => {}} onHelp={(key) => asked.push(key)} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Menu de adam" }));
  await user.click(await screen.findByRole("menuitem", { name: "Aide" }));
  const entries = await screen.findAllByRole("menuitem", {
    name: /^(Raccourcis clavier|Quoi de neuf|Signaler un problème|À propos de Kibo)/,
  });
  expect(entries.map((e) => e.textContent)).toEqual([
    "Raccourcis clavierCtrl+/",
    "Quoi de neuf",
    "Signaler un problème",
    "À propos de Kibo",
  ]);
  screen.getByRole("menuitem", { name: "À propos de Kibo" }).focus();
  await user.keyboard("{Enter}");
  expect(asked).toEqual(["about"]);
});
