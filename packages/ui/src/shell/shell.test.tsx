import { beforeEach, expect, mock, test } from "bun:test";
import {
  type CodeEvent,
  type CodeRequest,
  DEFAULT_WORKFLOW,
  EMPTY_TABS,
  type ProjectSnapshot,
  type RpcRequest,
  type TabTarget,
} from "@kibo/schema";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const project: ProjectSnapshot = {
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW,
  pages: [{ id: "1@1", title: "Board", kind: "view", parentId: null }],
  tickets: [
    {
      id: "7@1",
      key: "KIB-7",
      title: "Schéma",
      description: "Voir src/a.ts:3",
      statusId: "todo",
      blockedReason: null,
      domainId: null,
      assignee: null,
      parentId: null,
      externalRefs: [
        { kind: "github_pr", url: "https://github.com/kibo/test/pull/4", number: 4, state: "draft" },
      ],
      progress: { done: 0, total: 0 },
      waitingOn: [],
    },
  ],
  links: [],
  instances: [],
  rules: [],
  nextTicketKey: "KIB-8",
};
const repo: ProjectSnapshot = {
  ...project,
  meta: { id: "p2", name: "Portfolio", key: "POR", folder: "/repo", color: "#8B5CF6" },
  pages: [],
  tickets: [],
};
const snapshots = new Map([
  ["p1", project],
  ["p2", repo],
]);
const saved: RpcRequest[] = [];
const code: CodeRequest[] = [];
const codeListeners = new Set<(e: CodeEvent) => void>();
const counts = { backlog: 0, todo: 1, in_progress: 0, in_review: 0, blocked: 0, done: 0 };
const status = {
  worktree: "/repo",
  branch: "kib-12",
  upstream: null,
  ahead: 0,
  behind: 0,
  hasHead: true,
  operation: null,
  files: [
    { path: "a.ts", origPath: null, area: "staged", kind: "modified", additions: 1, deletions: 0 },
    { path: "a.ts", origPath: null, area: "unstaged", kind: "modified", additions: 1, deletions: 0 },
    { path: "b.ts", origPath: null, area: "unstaged", kind: "added", additions: 2, deletions: 0 },
  ],
  commits: [],
};
const changesResponses: Partial<Record<CodeRequest["method"], unknown>> = {
  diff: {
    path: "a.ts",
    origPath: null,
    binary: false,
    hunkStaging: true,
    additions: 0,
    deletions: 0,
    hunks: [],
  },
  commitDefaults: { ticketId: null, ticketKey: null, message: "", prTitle: "", prBody: "" },
  remoteBranches: { remote: "origin", branches: ["main"], defaultBase: "main" },
  ghStatus: { available: true, detail: null },
  prForBranch: null,
};

mock.module("../state/use-projects", () => ({
  useProjects: () => [
    { ...project.meta, counts },
    { ...repo.meta, counts },
  ],
  useProject: (id: string | null) => (id ? (snapshots.get(id) ?? null) : null),
}));
mock.module("../state/use-agents", () => ({
  useAgents: () => null,
  useConfig: () => null,
  useNow: () => 0,
  useRunLog: () => null,
  useDaemonOnline: () => false,
}));
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      if (req.method === "getTabs") return Promise.resolve(EMPTY_TABS);
      if (req.method === "getProject") return Promise.resolve(snapshots.get(req.projectId));
      saved.push(req);
      if (req.method === "command" && req.command.method === "addPage")
        return Promise.resolve({ id: "9@1", title: req.command.title, kind: "view", parentId: null });
      return Promise.resolve(null);
    },
    code: (req: CodeRequest) => {
      code.push(req);
      if (req.method === "worktrees")
        return Promise.resolve([{ path: "/repo", branch: "kib-12", head: null, isMain: true }]);
      if (req.method === "status") return Promise.resolve(status);
      if (req.method in changesResponses) return Promise.resolve(changesResponses[req.method]);
      if (req.method === "readFile")
        return Promise.resolve({
          path: "src/a.ts",
          revision: "worktree",
          content: "a\nb\n  c\n",
          hash: "a".repeat(40),
          size: 7,
          binary: false,
          tooLarge: false,
          lines: 3,
          modifiedAt: null,
          tracked: true,
          dirty: false,
        });
      return Promise.resolve(null);
    },
    subscribe: () => () => {},
    subscribeCode: (l: (e: CodeEvent) => void) => {
      codeListeners.add(l);
      return () => codeListeners.delete(l);
    },
  },
}));

const unmockedShell = "./Shell?unmocked";
const { Shell }: typeof import("./Shell") = await import(unmockedShell);

const go = async (hash: string) =>
  act(async () => {
    location.hash = hash;
    await new Promise((r) => setTimeout(r, 30));
  });
const renderShell = () => render(<Shell viewer="adam" notifications="native" />);
const crumbs = () => within(screen.getByRole("navigation", { name: "Fil d'Ariane" }));

beforeEach(() => {
  saved.length = 0;
  code.length = 0;
  location.hash = "";
});

test("a page missing from the snapshot does not redirect to the first page", async () => {
  renderShell();
  await go("#/p/p1/2%401");
  expect(location.hash).toBe("#/p/p1/2%401");
});

test("navigation opens a « Projet · Page » tab and the breadcrumb follows", async () => {
  renderShell();
  await go("#/p/p1/1%401");
  const bar = await screen.findByRole("tablist", { name: "Onglets" });
  expect(within(bar).getByRole("tab", { name: "Kibo · Board" }).getAttribute("aria-selected")).toBe("true");
  expect(crumbs().getByText("Kibo")).toBeTruthy();
  expect(crumbs().getByText("Board").getAttribute("aria-current")).toBe("page");
  await waitFor(() => expect(saved.some((r) => r.method === "saveTabs")).toBe(true), { timeout: 1000 });
});

test("⌘K opens the palette, ⌘W closes the tab and returns home", async () => {
  renderShell();
  await go("#/p/p1/1%401");
  await screen.findByRole("tab", { name: "Kibo · Board" });
  fireEvent.keyDown(window, { key: "k", metaKey: true, ctrlKey: false });
  fireEvent.keyDown(window, { key: "k", ctrlKey: true, metaKey: false });
  expect(await screen.findByRole("dialog", { name: "Palette de commandes" })).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.keyDown(window, { key: "w", metaKey: true });
  fireEvent.keyDown(window, { key: "w", ctrlKey: true });
  await waitFor(() => expect(screen.queryByRole("tab", { name: "Kibo · Board" })).toBeNull());
  expect(location.hash).toBe("#/");
});

test("the sidebar search button opens the palette", async () => {
  renderShell();
  await go("#/");
  await userEvent.click(await screen.findByRole("button", { name: /Rechercher…/ }));
  expect(await screen.findByRole("dialog", { name: "Palette de commandes" })).toBeTruthy();
});

test("⌘-click in the sidebar opens a new tab instead of replacing the current one", async () => {
  renderShell();
  await go("#/p/p1/1%401");
  await screen.findByRole("tab", { name: "Kibo · Board" });
  fireEvent.click(screen.getByRole("button", { name: "Kibo" }), { metaKey: true, ctrlKey: true });
  await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(3));
});

test("a ticket tab shows the detail, its PR and opens file links in the preview", async () => {
  renderShell();
  await go("#/p/p1/t/7%401");
  expect(await screen.findByRole("tab", { name: "Kibo · KIB-7" })).toBeTruthy();
  expect(screen.getByText("#4")).toBeTruthy();
  expect(crumbs().getByText("KIB-7").getAttribute("aria-current")).toBe("page");
  await userEvent.click(screen.getByRole("button", { name: "src/a.ts:3" }));
  expect(await screen.findByText("Ligne 3, col 3")).toBeTruthy();
  expect(code.find((c) => c.method === "readFile")).toMatchObject({ path: "src/a.ts", worktree: "/repo" });
});

test("a project without folder has no Changements entry", async () => {
  renderShell();
  await go("#/p/p1/1%401");
  await screen.findByRole("tab", { name: "Kibo · Board" });
  expect(screen.queryByRole("button", { name: /Changements/ })).toBeNull();
});

test("a git project lists Changements with its count, its tab shows the branch and a dot", async () => {
  renderShell();
  await go("#/p/p2/");
  const entry = await screen.findByRole("button", { name: "Changements · 2 fichiers modifiés" });
  expect(within(entry).getByText("2")).toBeTruthy();
  await userEvent.click(entry);
  expect(await screen.findByRole("tab", { name: /Portfolio · Changements/ })).toBeTruthy();
  expect(location.hash).toBe("#/p/p2/changes");
  await waitFor(() => expect(crumbs().getByText("kib-12").getAttribute("aria-current")).toBe("page"));
  expect(crumbs().getByText("Changements")).toBeTruthy();
  expect(screen.getByRole("img", { name: "Changements non commités" })).toBeTruthy();
});

test("an agent screen keeps its URL and opens in a tab like any target", async () => {
  renderShell();
  await go("#/p/p1/1%401");
  await screen.findByRole("tab", { name: "Kibo · Board" });
  await go("#/agents");
  expect(location.hash).toBe("#/agents");
  expect(crumbs().getByText("Agents")).toBeTruthy();
  const agents = await screen.findByRole("tab", { name: "Agents" });
  expect(agents.getAttribute("aria-selected")).toBe("true");
  expect(screen.queryByRole("tab", { name: "Kibo · Board" })).toBeNull();
  await userEvent.click(screen.getByRole("tab", { name: "Accueil" }));
  await waitFor(() => expect(location.hash).toBe("#/"));
  await userEvent.click(screen.getByRole("tab", { name: "Agents" }));
  await waitFor(() => expect(location.hash).toBe("#/agents"));
});

test("the sidebar opens the Components screen in its own tab", async () => {
  renderShell();
  await go("#/");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Composants" }));
  expect(location.hash).toBe("#/components");
  expect(await screen.findByRole("columnheader", { name: "Confiance" })).toBeTruthy();
  expect((await screen.findByRole("tab", { name: "Composants" })).getAttribute("aria-selected")).toBe("true");
  expect(crumbs().getByRole("heading", { level: 1, name: "Composants" }).getAttribute("aria-current")).toBe(
    "page",
  );
});

test("the header offers a ticket in the current project and shows the user's initials", async () => {
  await go("#/");
  renderShell();
  await go("#/");
  const header = () =>
    within(screen.getByRole("navigation", { name: "Fil d'Ariane" }).closest("header") ?? document.body);
  expect(header().queryByRole("button", { name: "Ticket" })).toBeNull();
  const avatar = header().getByRole("img", { name: "adam" });
  expect(avatar.textContent).toBe("AD");
  await go("#/p/p1/1%401");
  await go("#/agents");
  await act(async () => header().getByRole("button", { name: "Ticket" }).click());
  expect(await screen.findByRole("dialog", { name: "Nouveau ticket" })).toBeTruthy();
});

test("initials come from the first two words, or the first two letters", async () => {
  const { initials } = await import("./UserAvatar");
  expect(initials("Adam Benmchichi")).toBe("AB");
  expect(initials("adam")).toBe("AD");
  expect(initials("jean-luc.picard")).toBe("JL");
});

test("openView goes to the view page showing the component, or offers to create it", async () => {
  const { useOpenView } = await import("./use-open-view");
  const opened: TabTarget[] = [];
  const kanban = {
    id: "k1",
    pageId: "1@1",
    component: "kanban@1.0.0",
    layout: { x: 0, y: 0, w: 12, h: 8 },
    config: {},
  };
  let current: ProjectSnapshot = { ...project, instances: [kanban] };
  const get = () => current;
  const go = (t: TabTarget) => opened.push(t);
  function Harness() {
    const { openView, dialog } = useOpenView(get, go);
    return (
      <>
        <button type="button" onClick={() => openView("kanban")}>
          open
        </button>
        {dialog}
      </>
    );
  }
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "open" }));
  expect(opened).toEqual([{ kind: "page", projectId: "p1", pageId: "1@1" }]);
  expect(screen.queryByRole("dialog")).toBeNull();
  current = project;
  await user.click(screen.getByRole("button", { name: "open" }));
  expect(await screen.findByRole("dialog", { name: "Créer une page Kanban ?" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Créer la page" }));
  await waitFor(() => expect(opened.at(-1)).toEqual({ kind: "page", projectId: "p1", pageId: "9@1" }));
  expect(saved.filter((r) => r.method === "command")).toEqual([
    { method: "command", projectId: "p1", command: { method: "addPage", title: "Kanban", kind: "view" } },
    {
      method: "command",
      projectId: "p1",
      command: { method: "addInstance", pageId: "9@1", component: "kanban@1.0.0" },
    },
  ]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
