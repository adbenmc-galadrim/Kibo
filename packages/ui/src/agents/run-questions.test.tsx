import { beforeEach, expect, mock, test } from "bun:test";
import { type AgentsState, KiboError, type RpcRequest, type RunQuestions, type RunView } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { agentsFixture, kiboProject, NOW, runFixture } from "./fixtures";

const calls: RpcRequest[] = [];
let deliver: () => Promise<unknown> = () => Promise.resolve({ sent: 1, runId: "r50" });
let access: "write" | "read" = "write";
const project = () => {
  const snapshot = kiboProject();
  return { ...snapshot, sync: { ...snapshot.sync, access } };
};

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "deliverAnswers") return deliver();
        return Promise.resolve(req.method === "getProject" ? project() : null);
      },
      subscribe: () => () => {},
      code: () => Promise.resolve([]),
      subscribeCode: () => () => {},
    },
  }),
);

const unmockedProjects = "../state/use-projects?unmocked";
const realProjects: typeof import("../state/use-projects") = await import(unmockedProjects);
mock.module("../state/use-projects", () => ({
  useProject: realProjects.useProject,
  useProjects: realProjects.useProjects,
}));

const { AgentDrawer } = await import("./AgentDrawer");
const { OpenQuestionsProvider } = await import("./open-questions");
const { RunHistory } = await import("./RunHistory");
const { RunHistoryList } = await import("../shell/RunHistoryList");
const { DropdownMenu, DropdownMenuContent } = await import("@kibo/sdk/ui/dropdown-menu");

beforeEach(() => {
  calls.length = 0;
  deliver = () => Promise.resolve({ sent: 1, runId: "r50" });
  access = "write";
});

const run: RunView = runFixture({
  id: "r50",
  projectId: "kibo",
  ticketId: "t14",
  ticketKey: "KIB-14",
  ticketTitle: "Récepteur de hooks",
  label: "opus-dev-2",
  state: "done",
  startedAt: NOW - 600_000,
  endedAt: NOW,
  turns: 1,
});

function drawer(questions: RunQuestions[], opened: string[] | null = null) {
  const state: AgentsState = { ...agentsFixture(), runs: [run], queue: [], resumable: [run.id], questions };
  const view = (
    <AgentDrawer
      state={state}
      now={NOW}
      selected={run}
      log={[]}
      onSelect={() => {}}
      onCollapse={() => {}}
      onLaunch={() => {}}
      onOpenFile={() => {}}
    />
  );
  if (opened === null) return view;
  return <OpenQuestionsProvider value={(projectId) => opened.push(projectId)}>{view}</OpenQuestionsProvider>;
}

const tally = (open: number, undelivered: number): RunQuestions => ({
  runId: "r50",
  open,
  undelivered,
  latestTitle: open > 0 ? "Bloquer le dépôt ?" : null,
});

test("a finished run with open questions says so in the list and opens the questions view", async () => {
  const opened: string[] = [];
  render(drawer([tally(2, 0)], opened));
  const finished = screen.getByRole("list", { name: "Terminé" });
  expect(within(finished).getByText("2 questions").className).toContain("text-orange-600");
  expect(screen.getByText("2 questions ouvertes")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Transmettre à l'agent" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Ouvrir les questions" }));
  expect(opened).toEqual(["kibo"]);
});

test("answers waiting for the agent are sent by one click, never by themselves", async () => {
  render(drawer([tally(0, 1)]));
  expect(calls.some((c) => c.method === "deliverAnswers")).toBe(false);
  expect(await screen.findByText("1 réponse à transmettre")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Ouvrir les questions" })).toBeNull();
  await userEvent.click(await screen.findByRole("button", { name: "Transmettre à l'agent" }));
  expect(calls).toContainEqual({ method: "deliverAnswers", projectId: "kibo", ticketId: "t14" });
});

test("without a session to resume the drawer says how the answers will still reach the agent", async () => {
  deliver = () => Promise.reject(new KiboError("INVALID_TRANSITION", "run r50 cannot be resumed"));
  render(drawer([tally(0, 2)]));
  await userEvent.click(await screen.findByRole("button", { name: "Transmettre à l'agent" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Aucune session à reprendre : assigne le ticket, le brief portera les réponses.",
  );
});

test("a run without questions shows no question line", () => {
  render(drawer([]));
  expect(screen.queryByText(/question/)).toBeNull();
  expect(screen.queryByText(/à transmettre/)).toBeNull();
});

test("the run history says the open questions in orange and its suffix opens the questions view", async () => {
  const opened: string[] = [];
  const runs: string[] = [];
  render(
    <OpenQuestionsProvider value={(projectId) => opened.push(projectId)}>
      <RunHistory
        runs={[run]}
        questions={[tally(1, 0)]}
        positions={new Map()}
        projectColumn={null}
        now={NOW}
        onOpenRun={(id) => runs.push(id)}
      />
    </OpenQuestionsProvider>,
  );
  const row = screen.getByRole("row", { name: /KIB-14/ });
  expect(within(row).getByText(/^Terminé/)).toBeTruthy();
  await userEvent.click(within(row).getByRole("button", { name: "1 question" }));
  expect(opened).toEqual(["kibo"]);
  expect(runs).toEqual([]);
});

test("the bell list says the open questions of a finished run", () => {
  render(
    <DropdownMenu open>
      <DropdownMenuContent>
        <RunHistoryList
          runs={[run]}
          questions={[tally(3, 0)]}
          now={NOW}
          notifications="native"
          onOpenRun={() => {}}
        />
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  expect(screen.getByText("3 questions").className).toContain("text-orange-600");
});

test("a reader of the project sees no answer to deliver nor its button", async () => {
  access = "read";
  render(drawer([tally(1, 2)]));
  expect(screen.getByText("1 question ouverte")).toBeTruthy();
  await waitFor(() => expect(calls.some((c) => c.method === "getProject")).toBe(true));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(screen.queryByText("2 réponses à transmettre")).toBeNull();
  expect(screen.queryByRole("button", { name: "Transmettre à l'agent" })).toBeNull();
});
