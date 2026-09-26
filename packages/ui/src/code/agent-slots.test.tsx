import { beforeEach, expect, mock, test } from "bun:test";
import {
  type AgentsState,
  type CodeRequest,
  DEFAULT_RULES,
  DEFAULT_WORKFLOW,
  type ProjectSnapshot,
  type RepoStatus,
  type RunView,
  type TabTarget,
} from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentsFixture, runFixture } from "../agents/fixtures";

const WORKING =
  "opus-dev-1 travaille dans ce worktree. Tes modifications peuvent entrer en conflit avec les siennes.";
const RULE = "À l'ouverture de la PR, KIB-12 passe en « En review » (règle du workflow).";

let runs: RunView[] = [];
const status = (worktree: string): RepoStatus => ({
  worktree,
  branch: "kib-12",
  upstream: null,
  ahead: 1,
  behind: 0,
  hasHead: true,
  operation: null,
  files: [],
  commits: [
    {
      sha: "a".repeat(40),
      shortSha: "aaaaaaa",
      subject: "feat: move",
      body: "",
      author: "Adam",
      time: 0,
      pushed: false,
    },
  ],
});
const responses: Partial<Record<CodeRequest["method"], (req: CodeRequest) => unknown>> = {
  worktrees: () => [
    { path: "/repo", branch: "main", head: "b".repeat(40), isMain: true },
    { path: "/wt/kib-12", branch: "kib-12", head: "a".repeat(40), isMain: false },
  ],
  status: (req) => status(req.method === "worktrees" ? "" : req.worktree),
  commitDefaults: () => ({
    ticketId: "12@1",
    ticketKey: "KIB-12",
    message: "feat: schéma (KIB-12)",
    prTitle: "feat: schéma (KIB-12)",
    prBody: "## Ticket",
  }),
  remoteBranches: () => ({ remote: "origin", branches: ["main"], defaultBase: "main" }),
  ghStatus: () => ({ available: true, detail: null }),
  prForBranch: () => null,
  compare: () => ({ commits: [], fileCount: 1 }),
};
const agents = (): AgentsState => ({ ...agentsFixture(), runs });
mock.module("../api", () => ({
  client: {
    code: (req: CodeRequest) => Promise.resolve(responses[req.method]?.(req) ?? null),
    subscribeCode: () => () => {},
  },
}));
mock.module("../state/use-agents", () => ({
  useAgents: () => agents(),
  useConfig: () => null,
  useNow: () => 0,
  useRunLog: () => null,
  useDaemonOnline: () => true,
}));
const unmockedModule = "../shell/ContentView?unmocked";
const { ContentView }: typeof import("../shell/ContentView") = await import(unmockedModule);

const project = (rules = DEFAULT_RULES): ProjectSnapshot => ({
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: "/repo", color: "#F97316" },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  instances: [],
  rules,
  nextTicketKey: "KIB-13",
});
const working = (state: RunView["state"]) =>
  runFixture({
    id: "r12",
    projectId: "p1",
    label: "opus-dev-1",
    state,
    workspace: "worktree:kib-12",
    cwd: "/wt/kib-12",
  });

beforeEach(() => {
  runs = [];
});

const renderChanges = (worktree: string, snapshot = project()) => {
  const target: TabTarget = { kind: "changes", projectId: "p1", worktree };
  return render(
    <ContentView
      target={target}
      viewer="adam"
      projects={[]}
      project={snapshot}
      domains={[]}
      startEditing={false}
      onNewProject={() => {}}
      onNewPage={() => {}}
      onOpen={() => {}}
      onOpenFile={() => {}}
      onAssign={() => {}}
    />,
  );
};
const loaded = () => screen.findByRole("button", { name: "Pousser et créer la PR" });

test("an agent working in the shown worktree puts a warning above the commit form", async () => {
  runs = [working("running")];
  renderChanges("/wt/kib-12");
  expect(await screen.findByText(WORKING)).toBeTruthy();
});

test("a waiting agent still counts as working there", async () => {
  runs = [working("waiting_input")];
  renderChanges("/wt/kib-12");
  expect(await screen.findByText(WORKING)).toBeTruthy();
});

test("no warning for another worktree or a finished run", async () => {
  runs = [working("running")];
  const { unmount } = renderChanges("/repo");
  await loaded();
  await waitFor(() =>
    expect(screen.getByLabelText("Message")).toHaveProperty("value", "feat: schéma (KIB-12)"),
  );
  expect(screen.queryByText(WORKING)).toBeNull();
  unmount();
  runs = [working("done")];
  renderChanges("/wt/kib-12");
  await loaded();
  await waitFor(() =>
    expect(screen.getByLabelText("Message")).toHaveProperty("value", "feat: schéma (KIB-12)"),
  );
  expect(screen.queryByText(WORKING)).toBeNull();
});

test("the PR dialog tells which rule will move the ticket, only while it is enabled", async () => {
  const { unmount } = renderChanges("/wt/kib-12");
  await userEvent.click(await loaded());
  expect(await within(await screen.findByRole("dialog")).findByText(RULE)).toBeTruthy();
  unmount();
  renderChanges("/wt/kib-12", project(DEFAULT_RULES.map((r) => ({ ...r, enabled: r.when !== "pr_opened" }))));
  await userEvent.click(await loaded());
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByText("Lier la PR à KIB-12");
  expect(within(dialog).queryByText(RULE)).toBeNull();
});
