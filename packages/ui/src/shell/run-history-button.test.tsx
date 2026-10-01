import { afterEach, beforeEach, expect, test } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentsFixture, NOW, runFixture } from "../agents/fixtures";
import { RunHistoryButton } from "./RunHistoryButton";

const MIN = 60_000;
const state = () => {
  const s = agentsFixture();
  s.runs = [
    runFixture({
      id: "r3",
      label: "opus-dev-2",
      ticketKey: "KIB-14",
      ticketTitle: "Vue graphe",
      state: "waiting_input",
      stateSince: NOW - 3 * MIN,
      endedAt: null,
      question: "Quel schéma ?",
    }),
    runFixture({
      id: "r2",
      label: "sonnet-review",
      ticketKey: "KIB-11",
      ticketTitle: "Revue",
      state: "done",
      stateSince: 0,
      endedAt: NOW - 41 * MIN,
    }),
    runFixture({
      id: "r4",
      label: "opus-dev-1",
      ticketKey: "KIB-9",
      ticketTitle: "Sidecar",
      state: "failed",
      stateSince: 0,
      endedAt: NOW - 2 * 60 * MIN,
    }),
    runFixture({ id: "r1", state: "running", stateSince: NOW - MIN }),
  ];
  return s;
};
let restoreNotification = () => {};
function fakeNotificationPermission(permission: NotificationPermission) {
  const saved = globalThis.Notification;
  Object.assign(globalThis, {
    Notification: Object.assign(function FakeNotification() {}, {
      permission,
      requestPermission: async () => permission,
    }),
  });
  restoreNotification = () => Object.assign(globalThis, { Notification: saved });
}
beforeEach(() => localStorage.clear());
afterEach(() => {
  localStorage.clear();
  restoreNotification();
  restoreNotification = () => {};
});

test("the bell counts unseen runs, lists the history on open and marks it seen (screen 111)", async () => {
  const opened: string[] = [];
  render(
    <RunHistoryButton
      agents={state()}
      notifications="native"
      now={NOW}
      onOpenRun={(id) => opened.push(id)}
    />,
  );
  const bell = screen.getByRole("button", { name: "Historique des runs · 3 nouveaux" });
  expect(bell.textContent).toContain("3");
  await userEvent.setup().click(bell);
  const menu = await screen.findByRole("menu", { name: "Historique des runs" });
  const items = await within(menu).findAllByRole("menuitem");
  expect(items.map((i) => i.textContent)).toEqual([
    "opus-dev-2 · KIB-14 · Attend une réponse · il y a 3 minRépondre",
    "sonnet-review · KIB-11 · Terminé · il y a 41 min",
    "opus-dev-1 · KIB-9 · Échec · il y a 2 h",
  ]);
  expect(within(menu).queryByRole("button", { name: "Activer les notifications" })).toBeNull();
  await userEvent.setup().click(items[0] as HTMLElement);
  expect(opened).toEqual(["r3"]);
  expect(localStorage.getItem("kibo.runs.seenAt")).toBe(String(NOW));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Historique des runs" }).textContent).not.toContain("3"),
  );
});

test("without daemon state the bell is inert; without history the list says so; the browser gets the notification switch", async () => {
  fakeNotificationPermission("default");
  const { unmount } = render(
    <RunHistoryButton agents={null} notifications="browser" now={NOW} onOpenRun={() => {}} />,
  );
  expect(screen.getByRole("button", { name: "Historique des runs" }).hasAttribute("disabled")).toBe(true);
  unmount();
  const empty = agentsFixture();
  empty.runs = [];
  render(<RunHistoryButton agents={empty} notifications="browser" now={NOW} onOpenRun={() => {}} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Historique des runs" }));
  const menu = await screen.findByRole("menu", { name: "Historique des runs" });
  expect(await within(menu).findByText("Aucun run pour l'instant.")).toBeTruthy();
  const enable = within(menu).getByRole("button", { name: "Activer les notifications" });
  expect(enable.textContent).toBe("Activer les notifications");
});

test("once notifications are granted or denied, the bell menu has no footer", async () => {
  for (const permission of ["granted", "denied"] as const) {
    fakeNotificationPermission(permission);
    const { unmount } = render(
      <RunHistoryButton agents={state()} notifications="browser" now={NOW} onOpenRun={() => {}} />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /Historique des runs/ }));
    const menu = await screen.findByRole("menu", { name: "Historique des runs" });
    await within(menu).findAllByRole("menuitem");
    expect(within(menu).queryByRole("separator")).toBeNull();
    expect(within(menu).queryByRole("button")).toBeNull();
    expect(menu.querySelector("svg.lucide-bell")).toBeNull();
    unmount();
    restoreNotification();
  }
});
