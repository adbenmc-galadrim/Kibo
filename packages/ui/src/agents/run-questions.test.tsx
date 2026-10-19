import { beforeEach, expect, mock, test } from "bun:test";
import type { AgentsState, Question, RpcRequest, RunQuestions, RunView } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { agentsFixture, kiboProject, NOW, runFixture } from "./fixtures";

const calls: RpcRequest[] = [];
let access: "write" | "read" = "write";
let questions: Question[] = [];
const project = () => {
  const snapshot = kiboProject();
  return { ...snapshot, questions, sync: { ...snapshot.sync, access } };
};

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "getRunLog") return Promise.resolve([]);
        return Promise.resolve(req.method === "getProject" ? project() : null);
      },
      subscribe: () => () => {},
      subscribeMoments: () => () => {},
      subscribeTopic: () => () => {},
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

const { AgentDock } = await import("./dock/AgentDock");
const { OpenQuestionsProvider } = await import("./open-questions");
const { RunHistory } = await import("./RunHistory");
const { RunHistoryList } = await import("../shell/RunHistoryList");
const { DropdownMenu, DropdownMenuContent } = await import("@kibo/sdk/ui/dropdown-menu");

beforeEach(() => {
  calls.length = 0;
  access = "write";
  questions = [];
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
    <AgentDock
      state={state}
      now={NOW}
      online
      selected={run}
      onSelect={() => {}}
      onCollapse={() => {}}
      onLaunch={() => {}}
      onOpenFile={() => {}}
    />
  );
  if (opened === null) return view;
  const record = (projectId: string, questionId?: string) =>
    opened.push(questionId ? `${projectId}#${questionId}` : projectId);
  return <OpenQuestionsProvider value={record}>{view}</OpenQuestionsProvider>;
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
  const finished = screen.getByRole("list", { name: "Terminés depuis 24 h · 1" });
  expect(within(finished).getByText("2 questions").className).toContain("text-orange-600");
  expect(screen.getByText("2 questions ouvertes")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Transmettre à l'agent" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Ouvrir les questions" }));
  expect(opened).toEqual(["kibo"]);
});

test("answers of a finished run are never shown as waiting to be sent", async () => {
  render(drawer([tally(0, 1)]));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(screen.queryByText(/transmettre/)).toBeNull();
  expect(screen.queryByRole("button", { name: "Ouvrir les questions" })).toBeNull();
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

test("a reader of the project sees the open questions and nothing to send", async () => {
  access = "read";
  render(drawer([tally(1, 2)]));
  expect(screen.getByText("1 question ouverte")).toBeTruthy();
  await waitFor(() => expect(calls.some((c) => c.method === "getProject")).toBe(true));
  expect(screen.queryByText(/transmettre/)).toBeNull();
});

const openQuestion = (id: string, title: string, createdAt: number): Question => ({
  kind: "question",
  images: [],
  id,
  ticketId: "t14",
  runId: "r50",
  title,
  context: "",
  options: [],
  provisional: null,
  blocking: true,
  createdBy: { kind: "agent", ref: "opus-dev-2" },
  createdAt,
  number: null,
  importRef: null,
  answer: null,
  recipient: "me",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
});

test("the open questions line previews them and both links open the first one", async () => {
  questions = [
    openQuestion("q2", "Garder le port ?", NOW - 1000),
    openQuestion("q1", "Bloquer le dépôt ?", NOW - 2000),
  ];
  const opened: string[] = [];
  render(drawer([tally(2, 0)], opened));
  const line = await screen.findByRole("button", { name: "2 questions ouvertes" });
  await waitFor(() => expect(line.getAttribute("data-state")).toBe("closed"));
  line.focus();
  expect(await screen.findByText("Garder le port ?")).toBeTruthy();
  await userEvent.click(line);
  await userEvent.click(screen.getByRole("button", { name: "Ouvrir les questions" }));
  expect(opened).toEqual(["kibo#q1", "kibo#q1"]);
});
