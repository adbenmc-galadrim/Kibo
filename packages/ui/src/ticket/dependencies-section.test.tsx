import { beforeEach, expect, mock, test } from "bun:test";
import {
  DEFAULT_WORKFLOW,
  EMPTY_PROGRESS,
  type ProjectSnapshot,
  type RpcRequest,
  type TicketView,
} from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
mock.module("../api", () =>
  apiMock({
    client: {
      subscribeTopic: () => () => {},
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        return null;
      },
    },
  }),
);

const { DependenciesSection } = await import("./DependenciesSection");

const ticket = (n: number, title: string): TicketView => ({
  id: `${n}@1`,
  key: `BOU-${n}`,
  hold: null,
  keyLabel: `BOU-${n}`,
  title,
  description: "",
  statusId: "in_progress",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  labels: [],
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
  startable: false,
  startReason: null,
  onHold: null,
  agentProgress: EMPTY_PROGRESS,
  delivery: null,
  sprintId: null,
  optional: false,
  shortKey: null,
  effectiveSprintId: null,
  session: null,
  updatedAt: null,
  feature: null,
});
const BOU15 = ticket(15, "Page de suivi de commande");
const project: ProjectSnapshot = {
  meta: {
    id: "bou",
    name: "Boutique",
    key: "BOU",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [BOU15, ticket(12, "Format des dates de livraison"), ticket(9, "Codes promo du panier")],
  links: [
    { id: "l1", from: "12@1", to: "15@1", type: "blocks" },
    { id: "l2", from: "9@1", to: "15@1", type: "blocks" },
  ],
  questions: [],
  questionRecipients: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "BOU-16",
  sprints: [],
};
const draw = (editable = true) =>
  render(
    <DependenciesSection project={project} ticket={BOU15} editable={editable} onOpenTicket={() => {}} />,
  );
const row = (key: string) => {
  const item = screen.getByRole("button", { name: new RegExp(`^${key}`) }).closest("li");
  if (!item) throw new Error(`no row for ${key}`);
  return within(item);
};
beforeEach(() => {
  calls.length = 0;
});

test("a link carries no Kibo badge and no auto link is asked for", () => {
  draw();
  expect(row("BOU-12").queryByRole("button", { name: /^Lien ajouté par Kibo/ })).toBeNull();
  expect(calls).toEqual([]);
});

test("the cross still removes the link the usual way", async () => {
  draw();
  await userEvent.setup().click(screen.getByRole("button", { name: "Retirer BOU-12" }));
  expect(calls.at(-1)).toEqual({
    method: "command",
    projectId: "bou",
    command: { method: "removeLink", linkId: "l1" },
  });
});

test("the search field suggests a key of the current project", async () => {
  draw();
  await userEvent.setup().click(screen.getByRole("button", { name: "Ajouter une dépendance" }));
  expect(screen.getByRole("textbox", { name: "Ticket" }).getAttribute("placeholder")).toBe("BOU-2…");
});

test("a long dependency title wraps instead of being cut", () => {
  draw();
  const title = screen.getByText("Format des dates de livraison");
  expect(title.className).toContain("wrap-anywhere");
  expect(title.className).not.toContain("truncate");
});
