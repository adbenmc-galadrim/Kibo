import { beforeEach, expect, mock, test } from "bun:test";
import {
  type AutoLink,
  DEFAULT_WORKFLOW,
  EMPTY_PROGRESS,
  type ProjectSnapshot,
  type RpcRequest,
  type TicketView,
} from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
let autoLinks: AutoLink[] = [];
let listFails = false;
mock.module("../api", () =>
  apiMock({
    client: {
      subscribeTopic: () => () => {},
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "autoLinks.list") {
          if (listFails) throw new Error("daemon down");
          return autoLinks;
        }
        if (req.method === "autoLinks.cancel") {
          autoLinks = autoLinks.map((l) => (l.id === req.id ? { ...l, status: "cancelled" as const } : l));
          return autoLinks.find((l) => l.id === req.id);
        }
        return null;
      },
    },
  }),
);

const { DependenciesSection } = await import("./DependenciesSection");

const ticket = (n: number, title: string): TicketView => ({
  id: `${n}@1`,
  key: `BOU-${n}`,
  pendingSeq: null,
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
  agentProgress: EMPTY_PROGRESS,
  delivery: null,
  sprintId: null,
  optional: false,
  shortKey: null,
  effectiveSprintId: null,
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
    duplication: null,
    delivery: null,
    tracking: null,
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
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
};
const AUTO: AutoLink = {
  id: "al1",
  projectId: "bou",
  linkId: "l1",
  fromTicketId: "12@1",
  toTicketId: "15@1",
  fromTicketKey: "BOU-12",
  toTicketKey: "BOU-15",
  ownerRunId: "r12",
  otherRunId: "r15",
  reason: "copy",
  detail: { path: "src/lib/format-date.ts", name: "formatDate" },
  at: new Date(2026, 9, 12, 14, 52).getTime(),
  status: "added",
  cancelledBy: null,
  cancelledAt: null,
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
const badgeOf = (key: string) => row(key).queryByRole("button", { name: `Lien ajouté par Kibo avec ${key}` });

beforeEach(() => {
  calls.length = 0;
  autoLinks = [AUTO];
  listFails = false;
});

test("screen 199: a link added by Kibo carries the badge, the others do not", async () => {
  draw();
  await waitFor(() => expect(badgeOf("BOU-12")).toBeTruthy());
  expect(badgeOf("BOU-9")).toBeNull();
  expect(calls).toContainEqual({ method: "autoLinks.list", projectId: "bou" });
});

test("a cancelled auto link shows no badge", async () => {
  autoLinks = [{ ...AUTO, status: "cancelled" }];
  draw();
  await waitFor(() => expect(calls).toContainEqual({ method: "autoLinks.list", projectId: "bou" }));
  expect(badgeOf("BOU-12")).toBeNull();
});

test("cancelling from the badge calls the daemon and drops the badge", async () => {
  draw();
  const user = userEvent.setup();
  await waitFor(() => expect(badgeOf("BOU-12")).toBeTruthy());
  await user.click(badgeOf("BOU-12") as HTMLElement);
  await user.click(await screen.findByRole("button", { name: "Annuler" }));
  expect(calls).toContainEqual({ method: "autoLinks.cancel", id: "al1" });
  await waitFor(() => expect(badgeOf("BOU-12")).toBeNull());
});

test("the cross still removes the link the usual way", async () => {
  draw();
  await waitFor(() => expect(badgeOf("BOU-12")).toBeTruthy());
  await userEvent.setup().click(screen.getByRole("button", { name: "Retirer BOU-12" }));
  expect(calls.at(-1)).toEqual({
    method: "command",
    projectId: "bou",
    command: { method: "removeLink", linkId: "l1" },
  });
});

test("a reader sees the badge without the cancel button", async () => {
  draw(false);
  await waitFor(() => expect(badgeOf("BOU-12")).toBeTruthy());
  await userEvent.setup().click(badgeOf("BOU-12") as HTMLElement);
  await screen.findByRole("dialog");
  expect(screen.queryByRole("button", { name: "Annuler" })).toBeNull();
});

test("when the auto links cannot be read, a discreet line says so and the links stay", async () => {
  listFails = true;
  draw();
  expect(await screen.findByText("Liens ajoutés par Kibo indisponibles pour l'instant.")).toBeTruthy();
  expect(badgeOf("BOU-12")).toBeNull();
  expect(row("BOU-12")).toBeTruthy();
});

test("no auto links error line while the list reads fine", async () => {
  draw();
  await waitFor(() => expect(badgeOf("BOU-12")).toBeTruthy());
  expect(screen.queryByText("Liens ajoutés par Kibo indisponibles pour l'instant.")).toBeNull();
});
