import { afterEach, beforeEach, expect, setSystemTime, spyOn, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cardIn, column, setupPlanning } from "./planning-kit";
import { addHeldStep, HOLD_RULE, seedPlanning, seedPlanningHeld, TODAY } from "./test-seed";

beforeEach(() => setSystemTime(new Date(`${TODAY}T14:52:00`)));
afterEach(() => setSystemTime());

const tones = (card: HTMLElement) =>
  Array.from(card.querySelectorAll('[data-slot="step-cases"] > span')).map((s) =>
    s.getAttribute("data-tone"),
  );

beforeEach(() => localStorage.clear());

const heldBand = () => screen.findByRole("region", { name: /^En attente/ });

test("The band holds the steps on hold, and feature cards show them in cyan", async () => {
  setupPlanning(TODAY, { seedWith: seedPlanningHeld });
  expect((await heldBand()).getAttribute("aria-label")).toBe("En attente (3)");
  const f4 = await cardIn(/^S42 /, "F4");
  expect(within(f4).getByText("livrée · 1 en attente")).toBeTruthy();
  expect(tones(f4)).toEqual(["done", "done", "done", "hold", "todo"]);
  expect(within(f4).getByText("3/4 étapes")).toBeTruthy();
  expect(within(f4).getByText("KIB-16")).toBeTruthy();
  const f5 = await cardIn(/^S42 /, "F5");
  expect(tones(f5)).toEqual(["done", "review", "hold", "hold", "hold"]);
  expect(within(f5).getByText("1/2 étapes")).toBeTruthy();
  expect(within(f5).getByText("KIB-21")).toBeTruthy();
  expect(tones(await cardIn(/^S44 /, "F7"))).toEqual(["todo", "hold", "todo", "todo", "todo"]);
});

test("without a step on hold, there is no band En attente", async () => {
  setupPlanning();
  await column("À planifier");
  expect(screen.queryByRole("region", { name: /^En attente/ })).toBeNull();
});

test("Reprendre lifts the hold of the step", async () => {
  const { m } = setupPlanning(TODAY, { seedWith: seedPlanningHeld });
  const sent = spyOn(m.backend, "run");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions de KIB-21" }));
  await user.click(await screen.findByRole("menuitem", { name: "Reprendre" }));
  const step = m.snapshot().tickets.find((t) => t.keyLabel === "KIB-21");
  expect(sent.mock.calls.map(([cmd]) => cmd)).toEqual([
    { method: "setHold", ticketId: step?.id ?? "", reason: null },
  ]);
  await waitFor(() => expect(screen.getByRole("region", { name: "En attente (2)" })).toBeTruthy());
  expect(screen.queryByRole("article", { name: /^KIB-21 / })).toBeNull();
  expect(m.toasts).toContain("KIB-21 reprise");
});

test("Reprendre dans ▸ S43 lifts the hold, then plans its feature from an ended sprint", async () => {
  let held = "";
  const { m, seeded } = setupPlanning(TODAY, {
    seedWith: (run) => {
      const s = seedPlanning(run);
      held = addHeldStep(run, s.features.f2.root, HOLD_RULE).id;
      return s;
    },
  });
  const sent = spyOn(m.backend, "run");
  const user = userEvent.setup();
  const card = within(await heldBand()).getByRole("article");
  await user.click(within(card).getByRole("button", { name: /^Actions de / }));
  await user.click(await screen.findByRole("menuitem", { name: "Reprendre dans" }));
  const item = await screen.findByRole("menuitem", { name: "S43 · Import et contrats" });
  item.focus();
  await user.keyboard("{Enter}");
  await waitFor(() => expect(sent.mock.calls.length).toBe(2));
  const sentCommands: ProjectCommand[] = sent.mock.calls.map(([cmd]) => cmd);
  expect(sentCommands).toEqual([
    { method: "setHold", ticketId: held, reason: null },
    { method: "setTicketSprint", ticketId: seeded.features.f2.root.id, sprintId: seeded.sprints.s43.id },
  ]);
  expect(await cardIn(/^S43 /, "F2")).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole("region", { name: /^En attente/ })).toBeNull());
});

test("the planning has no legend toggle", async () => {
  setupPlanning();
  await screen.findByRole("region", { name: /^S42/ });
  expect(screen.queryByRole("button", { name: "Légende" })).toBeNull();
});
