import { afterEach, beforeEach, expect, test } from "bun:test";
import type { SprintView, TicketView } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { recapKey, SprintRecap } from "./SprintRecap";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const S42: SprintView = {
  id: "s42",
  code: "S42",
  name: "Saisie hors ligne",
  start: "2026-10-12",
  end: "2026-10-16",
  state: "done",
  features: ["f3"],
  delivered: 1,
  total: 1,
  lingering: false,
};
const feature = {
  id: "f3",
  keyLabel: "SILO-3",
  shortKey: "F3",
  title: "Réaffecter un box",
  parentId: null,
  sprintId: "s42",
  feature: {
    status: "delivered",
    steps: { done: 4, total: 4, mandatoryDone: 4, mandatoryTotal: 4 },
    nextStepId: null,
    remaining: 0,
    started: true,
    held: 0,
  },
} as unknown as TicketView;
const project = { tickets: [feature], links: [], sprints: [S42] };

const show = (today: string | null, sprints = project.sprints) =>
  render(
    <SprintRecap
      projectId="p1"
      project={{ ...project, sprints }}
      today={today}
      onOpenPlanning={() => undefined}
    />,
  );

test("shown once the day after the sprint end, dismiss writes the localStorage key, nothing without sprints", async () => {
  show("2026-10-16");
  expect(screen.queryByRole("region", { name: "Sprint S42 terminé" })).toBeNull();
  cleanup();
  show("2026-10-17");
  expect(screen.getByRole("region", { name: "Sprint S42 terminé" })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Fermer" }));
  expect(screen.queryByRole("region", { name: "Sprint S42 terminé" })).toBeNull();
  expect(localStorage.getItem(recapKey("p1", "S42"))).toBe("1");
  cleanup();
  show("2026-10-17");
  expect(screen.queryByRole("region", { name: "Sprint S42 terminé" })).toBeNull();
  localStorage.clear();
  cleanup();
  show("2026-10-17", []);
  expect(screen.queryByRole("region")).toBeNull();
});
