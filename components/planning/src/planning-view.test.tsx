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
  const merged = /ne tiendra pas \(.+\) · 2 en cours pour une limite de 1$/;
  await waitFor(() => expect(within(s42).getByRole("note").textContent).toMatch(merged));
  expect(within(s42).getAllByRole("note").length).toBe(1);
  expect(within(s42).getByRole("note").className).toContain("text-(--tracking-amber)");
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

async function cardListIsWatched(reduce: boolean): Promise<boolean> {
  const media = reducedMotion(reduce);
  const observe = spyOn(MutationObserver.prototype, "observe");
  try {
    setupPlanning();
    const list = (await cardIn(/^S44 /, "F7")).closest("[data-slot=planning-cards]");
    expect(list).not.toBeNull();
    return observe.mock.calls.some(([target]) => target === list);
  } finally {
    observe.mockRestore();
    media.mockRestore();
  }
}

test("auto-animate watches the cards of a column", async () => {
  expect(await cardListIsWatched(false)).toBe(true);
});

test("with reduced motion auto-animate leaves the cards of a column alone", async () => {
  expect(await cardListIsWatched(true)).toBe(false);
});

test("columns are 85 % wide and snap below xl, the backlog stops sticking", async () => {
  setupPlanning();
  const backlog = await column("À planifier");
  const s42 = await column(/^S42 /);
  const board = s42.parentElement;
  expect(board?.closest(".\\@container")).not.toBeNull();
  expect(board?.className.split(" ")).toEqual(
    expect.arrayContaining(["@max-xl:snap-x", "@max-xl:snap-mandatory"]),
  );
  for (const c of [backlog, s42])
    expect(c.className.split(" ")).toEqual(expect.arrayContaining(["@max-xl:w-[85%]", "@max-xl:snap-start"]));
  expect(backlog.className.split(" ")).toEqual(expect.arrayContaining(["sticky", "@max-xl:static"]));
  expect(within(s42).getByText("S42").closest("div.flex-1")?.className.split(" ")).toContain("w-[214px]");
  const card = await cardIn(/^S42 /, "F3");
  expect(card.className.split(" ")).toEqual(
    expect.arrayContaining(["touch-none", "@max-xl:touch-manipulation"]),
  );
});

test("on a phone the header actions are 44 px targets", async () => {
  setupPlanning();
  const add = await screen.findByRole("button", { name: "Fonctionnalité" });
  expect(add.className.split(" ")).toContain("@max-xl:h-11");
  expect(screen.getByRole("button", { name: "Sprint" }).className.split(" ")).toContain("@max-xl:h-11");
});
