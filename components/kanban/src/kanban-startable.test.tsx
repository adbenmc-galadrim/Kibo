import { expect, test } from "bun:test";
import type { RunPeek } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { seed } from "./test-seed";

const PEEK: RunPeek = {
  runId: "r1",
  label: "opus-dev-2",
  profileName: "opus-dev",
  state: "waiting_input",
  ticketKey: "KIB-4",
  ticketTitle: "Récepteur",
  step: { index: 2, total: 5, title: "Corriger la validation" },
  lastMessage: "Quel format de date ?",
  waiting: true,
};

const setup = () => {
  const m = createMockSdk(manifest, { seed, viewer: "adam", peeks: { r1: PEEK } });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const queueKib5 = (m: ReturnType<typeof setup>) => {
  const id = m.snapshot().tickets.find((t) => t.key === "KIB-5")?.id ?? "";
  act(() => m.setRuns([{ ticketId: id, runId: "r5", label: "opus-dev", state: "queued", position: 1 }]));
};

const card = async (key: string) => {
  const found = (await screen.findByText(key)).closest("article");
  if (!(found instanceof HTMLElement)) throw new Error(`no card ${key}`);
  return found;
};

test("screen 188k: a startable card shows a neutral 'Démarrable' badge, the others none", async () => {
  const m = setup();
  queueKib5(m);
  const badge = within(await card("KIB-1")).getByText("Démarrable");
  expect(badge.getAttribute("data-slot")).toBe("badge");
  expect(badge.getAttribute("data-variant")).toBe("outline");
  expect(badge.className).toContain("zinc");
  expect(badge.className).toContain("bg-background");
  expect(badge.className).not.toContain("orange");
  expect(badge.className).not.toContain("brand");
  expect(within(await card("KIB-5")).queryByText("Démarrable")).toBeNull();
  expect(within(await card("KIB-2")).queryByText("Démarrable")).toBeNull();
  expect(within(await card("KIB-4")).queryByText("Démarrable")).toBeNull();
  act(() => m.setRuns([]));
  expect(await within(await card("KIB-5")).findByText("Démarrable")).toBeTruthy();
});

test("the 'Démarrables' toggle sits after the label menu, narrows the board and is reset by 'Tout afficher'", async () => {
  queueKib5(setup());
  const user = userEvent.setup();
  const toggle = await screen.findByRole("button", { name: "Démarrables" });
  const labels = screen.getByRole("button", { name: "Étiquette : toutes" });
  expect(labels.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  await user.click(toggle);
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  expect(await screen.findByText("1 / 6 · Moi + agents")).toBeTruthy();
  expect(screen.queryByText("KIB-2")).toBeNull();
  await user.click(screen.getByRole("radio", { name: "Tous" }));
  expect(await screen.findByText("2 / 6 · Tous")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "4 masqués · Tout afficher" }));
  expect(await screen.findByText("6 / 6 · Tous")).toBeTruthy();
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
});

test("a live run on a card is an agent mention: hover peeks the run, click opens it", async () => {
  const m = setup();
  const id = m.snapshot().tickets.find((t) => t.key === "KIB-4")?.id ?? "";
  act(() =>
    m.setRuns([{ ticketId: id, runId: "r1", label: "opus-dev-2", state: "waiting_input", position: null }]),
  );
  const mention = await within(await card("KIB-4")).findByRole("button", { name: "opus-dev-2" });
  const badge = mention.closest("[data-slot=badge]");
  expect(badge?.textContent).toBe("opus-dev-2· Attend");
  expect(badge?.querySelector("[data-state]")?.getAttribute("data-state")).toBe("waiting_input");
  fireEvent.pointerEnter(mention);
  expect(await screen.findByText("2/5 · Corriger la validation")).toBeTruthy();
  expect(screen.getByText("Quel format de date ?")).toBeTruthy();
  expect(m.used).toContain("read:run");
  fireEvent.click(mention);
  expect(m.openedRuns).toEqual(["r1"]);
});

test("without a live run, the assigned agent stays a plain badge", async () => {
  setup();
  const kib5 = await card("KIB-5");
  expect(within(kib5).getByText("opus-dev")).toBeTruthy();
  expect(within(kib5).queryByRole("button", { name: "opus-dev" })).toBeNull();
});
