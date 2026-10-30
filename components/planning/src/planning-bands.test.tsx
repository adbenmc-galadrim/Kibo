import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { bandsToday, startsIn } from "./bands-model";
import { column, setupPlanning } from "./planning-kit";
import { TODAY } from "./test-seed";

const DAY_AFTER = "2026-10-17";

beforeEach(() => setSystemTime(new Date(`${TODAY}T14:52:00`)));
afterEach(() => setSystemTime());

const bands = { config: { layout: "bands" } };
const timeline = () => screen.findByRole("region", { name: "Frise des fonctionnalités par sprint" });
const rowKeys = (root: HTMLElement) =>
  Array.from(root.querySelectorAll("[data-feature]")).map((r) => r.getAttribute("data-feature"));
const tones = (root: HTMLElement, key: string) =>
  Array.from(root.querySelectorAll(`[data-feature="${key}"] [data-tone]`)).map((c) =>
    c.getAttribute("data-tone"),
  );

test("the bands toggle is active and keeps the layout of the instance", async () => {
  const { m } = setupPlanning();
  const toggle = await screen.findByRole("button", { name: "Bandes" });
  expect(toggle.hasAttribute("disabled")).toBe(false);
  await userEvent.setup().click(toggle);
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Colonnes" }).getAttribute("aria-pressed")).toBe("false");
  expect(await timeline()).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Colonnes" }));
  expect(await column(/^S42 /)).toBeTruthy();
  expect(m.configPatches).toEqual([{ layout: "bands" }, { layout: "columns" }]);
});

test("bands: one column per sprint then the backlog, one row per open feature", async () => {
  setupPlanning(TODAY, bands);
  const frise = await timeline();
  for (const code of ["S41", "S42", "S43", "S44", "À planifier"])
    expect(within(frise).getByText(code)).toBeTruthy();
  const unplanned = within(frise).getByText("À planifier");
  expect(unplanned.className).not.toContain("font-mono");
  expect(unplanned.parentElement?.textContent).toBe("À planifier");
  expect(rowKeys(frise)).toEqual(["F4", "F5", "F6", "F8", "F7", "F9"]);
  expect(frise.querySelector("[data-current]")?.textContent).toContain("S42");
  expect(tones(frise, "F4")).toEqual(["done", "done", "done", "review", "todo"]);
  expect(tones(frise, "F5")).toEqual(["done", "review", "progress", "todo", "todo"]);
  expect(within(frise).queryByText("glisse en S43")).toBeNull();
  expect(within(frise).getByText("bloquée · Q14")).toBeTruthy();
  expect(screen.getByText("Glisse en Colonnes pour planifier")).toBeTruthy();
  expect(screen.queryByRole("region", { name: /^S42 / })).toBeNull();
});

test("bands: from the day after its sprint, a late feature slips into the next sprint", async () => {
  setSystemTime(new Date(`${DAY_AFTER}T09:00:00`));
  setupPlanning(DAY_AFTER, bands);
  const frise = await timeline();
  expect(tones(frise, "F5")).toEqual([
    "done",
    "review",
    "progress",
    "todo",
    "todo",
    "slipped",
    "slipped",
    "slipped",
    "slipped",
  ]);
  expect(within(frise).getAllByText("glisse en S43").length).toBeGreaterThan(0);
});

test("the header shrinks its texts and wraps its actions under the title rather than overflowing", async () => {
  setupPlanning(TODAY, bands);
  const hint = await screen.findByText("Glisse en Colonnes pour planifier");
  const titles = hint.parentElement;
  const header = titles?.parentElement;
  expect(header?.className).toContain("flex-wrap");
  expect(titles?.className).toContain("min-w-0");
  expect(hint.className).toContain("truncate");
  expect(screen.getByText(/fonctionnalités? livrées? sur/).className).toContain("truncate");
  const actions = screen.getByRole("group", { name: "Disposition" }).parentElement;
  expect(actions?.parentElement).toBe(header);
  expect(actions?.className).toContain("flex-wrap");
});

test("bands: delivered features are folded under their count", async () => {
  setupPlanning(TODAY, bands);
  const frise = await timeline();
  const folded = within(frise).getByRole("button", { name: "Livrées · 3" });
  expect(folded.getAttribute("aria-expanded")).toBe("false");
  await userEvent.setup().click(folded);
  expect(rowKeys(frise)).toEqual(["F4", "F5", "F6", "F8", "F7", "F9", "F1", "F2", "F3"]);
});

test("bands: nothing can be dragged, a row opens its feature", async () => {
  const { m, seeded } = setupPlanning(TODAY, bands);
  const frise = await timeline();
  expect(document.querySelector("[aria-roledescription=draggable]")).toBeNull();
  await userEvent.setup().click(within(frise).getByRole("button", { name: /^F9 / }));
  await waitFor(() => expect(m.opened).toEqual([seeded.features.f9.root.id]));
});

test("today sits in its sprint, on the edge of the next one between two sprints, nowhere after", () => {
  const sprints = [
    { start: "2026-10-05", end: "2026-10-09" },
    { start: "2026-10-12", end: "2026-10-16" },
  ];
  expect(bandsToday(sprints, "2026-10-16")).toBeCloseTo((1 + 4 / 5) / 3);
  expect(bandsToday(sprints, "2026-10-05")).toBe(0);
  expect(bandsToday(sprints, "2026-10-10")).toBeCloseTo(1 / 3);
  expect(bandsToday(sprints, "2026-10-01")).toBe(0);
  expect(bandsToday(sprints, "2026-10-17")).toBeNull();
  expect(bandsToday([], "2026-10-10")).toBeNull();
});

test("before the first sprint, the bands count the days until it starts", () => {
  const sprints = [{ start: "2026-10-05", end: "2026-10-09" }];
  expect(startsIn(sprints, "2026-10-01")).toBe(4);
  expect(startsIn(sprints, "2026-10-05")).toBeNull();
  expect(startsIn([], "2026-10-01")).toBeNull();
});

test("bands before S1: « commence dans n j » on the left, no today line over the rows", async () => {
  setSystemTime(new Date("2026-10-01T09:00:00"));
  setupPlanning("2026-10-01", bands);
  const frise = await timeline();
  expect(screen.getByText("commence dans 4 j")).toBeTruthy();
  expect(within(frise).queryByText("aujourd'hui")).toBeNull();
});

test("bands: an at-risk row is amber, a late one red, a slipped one says where from", async () => {
  setupPlanning(TODAY, {
    ...bands,
    journal: ({ features }) => [
      {
        id: 1,
        projectId: "p",
        at: new Date(`${TODAY}T09:00:00`).getTime(),
        kind: "sprint_set",
        ticketId: features.f8.root.id,
        featureId: features.f8.root.id,
        source: "user",
        data: { from: "S42", to: "S43" },
      },
    ],
  });
  const frise = await timeline();
  const mark = (key: string) => frise.querySelector(`[data-feature="${key}"]`)?.getAttribute("data-mark");
  expect([mark("F5"), mark("F4"), mark("F8")]).toEqual(["risk", null, null]);
  expect(within(frise).getByText("glissée de S42")).toBeTruthy();
});

test("bands: from the day after its sprint, a late row is red", async () => {
  setSystemTime(new Date(`${DAY_AFTER}T09:00:00`));
  setupPlanning(DAY_AFTER, bands);
  const frise = await timeline();
  expect(frise.querySelector('[data-feature="F5"]')?.getAttribute("data-mark")).toBe("late");
});
