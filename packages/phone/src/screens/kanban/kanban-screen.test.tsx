import { afterEach, beforeEach, expect, type Mock, spyOn, test } from "bun:test";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../App";
import { putBlob } from "../../fake-server-api";
import { kanbanInstance, relayedCommands, siloFixture, siloSnapshot } from "../../screen-fixture";
import { sealJson } from "../../test-kit";

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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

let media: Mock<typeof window.matchMedia> | null = null;
afterEach(() => {
  media?.mockRestore();
  media = null;
});

function touchDevice() {
  media = spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query === "(pointer: coarse)",
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

async function holdStill(card: HTMLElement, ms: number) {
  const touch = new Touch({ identifier: 1, target: card, clientX: 40, clientY: 40 });
  fireEvent.pointerDown(card, { pointerType: "touch", isPrimary: true, button: 0, clientX: 40, clientY: 40 });
  fireEvent.touchStart(card, { touches: [touch], changedTouches: [touch] });
  await act(() => wait(ms));
  fireEvent.pointerUp(card, { pointerType: "touch", clientX: 40, clientY: 40 });
  fireEvent.touchEnd(card, { touches: [], changedTouches: [touch] });
  await act(() => wait(100));
}

async function openSheet(title: RegExp) {
  const card = await screen.findByRole("article", { name: title });
  await holdStill(card, 700);
  return { card, sheet: await screen.findByRole("dialog") };
}

test("a still finger for 700 ms opens the card sheet and never starts a drag", async () => {
  touchDevice();
  const { runtime } = await siloFixture();
  render(<App runtime={runtime} />);
  const { card, sheet } = await openSheet(/Passage à Expo SDK 54/);
  const key = card.getAttribute("data-key") ?? "";
  expect(within(sheet).getByRole("heading").textContent).toBe(`${key}Passage à Expo SDK 54`);
  expect(card.className).not.toContain("opacity-40");
  expect(card.getAttribute("aria-pressed")).not.toBe("true");
  const rows = within(sheet)
    .getAllByRole("button")
    .map((b) => b.textContent);
  expect(rows).toEqual(
    expect.arrayContaining([
      "Déplacer vers…À faire",
      "Lancer dans T3",
      "Ouvrir la fiche",
      "Bloquer…avec un motif",
      "Retirer",
    ]),
  );
  for (const b of within(sheet).getAllByRole("button")) expect(b.className).toContain("min-h-11");
  expect(within(sheet).getByRole("button", { name: "Retirer" }).className).toContain("text-destructive");
});

test("the sheet moves the card through the relayed setStatus", async () => {
  touchDevice();
  const snapshot = siloSnapshot();
  const { runtime, api } = await siloFixture(snapshot);
  render(<App runtime={runtime} />);
  const { sheet } = await openSheet(/Passage à Expo SDK 54/);
  const user = userEvent.setup();
  await user.click(within(sheet).getByRole("button", { name: /Déplacer vers…/ }));
  await user.click(within(sheet).getByRole("button", { name: /En cours/ }));
  const ticketId = snapshot.tickets.find((t) => t.title === "Passage à Expo SDK 54")?.id;
  await waitFor(() =>
    expect(relayedCommands(api.requests)).toContainEqual({
      method: "setStatus",
      ticketId,
      statusId: "in_progress",
    }),
  );
});

test("Mac on and T3 available, Lancer dans T3 is active with the folder name the Mac sends, then relays t3.launch", async () => {
  touchDevice();
  const { runtime, api } = await siloFixture();
  api.reply = (req) => {
    const kind = typeof req === "object" && req !== null && "call" in req ? JSON.stringify(req.call) : "";
    if (kind.includes("t3.preview"))
      return {
        ok: true,
        result: {
          argv: [],
          command: 't3 thread start silo "/full-delivery SILO-6"',
          folder: "silo",
          warning: null,
        },
      };
    return { ok: true, result: null };
  };
  render(<App runtime={runtime} />);
  const { card, sheet } = await openSheet(/Passage à Expo SDK 54/);
  const key = card.getAttribute("data-key") ?? "";
  const user = userEvent.setup();
  const launch = within(sheet).getByRole("button", { name: "Lancer dans T3" });
  expect(launch.hasAttribute("disabled")).toBe(false);
  await user.click(launch);
  const dialog = await screen.findByRole("dialog", { name: `Lancer ${key} dans T3` });
  const confirm = within(dialog).getByRole("button", { name: "Lancer" });
  await waitFor(() => expect(confirm.hasAttribute("disabled")).toBe(false));
  expect(dialog.textContent).toContain("silo");
  expect(dialog.textContent).not.toContain("/Users");
  await user.click(confirm);
  await waitFor(() =>
    expect(api.requests).toContainEqual(
      expect.objectContaining({ method: "componentCall", call: { kind: "t3.launch", ticketKey: key } }),
    ),
  );
}, 15_000);

test("without a linked folder Lancer dans T3 stays in the sheet, greyed with its reason", async () => {
  touchDevice();
  const snapshot = siloSnapshot();
  const { runtime } = await siloFixture({ ...snapshot, meta: { ...snapshot.meta, folder: null } });
  render(<App runtime={runtime} />);
  const { sheet } = await openSheet(/Passage à Expo SDK 54/);
  const launch = within(sheet).getByRole("button", { name: /Lancer dans T3/ });
  expect(launch.hasAttribute("disabled")).toBe(true);
  expect(launch.textContent).toContain("Relie le dossier du projet");
});

test("with T3 not running Lancer dans T3 is greyed and says why", async () => {
  touchDevice();
  const fixture = await siloFixture();
  putBlob(
    fixture.api,
    await sealJson(fixture.keys, "silo", "t3", { available: false, reason: "server-down", bin: "t3" }),
  );
  render(<App runtime={fixture.runtime} />);
  const { sheet } = await openSheet(/Passage à Expo SDK 54/);
  const launch = await within(sheet).findByRole("button", { name: /Lancer dans T3/ });
  await waitFor(() => expect(launch.hasAttribute("disabled")).toBe(true));
  expect(launch.textContent).toContain("T3 Code n'est pas lancé");
});

test("Mac off, the board is read-only with the band reason and comes back writable live", async () => {
  const fixture = await siloFixture(siloSnapshot(), {
    connectivity: { macOnline: false, phoneOnline: true },
  });
  render(<App runtime={fixture.runtime} />);
  const user = userEvent.setup();
  const card = await screen.findByRole("article", { name: /Passage à Expo SDK 54/ });
  expect(card.getAttribute("aria-disabled")).toBe("true");
  const key = card.getAttribute("data-key") ?? "";
  await user.click(within(card).getByRole("button", { name: `Actions ${key}` }));
  const remove = await screen.findByRole("menuitem", { name: /Supprimer….*Mac éteint/ });
  expect(remove.getAttribute("aria-disabled")).toBe("true");
  await user.keyboard("{Escape}");
  act(() => fixture.presence.set({ macOnline: true, phoneOnline: true }));
  await waitFor(() => expect(card.getAttribute("aria-disabled")).toBe("false"));
});
