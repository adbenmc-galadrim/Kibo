import { afterEach, expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { HOLD_REASONS, heldSeed, trackingSeed } from "./test-seed";

afterEach(cleanup);

const setup = (seed: (run: (cmd: ProjectCommand) => unknown) => void = heldSeed) => {
  const m = createMockSdk(manifest, { seed, viewer: "adam", today: "2026-10-16" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const card = async (title: string) => {
  const found = (await screen.findByText(title)).closest("article");
  if (!(found instanceof HTMLElement)) throw new Error(`no card ${title}`);
  return found;
};

const column = (name: string) => screen.getByRole("region", { name });

test("a step on hold keeps its column and carries ⏸ with its short reason, the whole one on hover", async () => {
  setup();
  const conflicts = await card("Conflits de saisie");
  expect(within(column("En review")).getByText("Conflits de saisie")).toBeTruthy();
  const badge = within(conflicts).getByRole("note", { name: `En attente : ${HOLD_REASONS.merge}` });
  expect(badge.textContent).toBe("Règle de fusion à valide…");
  expect(badge.getAttribute("title")).toBe(HOLD_REASONS.merge);
  expect(badge.querySelector("svg")).toBeTruthy();
  const sending = await card("Écran d'envoi hors ligne");
  expect(within(sending).getByRole("note").textContent).toBe("Serveur MinIO de recette…");
});

test("a step on hold by dependency says which step it waits for, instead of its own « attend » badges", async () => {
  setup();
  const tests = await card("Tests E2E de l'envoi");
  expect(within(tests).getByRole("note", { name: /^En attente de / }).textContent).toMatch(
    /^attend \S+-\d+$/,
  );
  const demo = await card("Démo · F5");
  const waits = within(demo).getAllByText(/^attend /);
  expect(waits.map((w) => w.textContent)).toEqual([within(tests).getByRole("note").textContent]);
});

test("the « En attente » filter counts own and dependency holds and keeps only those cards", async () => {
  setup();
  const user = userEvent.setup();
  const held = await screen.findByRole("button", { name: "En attente" });
  expect(within(held).getByText("4")).toBeTruthy();
  expect(held.querySelector(".lucide-pause")?.getAttribute("class")).toContain("text-(--tracking-hold)");
  await user.click(held);
  expect(await screen.findByText("4 tickets · En attente")).toBeTruthy();
  expect(screen.getByText("Conflits de saisie")).toBeTruthy();
  expect(screen.getByText("Démo · F5")).toBeTruthy();
  expect(screen.queryByText("Route d'envoi des photos")).toBeNull();
});

test("« Démarrable » leaves out a step on hold that would start otherwise", async () => {
  const m = setup();
  const user = userEvent.setup();
  await card("Écran d'envoi hors ligne");
  await user.click(screen.getByRole("button", { name: "Démarrable" }));
  expect(screen.queryByText("Écran d'envoi hors ligne")).toBeNull();
  const sending = m.snapshot().tickets.find((t) => t.title === "Écran d'envoi hors ligne");
  act(() => {
    m.run({ method: "setHold", ticketId: sending?.id ?? "", reason: null });
  });
  expect(await screen.findByText("Écran d'envoi hors ligne")).toBeTruthy();
});

test("without any step on hold there is no « En attente » filter, nor any ⏸ badge", async () => {
  setup(trackingSeed);
  await card("Conflits de saisie");
  expect(screen.queryByRole("button", { name: "En attente" })).toBeNull();
  expect(screen.queryByRole("note", { name: /^En attente/ })).toBeNull();
});

test("the filter goes away with the last hold, and the board shows every card again", async () => {
  const m = setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "En attente" }));
  expect(await screen.findByText("4 tickets · En attente")).toBeTruthy();
  for (const title of ["Conflits de saisie", "Écran d'envoi hors ligne"]) {
    const step = m.snapshot().tickets.find((t) => t.title === title);
    act(() => {
      m.run({ method: "setHold", ticketId: step?.id ?? "", reason: null });
    });
  }
  expect(await screen.findByText("5 tickets · Tous")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "En attente" })).toBeNull();
});

test("a new hold after the filter went away shows the button again, not pressed", async () => {
  const m = setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "En attente" }));
  const steps = ["Conflits de saisie", "Écran d'envoi hors ligne"].map(
    (title) => m.snapshot().tickets.find((t) => t.title === title)?.id ?? "",
  );
  for (const ticketId of steps) {
    act(() => {
      m.run({ method: "setHold", ticketId, reason: null });
    });
  }
  expect(await screen.findByText("5 tickets · Tous")).toBeTruthy();
  act(() => {
    m.run({ method: "setHold", ticketId: steps[0] ?? "", reason: HOLD_REASONS.merge, since: "2026-10-16" });
  });
  const button = await screen.findByRole("button", { name: "En attente" });
  expect(button.getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByText("5 tickets · Tous")).toBeTruthy();
});
