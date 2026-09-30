import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { RpcRequest, SyncStatus, TabTarget } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let status: SyncStatus | null = null;
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => Promise.resolve(req.method === "getSyncStatus" ? status : null),
    subscribeEvents: () => () => undefined,
  },
}));
const { UserMenu } = await import("./UserMenu");

beforeEach(() => {
  localStorage.clear();
  status = null;
});
afterEach(() => document.documentElement.classList.remove("dark"));

test("the avatar opens a menu with the theme submenu, sessions and settings (screen 112)", async () => {
  status = {
    state: "online",
    serverUrl: "https://sync.galadrim.fr",
    user: { id: "u1", name: "Adam" },
    deviceId: "d",
    retryAt: null,
    lastError: null,
    projects: [],
  };
  const opened: TabTarget[] = [];
  render(<UserMenu viewer="adam" onOpen={(t) => opened.push(t)} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Menu de adam" }));
  const menu = await screen.findByRole("menu", { name: "Menu de adam" });
  expect(await within(menu).findByText("adam")).toBeTruthy();
  expect(await within(menu).findByText("Adam · sync.galadrim.fr")).toBeTruthy();
  await user.click(within(menu).getByRole("menuitem", { name: "Thème" }));
  const system = await screen.findByRole("menuitemradio", { name: "Système" });
  expect(system.getAttribute("aria-checked")).toBe("true");
  screen.getByRole("menuitemradio", { name: "Sombre" }).focus();
  await user.keyboard("{Enter}");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  await user.click(screen.getByRole("button", { name: "Menu de adam" }));
  await user.click(await screen.findByRole("menuitem", { name: "Sessions" }));
  await user.click(screen.getByRole("button", { name: "Menu de adam" }));
  await user.click(await screen.findByRole("menuitem", { name: "Paramètres" }));
  expect(opened).toEqual([
    { kind: "screen", screen: "security" },
    { kind: "screen", screen: "general" },
  ]);
});

test("without a sync account only the name shows", async () => {
  render(<UserMenu viewer="adam" onOpen={() => {}} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Menu de adam" }));
  const menu = await screen.findByRole("menu", { name: "Menu de adam" });
  expect(await within(menu).findByText("adam")).toBeTruthy();
  expect(within(menu).queryByText(/·/)).toBeNull();
});
