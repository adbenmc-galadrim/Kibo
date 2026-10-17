import { afterEach, expect, test } from "bun:test";
import type { ProjectCommand, TicketView } from "@kibo/schema";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emisFeatureProject, SPRINTS } from "../shell/feature/fixture";
import { SprintField } from "./SprintField";
import type { TicketCommand } from "./use-ticket-command";

afterEach(cleanup);

const sent: ProjectCommand[] = [];
const command: TicketCommand = {
  run: async (c) => {
    sent.push(c);
    return true;
  },
  error: null,
  busy: false,
  clearError: () => undefined,
};

const project = emisFeatureProject();
const lone: TicketView = {
  ...(project.tickets.find((t) => t.id === "e35") as TicketView),
  id: "solo",
  parentId: null,
  sprintId: "s42",
  progress: { done: 0, total: 0 },
};

test("a root ticket without steps picks its sprint", async () => {
  sent.length = 0;
  render(<SprintField ticket={lone} sprints={SPRINTS} editable command={command} />);
  const user = userEvent.setup();
  const trigger = screen.getByRole("combobox", { name: "Sprint" });
  expect(trigger.textContent).toContain("S42");
  trigger.focus();
  await user.keyboard("{Enter}");
  const list = within(await screen.findByRole("listbox"));
  expect(list.getAllByRole("option").map((o) => o.textContent)).toEqual([
    "À planifier",
    "S41 · Accès",
    "S42 · Terrain hors ligne",
    "S43 · Import et soudures",
    "S44 · Rapports",
  ]);
  await user.click(list.getByRole("option", { name: "S43 · Import et soudures" }));
  expect(sent).toEqual([{ method: "setTicketSprint", ticketId: "solo", sprintId: "s43" }]);
});

test("choosing « À planifier » removes the sprint", async () => {
  sent.length = 0;
  render(<SprintField ticket={lone} sprints={SPRINTS} editable command={command} />);
  const user = userEvent.setup();
  screen.getByRole("combobox", { name: "Sprint" }).focus();
  await user.keyboard("{Enter}");
  await user.click(within(await screen.findByRole("listbox")).getByRole("option", { name: "À planifier" }));
  expect(sent).toEqual([{ method: "setTicketSprint", ticketId: "solo", sprintId: null }]);
});

test("a step or a feature has no sprint field of its own", () => {
  const step = project.tickets.find((t) => t.id === "e35") as TicketView;
  const feature = project.tickets.find((t) => t.id === "f5") as TicketView;
  render(<SprintField ticket={step} sprints={SPRINTS} editable command={command} />);
  render(<SprintField ticket={feature} sprints={SPRINTS} editable command={command} />);
  expect(screen.queryByRole("combobox")).toBeNull();
});
