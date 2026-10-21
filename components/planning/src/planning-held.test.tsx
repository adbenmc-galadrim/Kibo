import { afterEach, beforeEach, expect, setSystemTime, spyOn, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cardIn, column, setupPlanning } from "./planning-kit";
import { addHeldStep, HOLD_RULE, seedPlanning, seedPlanningHeld, TODAY } from "./test-seed";

beforeEach(() => setSystemTime(new Date(`${TODAY}T14:52:00`)));
afterEach(() => setSystemTime());

const tones = (card: HTMLElement) =>
  Array.from(card.querySelectorAll('[data-slot="step-cases"] > span')).map((s) =>
    s.getAttribute("data-tone"),
  );

const heldSection = async () =>
  within(await column("À planifier")).findByRole("region", { name: /^En attente/ });

test("À planifier ends with the steps on hold, and feature cards show them in cyan", async () => {
  setupPlanning(TODAY, { seedWith: seedPlanningHeld });
  expect((await heldSection()).getAttribute("aria-label")).toBe("En attente (3)");
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

test("without a step on hold, À planifier has no section En attente", async () => {
  setupPlanning();
  const backlog = await column("À planifier");
  expect(within(backlog).queryByRole("region")).toBeNull();
  expect(within(backlog).queryByText(/En attente/)).toBeNull();
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
  const card = within(await heldSection()).getByRole("article");
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
  await waitFor(() =>
    expect(within(screen.getByRole("region", { name: "À planifier" })).queryByRole("region")).toBeNull(),
  );
});

test("read only, the steps on hold have no menu", async () => {
  const { m } = setupPlanning(TODAY, { seedWith: seedPlanningHeld });
  act(() => m.setAccess("read-only"));
  const section = await heldSection();
  await waitFor(() => expect(within(section).queryByRole("button", { name: /^Actions de / })).toBeNull());
});

test("the legend names the held case, in cyan, right after the blocked one", async () => {
  setupPlanning();
  const legend = (await screen.findByText("étape livrée")).closest("footer");
  if (!(legend instanceof HTMLElement)) throw new Error("no legend");
  const entries = Array.from(legend.querySelectorAll("span > span[aria-hidden]")).map((swatch) => [
    swatch.parentElement?.textContent,
    swatch.className.includes("bg-(--tracking-hold)"),
  ]);
  expect(entries.slice(3, 5)).toEqual([
    ["bloquée", false],
    ["en attente", true],
  ]);
});
