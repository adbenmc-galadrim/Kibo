import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import { build } from "./model-test-kit";
import { type OverviewHandlers, OverviewView } from "./OverviewView";
import type { OverviewModel } from "./overview-model";

afterEach(cleanup);

const noop = () => undefined;
const handlers: OverviewHandlers = {
  execution: "hidden",
  copy: async () => undefined,
  deliver: async () => undefined,
  onOpenTicket: noop,
  onOpenSprint: noop,
  onOpenQuestion: noop,
  onOpenQuestions: noop,
  onOpenPlanning: noop,
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
  expect(within(next).getByText("Saisir un tronçon hors ligne")).toBeTruthy();
});

test("a slipped feature of the sprint says where it comes from", () => {
  const { model } = build();
  const sprint = model.sprint;
  if (sprint === null) throw new Error("sprint");
  const rows = sprint.rows.map((r) => (r.shortKey === "F5" ? { ...r, slipped: "S41" } : r));
  view({ ...model, sprint: { ...sprint, rows } });
  const card = screen.getByRole("region", { name: "Sprint S42 · Terrain hors ligne" });
  expect(within(card).getByText("glissée de S41")).toBeTruthy();
  expect(card.querySelectorAll("[data-risk]").length).toBe(2);
});
