import { expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, EMPTY_PROGRESS, type ProjectSnapshot, type TicketView } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

mock.module("../api", () => apiMock({ client: { rpc: async () => null, subscribe: () => () => undefined } }));

const { GroupDetail } = await import("./GroupDetail");

const ticket = (id: string, patch: Partial<TicketView> = {}): TicketView => ({
  id,
  key: `KIB-${id}`,
  pendingSeq: null,
  keyLabel: `KIB-${id}`,
  title: `Ticket ${id}`,
  description: "",
  statusId: "todo",
  parentId: "4",
  assignee: null,
  domainId: null,
  blockedReason: null,
  labels: [],
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
  startable: false,
  agentProgress: EMPTY_PROGRESS,
  delivery: null,
  sprintId: null,
  optional: false,
  shortKey: null,
  effectiveSprintId: null,
  feature: null,
  ...patch,
});

const group = ticket("4", {
  title: "Parcours de livraison",
  parentId: null,
  statusId: "in_progress",
  description: "Tout le parcours.",
  progress: { done: 1, total: 3 },
});
const tickets = [
  group,
  ticket("5", { title: "Bouton Livrer", statusId: "done" }),
  ticket("6", { title: "Étapes visibles", statusId: "in_progress", progress: { done: 0, total: 2 } }),
  ticket("7", { title: "Un seul worktree" }),
];

const project: ProjectSnapshot = {
  meta: {
    id: "p1",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#14B8A6",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
  },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  links: [],
  questions: [],
  questionRecipients: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-8",
  sprints: [],
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
  tickets,
};

test("the sheet of a group shows its derived state, its progress, its sub-tickets and its description", async () => {
  const opened: string[] = [];
  render(
    <GroupDetail
      project={project}
      ticket={group}
      onOpenFile={() => undefined}
      onOpenTicket={(id) => opened.push(id)}
    />,
  );
  expect(screen.getByText("dérivé des sous-tickets").parentElement?.textContent).toBe(
    "En coursdérivé des sous-tickets",
  );
  expect(screen.getByText("1/3 livrés")).toBeTruthy();
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("33");
  const rows = screen.getAllByRole("listitem").map((li) => li.textContent);
  expect(rows).toEqual([
    "KIB-5Bouton LivrerTerminé",
    "KIB-6Étapes visiblesEn cours",
    "KIB-7Un seul worktreeÀ faire",
  ]);
  expect(screen.getByText("Tout le parcours.")).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Statut" })).toBeNull();
  expect(screen.queryByText("Assigner à un agent")).toBeNull();
  await userEvent.setup().click(screen.getByRole("button", { name: /Étapes visibles/ }));
  expect(opened).toEqual(["6"]);
});
