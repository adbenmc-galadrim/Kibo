import { beforeEach, expect, test } from "bun:test";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../App";
import { kanbanInstance, relayedCommands, siloFixture, siloSnapshot } from "../../screen-fixture";

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "#/p/silo/kanban";
});

test("KanbanScreen mounts the kanban instance of the project with the remote backend", async () => {
  const { runtime } = await siloFixture(siloSnapshot([kanbanInstance({ filter: "mine-and-agents" })]));
  render(<App runtime={runtime} />);
  const review = await screen.findByRole("region", { name: "En review" });
  expect(within(review).getByRole("article", { name: /Conflits de saisie/ })).toBeTruthy();
  expect(screen.queryByRole("article", { name: /Relance des impayés/ })).toBeNull();
  expect(review.closest(".\\@container")).not.toBeNull();
});

test("a project without a kanban instance gets phone:kanban with the default config", async () => {
  const { runtime } = await siloFixture();
  render(<App runtime={runtime} />);
  expect(await screen.findByRole("article", { name: /Relance des impayés/ })).toBeTruthy();
});

test("the board shows the last state while the Mac is off, without asking the server", async () => {
  const { runtime, api } = await siloFixture(siloSnapshot(), {
    connectivity: { macOnline: false, phoneOnline: true },
  });
  render(<App runtime={runtime} />);
  expect(await screen.findByRole("article", { name: /Conflits de saisie/ })).toBeTruthy();
  expect(api.calls.filter((c) => c === "request")).toEqual([]);
});

test("moving a card from the card menu relays command setStatus", async () => {
  const snapshot = siloSnapshot();
  const { runtime, api } = await siloFixture(snapshot);
  render(<App runtime={runtime} />);
  const user = userEvent.setup();
  const card = await screen.findByRole("article", { name: /Passage à Expo SDK 54/ });
  const key = card.getAttribute("data-key") ?? "";
  await user.click(within(card).getByRole("button", { name: `Actions ${key}` }));
  await user.click(await screen.findByRole("menuitem", { name: "Déplacer vers" }));
  await user.pointer({
    keys: "[MouseLeft]",
    target: await screen.findByRole("menuitem", { name: "En cours" }),
  });
  const ticketId = snapshot.tickets.find((t) => t.title === "Passage à Expo SDK 54")?.id;
  await waitFor(() =>
    expect(relayedCommands(api.requests)).toContainEqual({
      method: "setStatus",
      ticketId,
      statusId: "in_progress",
    }),
  );
  expect(api.requests).toContainEqual(
    expect.objectContaining({ method: "command", projectId: "silo", instanceId: "phone:kanban" }),
  );
});

test("a long press on a card opens its menu, the fallback of the touch drag", async () => {
  const { runtime } = await siloFixture();
  render(<App runtime={runtime} />);
  const card = await screen.findByRole("article", { name: /Passage à Expo SDK 54/ });
  fireEvent.pointerDown(card, { pointerType: "touch", isPrimary: true, button: 0, clientX: 40, clientY: 40 });
  const move = await screen.findByRole("menuitem", { name: "Déplacer vers" }, { timeout: 1500 });
  expect(move).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "Supprimer…" })).toBeTruthy();
});
