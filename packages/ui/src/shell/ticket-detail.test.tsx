import { expect, mock, test } from "bun:test";
import { type AgentsState, DEFAULT_WORKFLOW, type ProjectSnapshot, type TicketView } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { agentsFixture, runFixture } from "../agents/fixtures";
import { apiMock } from "../api-mock";

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: { method: string }) => {
        if (req.method === "getSyncState") return { bindings: [], pending: [], errors: [] };
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
const { AgentsProvider } = await import("../state/agents-context");

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
  ...patch,
});

const project = (t: TicketView): ProjectSnapshot => ({
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6", worktree: null },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  links: [],
  questions: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-13",
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

const show = (t: TicketView, agents: AgentsState | null, wrap = true) => {
  const detail = (
    <TicketDetail
      project={project(t)}
      ticket={t}
      viewer="adam"
      onOpenFile={() => {}}
      onOpenTicket={() => {}}
    />
  );
  const tree: ReactNode = wrap ? (
    <HostProvider host={host}>
      <AgentsProvider agents={agents}>{detail}</AgentsProvider>
    </HostProvider>
  ) : (
    detail
  );
  return render(tree);
};

const agents = (runs: AgentsState["runs"]): AgentsState => ({ ...agentsFixture(), runs });

test("the questions badge opens the Questions view, and stays hidden at zero", async () => {
  views.length = 0;
  const view = show(ticket({ openQuestions: 2 }), null);
  await userEvent.setup().click(screen.getByRole("button", { name: "2 questions" }));
  expect(views).toEqual(["questions"]);
  expect(screen.getByRole("button", { name: "2 questions" }).getAttribute("title")).toBe(
    "Ouvrir les questions",
  );
  view.unmount();
  show(ticket({ openQuestions: 0 }), null);
  expect(screen.queryByRole("button", { name: /question/ })).toBeNull();
});

test("the main session of the ticket sits under the assignee", () => {
  const runs = [
    runFixture({ id: "r1", seq: 1, ticketId: "12@1", label: "opus-dev-1", startedAt: 1, turns: 1 }),
    runFixture({ id: "r2", seq: 2, ticketId: "12@1", label: "opus-dev-2", startedAt: 2, turns: 3 }),
    runFixture({ id: "r3", seq: 3, ticketId: "12@1", label: "opus-dev-3", startedAt: null, turns: 0 }),
    runFixture({ id: "r4", seq: 4, ticketId: "other", label: "opus-dev-4", startedAt: 4, turns: 9 }),
  ];
  show(ticket(), agents(runs));
  expect(screen.getByText("Session principale")).toBeTruthy();
  expect(screen.getByText("opus-dev-2 · 3 tours")).toBeTruthy();
});

test("no started run, no agents state or no shell host: no session line and no failure", () => {
  show(ticket(), agents([runFixture({ id: "r3", seq: 3, ticketId: "12@1", startedAt: null })]));
  expect(screen.queryByText("Session principale")).toBeNull();
  show(ticket({ openQuestions: 1 }), null, false);
  expect(screen.getByRole("button", { name: "1 question" })).toBeTruthy();
});
