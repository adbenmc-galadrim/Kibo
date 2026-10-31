import { afterEach, beforeEach, expect, setSystemTime, spyOn, test } from "bun:test";
import { act, screen, waitFor, within } from "@testing-library/react";
import { cardIn, column, type PlanningSetup, setupPlanning } from "./planning-kit";
import { seedPlanningHeld, TODAY } from "./test-seed";

beforeEach(() => {
  setSystemTime(new Date(`${TODAY}T14:52:00`));
  localStorage.clear();
});
afterEach(() => setSystemTime());

function moveF9(m: PlanningSetup["m"], seeded: PlanningSetup["seeded"]) {
  act(() => {
    m.run({
      method: "setTicketSprint",
      ticketId: seeded.features.f9.root.id,
      sprintId: seeded.sprints.s44.id,
    });
  });
}

const loadLine = async (name: RegExp) => within(await column(name)).getByText(/étapes? prévues? · capacité/);

test("the band sits above the columns, out of À planifier", async () => {
  setupPlanning(TODAY, { seedWith: seedPlanningHeld });
  const band = await screen.findByRole("region", { name: "En attente (3)" });
  const backlog = await column("À planifier");
  expect(within(backlog).queryByRole("region")).toBeNull();
  expect(band.compareDocumentPosition(backlog) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("À planifier holds features only and reads Aucune fonctionnalité à planifier when empty", async () => {
  const { m, seeded } = setupPlanning(TODAY, { seedWith: seedPlanningHeld });
  const backlog = await column("À planifier");
  expect(within(backlog).queryByText("Aucune fonctionnalité à planifier.")).toBeNull();
  expect(within(backlog).queryByRole("article")).toBeNull();
  expect(await cardIn("À planifier", "F9")).toBeTruthy();
  moveF9(m, seeded);
  await waitFor(() => expect(within(backlog).getByText("Aucune fonctionnalité à planifier.")).toBeTruthy());
});

test("a sprint column shows a single alert box", async () => {
  setupPlanning(TODAY, { tracking: { openLimit: 1 } });
  const s42 = await column(/^S42 /);
  const notes = within(s42).getAllByRole("note");
  expect(notes.length).toBe(1);
  expect(notes[0]?.className).toContain("text-(--tracking-amber)");
  expect(notes[0]?.textContent).toMatch(/ne tiendra pas \(.+\) · 2 en cours pour une limite de 1$/);
});

test("the capacity line of S44 is neutral while S42 over capacity is amber", async () => {
  setupPlanning();
  expect((await loadLine(/^S42 /)).className).toContain("text-(--tracking-amber)");
  expect((await loadLine(/^S44 /)).className).toContain("text-(--tracking-dim)");
});

function reducedMotion(reduce: boolean) {
  return spyOn(window, "matchMedia").mockImplementation(
    (query: string) => ({ matches: reduce && query.includes("reduce"), media: query }) as MediaQueryList,
  );
}

async function animationsOfAMove(reduce: boolean): Promise<number> {
  const media = reducedMotion(reduce);
  const animate = spyOn(Element.prototype, "animate");
  const { m, seeded } = setupPlanning();
  await cardIn(/^S44 /, "F7");
  moveF9(m, seeded);
  await cardIn(/^S44 /, "F9");
  await new Promise((done) => setTimeout(done, 20));
  const calls = animate.mock.calls.length;
  animate.mockRestore();
  media.mockRestore();
  return calls;
}

test("a card entering a column is animated", async () => {
  expect(await animationsOfAMove(false)).toBeGreaterThan(0);
});

test("with reduced motion a card enters a column without animation", async () => {
  expect(await animationsOfAMove(true)).toBe(0);
});
