import { afterEach, expect, spyOn, test } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { build } from "./model-test-kit";
import { type OverviewHandlers, OverviewView } from "./OverviewView";
import type { OverviewModel } from "./overview-model";

afterEach(cleanup);

const noop = () => undefined;
const handlers: OverviewHandlers = {
  copy: async () => undefined,
  onOpenTicket: noop,
  onOpenSprint: noop,
  onOpenQuestion: noop,
  onOpenQuestions: noop,
  onOpenPlanning: noop,
  onNewFeature: noop,
  onChooseFolder: noop,
};

function view(model: OverviewModel, today?: string) {
  const { input } = build(today);
  render(<OverviewView project={null} model={model} activity={input} start={null} handlers={handlers} />);
}

test("the sessions in progress show only while one is active", () => {
  const { model } = build();
  view(model);
  expect(
    within(screen.getByRole("region", { name: "En ce moment" })).getByText("2 sessions T3 Code"),
  ).toBeTruthy();
  cleanup();
  view({ ...model, now: [] });
  expect(screen.queryByRole("region", { name: "En ce moment" })).toBeNull();
});

test("the next feature to finish says when it is a late one", () => {
  const { model } = build("2026-10-19");
  view(model, "2026-10-19");
  const next = screen.getByRole("region", { name: "Prochaine à finir" });
  expect(within(next).getByText("en retard, la plus avancée")).toBeTruthy();
  expect(within(next).getByText("Saisir un constat hors ligne")).toBeTruthy();
});

test("a slipped feature of the sprint says where it comes from", () => {
  const { model } = build();
  const sprint = model.sprint;
  if (sprint === null) throw new Error("sprint");
  const rows = sprint.rows.map((r) => (r.shortKey === "F5" ? { ...r, slipped: "S41" } : r));
  view({ ...model, sprint: { ...sprint, rows } });
  const card = screen.getByRole("region", { name: "Sprint S42 · Saisie hors ligne" });
  expect(within(card).getByText("glissée de S41")).toBeTruthy();
  expect(card.querySelectorAll("[data-risk]").length).toBe(2);
});

test("the deadlines show the features at risk in amber and the slipped note", () => {
  const { model } = build();
  const rows = model.deadlines.rows.map((r) => (r.shortKey === "F6" ? { ...r, note: "glissée de S42" } : r));
  view({ ...model, deadlines: { ...model.deadlines, rows } });
  const card = screen.getByRole("region", { name: "Échéances" });
  expect(
    Array.from(card.querySelectorAll("[data-mark='risk']")).map((e) => e.getAttribute("data-feature")),
  ).toEqual(["F4", "F5"]);
  expect(within(card).getByText("glissée de S42")).toBeTruthy();
});

const REGIONS = [
  "En retard",
  "Questions",
  "Sprint S42 · Saisie hors ligne",
  "En review",
  "Prochaine à finir",
  "Échéances",
  "En ce moment",
  "Activité",
];

const regionNames = () =>
  screen
    .getAllByRole("region")
    .map((r) => r.getAttribute("aria-label") ?? "")
    .filter((name) => REGIONS.includes(name) || name.startsWith("En attente"));

test("sections render in the urgency order: late, held + questions, sprint + review, next, deadlines, now, activity", () => {
  const { model } = build("2026-10-19", true);
  view(model, "2026-10-19");
  const names = regionNames();
  expect(names.at(0)).toBe("En retard");
  expect(names.at(-3)).toBe("Échéances");
  expect(names.at(-2)).toBe("En ce moment");
  expect(names.at(-1)).toBe("Activité");
  const columns = screen.getByRole("region", { name: "Questions" }).parentElement?.parentElement;
  const [left, right] = Array.from(columns?.children ?? []);
  const inside = (el: Element | undefined) =>
    Array.from(el?.children ?? []).map((c) => c.getAttribute("aria-label")?.replace(/ \(.*/, ""));
  expect(inside(right)).toEqual(["Questions", "En review"]);
  expect(inside(left).at(0)).toMatch(/^En attente/);
  expect(inside(left).at(-1)).toBe("Prochaine à finir");
});

test("the delivered-today line appears under the tiles when deliveredToday is not empty", () => {
  const { model } = build();
  view(model);
  const line = screen.getByRole("region", { name: "Livrée aujourd'hui" });
  expect(line.textContent).toContain("F3");
  expect(line.textContent).toContain("4/4 étapes · dernière fusion #18 à 14:36");
  expect(line.textContent).toContain("3 livrées sur 9");
  const indicators = screen.getByRole("region", { name: "Indicateurs du projet" });
  expect(indicators.nextElementSibling).toBe(line);
  cleanup();
  view({ ...model, deliveredToday: [] });
  expect(screen.queryByRole("region", { name: "Livrée aujourd'hui" })).toBeNull();
});

test("a click on a delivered line opens the feature", async () => {
  const opened: string[] = [];
  const { model, byTitle } = build();
  render(
    <OverviewView
      project={null}
      model={model}
      activity={build().input}
      start={null}
      handlers={{ ...handlers, onOpenTicket: (id) => opened.push(id) }}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: /Réaffecter un box.*14:36/ }));
  expect(opened).toEqual([byTitle("Réaffecter un box").id]);
});

const deliveredListIsWatched = (reduce: boolean): boolean => {
  const media = spyOn(window, "matchMedia").mockImplementation(
    (query: string) => ({ matches: reduce && query.includes("reduce"), media: query }) as MediaQueryList,
  );
  const observe = spyOn(MutationObserver.prototype, "observe");
  try {
    view(build().model);
    const list = screen.getByRole("region", { name: "Livrée aujourd'hui" });
    return observe.mock.calls.some(([target]) => target === list);
  } finally {
    media.mockRestore();
    observe.mockRestore();
  }
};

test("auto-animate watches the delivered lines", () => {
  expect(deliveredListIsWatched(false)).toBe(true);
});

test("with reduced motion auto-animate leaves the delivered lines alone", () => {
  expect(deliveredListIsWatched(true)).toBe(false);
});

test("the questions header counts the blocking ones in red", () => {
  const { model } = build();
  view(model);
  const header = within(screen.getByRole("region", { name: "Questions" })).getByText("1 bloquante");
  expect(header.className).toContain("text-(--tracking-red)");
});
