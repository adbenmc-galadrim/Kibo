import { beforeEach, expect, mock, test } from "bun:test";
import {
  type BranchChanges,
  type CodeEvent,
  type CodeRequest,
  DEFAULT_WORKFLOW,
  type FileDiff,
  type ProjectSnapshot,
  type RepoStatus,
  type TicketView,
} from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: CodeRequest[] = [];
const commit = (sha: string, subject: string, pushed: boolean) => ({
  sha: sha.padEnd(40, "0"),
  shortSha: sha,
  subject,
  body: "",
  author: "Adam",
  time: 0,
  pushed,
});
const status: RepoStatus = {
  worktree: "/emis",
  branch: "feat/stockage-fichiers",
  upstream: "origin/feat/stockage-fichiers",
  ahead: 0,
  behind: 0,
  hasHead: true,
  operation: null,
  files: [],
  commits: [commit("ce43aa1", "feat(api): URL présignées de fichiers", true)],
};
const branch: BranchChanges = {
  base: "origin/dev",
  mergeBase: "7".repeat(40),
  files: [
    { path: "apps/api/src/files.ts", origPath: null, kind: "added", additions: 40, deletions: 0 },
    { path: "docker-compose.yml", origPath: null, kind: "modified", additions: 12, deletions: 3 },
  ],
  additions: 52,
  deletions: 3,
  commits: [
    commit("ce43aa1", "feat(api): URL présignées de fichiers", true),
    commit("48d40fc", "build: MinIO en local et configuration S3", true),
  ],
};
const diffOf = (path: string): FileDiff => ({
  path,
  origPath: null,
  binary: false,
  hunkStaging: false,
  additions: 1,
  deletions: 0,
  hunks: [
    {
      header: `@@ -1 +1,2 @@ ${path}`,
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 2,
      section: "",
      lines: [{ kind: "add", text: "minio:", oldNo: null, newNo: 1, noEol: false }],
    },
  ],
});
const responses: Partial<Record<CodeRequest["method"], (req: CodeRequest) => unknown>> = {
  worktrees: () => [{ path: "/emis", branch: "feat/stockage-fichiers", head: "c".repeat(40), isMain: true }],
  status: () => status,
  branchChanges: () => branch,
  branchDiff: (req) => diffOf(req.method === "branchDiff" ? req.path : ""),
  remoteBranches: () => ({ remote: "origin", branches: ["main", "dev"], defaultBase: "main" }),
  ghStatus: () => ({ available: true, detail: null }),
  prForBranch: () => null,
  commitDefaults: () => ({ ticketId: null, ticketKey: null, message: "", prTitle: "", prBody: "" }),
};
mock.module("../api", () => ({
  client: {
    code: (req: CodeRequest) => {
      calls.push(req);
      return Promise.resolve(responses[req.method]?.(req) ?? null);
    },
    subscribeCode: (_: (e: CodeEvent) => void) => () => {},
  },
}));
const unmockedModule = "./ChangesView?unmocked";
const { ChangesView }: typeof import("./ChangesView") = await import(unmockedModule);

const ticket: TicketView = {
  id: "9@1",
  key: "EMIS-9",
  pendingSeq: null,
  keyLabel: "EMIS-9",
  title: "Stockage des fichiers",
  description: "",
  statusId: "in_review",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  labels: [],
  externalRefs: [
    { kind: "git_branch", branch: "feat/stockage-fichiers", base: null },
    {
      kind: "github_pr",
      url: "https://github.com/galadrimteam/emis/pull/9",
      number: 9,
      state: "draft",
      base: "dev",
      head: null,
    },
  ],
  progress: { done: 0, total: 0 },
  waitingOn: [],
};
const project = (tickets: TicketView[]): ProjectSnapshot => ({
  meta: { id: "p1", name: "Emis", key: "EMIS", folder: "/emis", color: "#F97316", worktree: null },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets,
  links: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "EMIS-10",
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
});

beforeEach(() => {
  calls.length = 0;
});

const renderView = (tickets: TicketView[] = [], remote = false) =>
  render(
    <ChangesView
      project={project(tickets)}
      worktree={null}
      onWorktreeChange={() => {}}
      onOpenFile={() => {}}
      onOpenInTab={() => {}}
      remote={remote}
    />,
  );

test("a clean worktree shows the branch work since its base, first file diffed read only", async () => {
  renderView();
  const section = await screen.findByRole("region", {
    name: "Branche · 2 fichiers · +52 −3 depuis origin/dev",
  });
  expect(screen.getByText("Aucun changement non commité.")).toBeTruthy();
  expect(within(section).queryAllByRole("checkbox")).toHaveLength(0);
  await screen.findByRole("region", { name: "@@ -1 +1,2 @@ apps/api/src/files.ts" });
  expect(screen.queryByRole("button", { name: /bloc/ })).toBeNull();
  await userEvent.click(within(section).getByRole("button", { name: /docker-compose\.yml/ }));
  await screen.findByRole("region", { name: "@@ -1 +1,2 @@ docker-compose.yml" });
  expect(calls.filter((c) => c.method === "branchDiff").at(-1)).toMatchObject({
    path: "docker-compose.yml",
    origPath: null,
  });
});

test("every commit of the branch is listed, pushed ones counted out", async () => {
  renderView();
  const heading = await screen.findByRole("heading", { name: "Commits de la branche" });
  const commits = heading.closest("section");
  if (!commits) throw new Error("commits section expected");
  await waitFor(() => expect(within(commits).getAllByRole("listitem")).toHaveLength(2));
  expect(within(commits).getByText("↑0")).toBeTruthy();
  expect(screen.queryByText("Commits non poussés")).toBeNull();
});

test("the PR of the ticket's branch replaces « Pousser et créer la PR »", async () => {
  renderView([ticket]);
  const link = await screen.findByRole("link", { name: "Voir la PR #9" });
  expect(link.getAttribute("href")).toBe("https://github.com/galadrimteam/emis/pull/9");
  expect(screen.queryByRole("button", { name: "Pousser et créer la PR" })).toBeNull();
});

test("a remote viewer reads the branch work too", async () => {
  renderView([], true);
  await screen.findByRole("region", { name: "Branche · 2 fichiers · +52 −3 depuis origin/dev" });
  await screen.findByRole("region", { name: "@@ -1 +1,2 @@ apps/api/src/files.ts" });
});
