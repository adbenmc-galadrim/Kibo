import { afterEach, expect, mock, test } from "bun:test";
import {
  DEFAULT_WORKFLOW,
  EMPTY_PROGRESS,
  type ProjectSnapshot,
  type Question,
  type TicketView,
} from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: { method: string }) => {
        if (req.method === "getSyncState") return { bindings: [], pending: [], errors: [] };
        if (req.method === "autoLinks.list") return [];
        return null;
      },
      subscribe: () => () => undefined,
      subscribeEvents: () => () => undefined,
      subscribeIntegrations: () => () => undefined,
    },
  }),
);

const { TicketDetail } = await import("./TicketDetail");
const { HostProvider } = await import("./Host");

afterEach(cleanup);

const ticket = (patch: Partial<TicketView> = {}): TicketView => ({
  id: "12@1",
  key: "KIB-12",
  pendingSeq: null,
  keyLabel: "KIB-12",
  title: "Schéma Loro des tickets",
  description: "",
  statusId: "todo",
  parentId: null,
  assignee: null,
  domainId: null,
  blockedReason: null,
  labels: [],
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
  startable: false,
  startReason: null,
  agentProgress: EMPTY_PROGRESS,
  delivery: null,
  sprintId: null,
  optional: false,
  shortKey: null,
  effectiveSprintId: null,
  session: null,
  updatedAt: null,
  feature: null,
  ...patch,
});

const question = (patch: Partial<Question> = {}): Question => ({
  kind: "question",
  images: [],
  id: "q1",
  ticketId: "12@1",
  runId: null,
  title: "Quota par affaire ?",
  context: "",
  options: [],
  provisional: null,
  blocking: false,
  createdBy: { kind: "human", ref: "adam" },
  createdAt: 1,
  number: 4,
  importRef: null,
  answer: null,
  recipient: "product",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
  ...patch,
});

const project = (t: TicketView, questions: Question[] = []): ProjectSnapshot => ({
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
    description: null,
    client: null,
  },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  links: [],
  questions,
  questionRecipients: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-13",
  sprints: [],
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
  tickets: [t],
});

const views: string[] = [];
const host = {
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openAssign: () => undefined,
  openFile: () => undefined,
  openView: (id: string) => views.push(id),
  openTarget: () => undefined,
};

const show = (t: TicketView, questions: Question[] = []) =>
  render(
    <HostProvider host={host}>
      <TicketDetail
        project={project(t, questions)}
        ticket={t}
        onOpenFile={() => {}}
        onOpenTicket={() => {}}
      />
    </HostProvider>,
  );

test("the open questions of the ticket are listed and open the Questions view", async () => {
  views.length = 0;
  show(ticket(), [
    question(),
    question({
      id: "q2",
      answer: {
        kind: "text",
        option: null,
        text: "5 Go",
        by: { kind: "human", ref: "adam" },
        at: 2,
        deliveredAt: null,
        deliveredRunId: null,
      },
    }),
  ]);
  await userEvent.setup().click(screen.getByRole("button", { name: /Quota par affaire/ }));
  expect(views).toEqual(["questions"]);
  expect(screen.getByText("Q4")).toBeTruthy();
});

test("without a question the section says so", () => {
  show(ticket());
  expect(screen.getByText("Aucune question sur ce ticket.")).toBeTruthy();
  expect(screen.getByText("Dépendances : aucune")).toBeTruthy();
});

test("the details read Suivi, Description, Dépendances, Questions, then Domaine and Maquettes folded", () => {
  const { container } = show(ticket());
  const text = container.textContent ?? "";
  const order = ["Suivi", "Description", "Dépendances", "Questions", "Domaine", "Maquettes"].map((w) =>
    text.indexOf(w),
  );
  expect(order.every((at, i) => at >= 0 && (i === 0 || at > (order[i - 1] ?? 0)))).toBe(true);
  expect(screen.getByRole("button", { name: /^Domaine/ }).getAttribute("aria-expanded")).toBe("false");
  expect(screen.getByRole("button", { name: /^Maquettes/ }).getAttribute("aria-expanded")).toBe("false");
});
