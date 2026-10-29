import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import {
  type AgentsState,
  type CodeEvent,
  type CodeRequest,
  DEFAULT_WORKFLOW,
  EMPTY_PROGRESS,
  EMPTY_TABS,
  INBOX_ID,
  type ProjectSnapshot,
  type RpcRequest,
  type TabTarget,
} from "@kibo/schema";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { agentsFixture } from "../lib/fixtures";
import { isMac, shortcutLabel } from "../lib/shortcut-label";
import { signalsView } from "../project-agent/signal-fixtures";
import { targetToHash } from "../tabs/target-hash";

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
    description: null,
    client: null,
  },
  workflow: DEFAULT_WORKFLOW,
  pages: [
    { id: "1@1", title: "Board", kind: "view", parentId: null },
    { id: "5@1", title: "Tableau de bord", kind: "dashboard", parentId: null },
  ],
  tickets: [
    {
      id: "7@1",
      key: "KIB-7",
      pendingSeq: null,
      hold: null,
      keyLabel: "KIB-7",
      title: "Schéma",
      description: "Voir src/a.ts:3",
      statusId: "todo",
      blockedReason: null,
      domainId: null,
      assignee: null,
      parentId: null,
      labels: [],
      externalRefs: [
        {
          kind: "github_pr",
          url: "https://github.com/kibo/test/pull/4",
          number: 4,
          state: "draft",
          base: null,
          head: null,
          review: "none",
          checks: null,
        },
      ],
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
    },
  ],
  links: [],
  questions: [],
  questionRecipients: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-8",
  sprints: [],
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
};
const repo: ProjectSnapshot = {
  ...project,
  meta: {
    id: "p2",
    name: "Portfolio",
    key: "POR",
    folder: "/repo",
    color: "#8B5CF6",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  },
  pages: [],
  tickets: [],
};
const readOnly: ProjectSnapshot = {
  ...project,
  meta: { ...project.meta, id: "p3", name: "Lecture", key: "LEC" },
  sync: { shared: true, keyAllocator: "server", role: "viewer", access: "read-only", members: [] },
};
const sharedProject: ProjectSnapshot = {
  ...project,
  meta: { ...project.meta, id: "p4", name: "Partagé", key: "PAR" },
  sync: { shared: true, keyAllocator: "server", role: "owner", access: "write", members: [] },
};
const inboxTicket = (id: string, key: string, statusId: "todo" | "done") => {
  const [model] = project.tickets;
  if (!model) throw new Error("fixture without ticket");
  return { ...model, id, key, keyLabel: key, title: `Idée ${key}`, statusId, externalRefs: [] };
};
const inbox: ProjectSnapshot = {
  ...project,
  meta: {
    id: INBOX_ID,
    name: "Inbox",
    key: "INB",
    folder: null,
    color: "#64748B",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  },
  pages: [],
  tickets: [
    inboxTicket("i1", "INB-1", "todo"),
    inboxTicket("i2", "INB-2", "todo"),
    inboxTicket("i3", "INB-3", "todo"),
    inboxTicket("i4", "INB-4", "done"),
  ],
  nextTicketKey: "INB-5",
  sprints: [],
};
const snapshots = new Map([
  [INBOX_ID, inbox],
  ["p1", project],
  ["p2", repo],
  ["p3", readOnly],
  ["p4", sharedProject],
]);
const saved: RpcRequest[] = [];
const code: CodeRequest[] = [];
let statusPending = false;
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
  useProjects: () => ({
    projects: [
      { ...project.meta, counts },
      { ...repo.meta, counts },
      { ...readOnly.meta, counts },
      { ...sharedProject.meta, counts },
    ],
    error: null,
    retry: () => {},
  }),
  useProject: (id: string | null) => (id ? (snapshots.get(id) ?? null) : null),
}));
let agents: AgentsState | null = null;
mock.module("../state/use-agents", () => ({
  useAgents: () => agents,
  useConfig: () => null,
  useNow: () => 0,
  useRunLog: () => ({ log: null, missing: false }),
  useDaemonOnline: () => false,
}));
mock.module("../api", () =>
  apiMock({
    onWrite: () => () => {},
    client: {
      rpc: (req: RpcRequest) => {
        if (req.method === "getTabs") return Promise.resolve(EMPTY_TABS);
        if (req.method === "getProject") return Promise.resolve(snapshots.get(req.projectId));
        if (req.method === "getProjectAgent")
          return Promise.resolve({ session: null, run: null, batches: [], past: [], memoryPath: "m.md" });
        if (req.method === "listSignals") return Promise.resolve(signalsView());
        if (req.method === "agents.list")
          return Promise.resolve({ agents: [], notices: [], partialWatch: false });
        saved.push(req);
        if (req.method === "command" && req.command.method === "addPage")
          return Promise.resolve({ id: "9@1", title: req.command.title, kind: "view", parentId: null });
        return Promise.resolve(null);
      },
      code: (req: CodeRequest) => {
        code.push(req);
        if (req.method === "worktrees")
          return Promise.resolve([{ path: "/repo", branch: "kib-12", head: null, isMain: true }]);
        if (req.method === "status") return statusPending ? new Promise(() => {}) : Promise.resolve(status);
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
      subscribeEvents: () => () => {},
      subscribeAi: () => () => {},
      subscribeTopic: () => () => {},
      subscribeIntegrations: () => () => undefined,
      subscribeCode: (l: (e: CodeEvent) => void) => {
        codeListeners.add(l);
        return () => codeListeners.delete(l);
      },
    },
  }),
);

const unmockedShell = "./Shell?unmocked";
const { Shell }: typeof import("./Shell") = await import(unmockedShell);

const go = async (hash: string) =>
  act(async () => {
    location.hash = hash;
    await new Promise((r) => setTimeout(r, 30));
  });
const renderShell = () => render(<Shell viewer="adam" notifications="native" />);
const crumbs = () => within(screen.getByRole("navigation", { name: "Fil d'Ariane" }));
const expectTitle = (title: string) => waitFor(() => expect(document.title).toBe(`${title} — Kibo`));
const workspaceMenu = async () => {
  await userEvent.click(await screen.findByRole("button", { name: "Perso" }));
  return within(await screen.findByRole("menu"));
};

const realMatchMedia = window.matchMedia;
const wideScreen = (media: string): MediaQueryList =>
  Object.assign(new EventTarget(), {
    matches: false,
    media,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
  });
beforeEach(() => {
  window.matchMedia = wideScreen;
});
afterEach(() => {
  window.matchMedia = realMatchMedia;
});

beforeEach(() => {
  agents = null;
  localStorage.removeItem("kibo.projectAgent.open");
  saved.length = 0;
  code.length = 0;
  statusPending = false;
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
  await expectTitle("Kibo · Board");
  expect(screen.queryByRole("tablist", { name: "Onglets" })).toBeNull();
  expect(crumbs().getByText("Kibo")).toBeTruthy();
  expect(crumbs().getByText("Board").getAttribute("aria-current")).toBe("page");
  await waitFor(() => expect(saved.some((r) => r.method === "saveTabs")).toBe(true), { timeout: 1000 });
  fireEvent.click(crumbs().getByRole("button", { name: "Kibo" }));
  await waitFor(() => expect(location.hash).toBe(targetToHash(dashboard)));
  expect(crumbs().getByText("Tableau de bord").getAttribute("aria-current")).toBe("page");
});

const dashboard: TabTarget = { kind: "page", projectId: "p1", pageId: "5@1" };
const sidebarProject = async (name: string) => {
  const entry = (await screen.findAllByRole("button", { name })).find(
    (b) => b.closest('[data-sidebar="menu-item"]') !== null,
  );
  if (!entry) throw new Error(`no sidebar entry ${name}`);
  return entry;
};

test("clicking a project in the sidebar opens its « Tableau de bord » page", async () => {
  renderShell();
  await go("#/");
  fireEvent.click(await sidebarProject("Kibo"));
  await waitFor(() => expect(location.hash).toBe(targetToHash(dashboard)));
  await expectTitle("Kibo · Tableau de bord");
});

test("landing on the dashboard replaces the project history entry", async () => {
  renderShell();
  await go(targetToHash({ kind: "page", projectId: "p3", pageId: "1@1" }));
  const replace = spyOn(history, "replaceState");
  try {
    fireEvent.click(await sidebarProject("Kibo"));
    await waitFor(() => expect(location.hash).toBe(targetToHash(dashboard)));
    expect(replace.mock.calls.map((c) => c[2])).toContain(targetToHash(dashboard));
  } finally {
    replace.mockRestore();
  }
});

test("a project tab without a page lands on the dashboard", async () => {
  renderShell();
  await go(targetToHash({ kind: "project", projectId: "p1" }));
  await waitFor(() => expect(location.hash).toBe(targetToHash(dashboard)));
  expect(screen.queryByRole("tab", { name: "Kibo · aperçu" })).toBeNull();
});

test("a project without pages shows its empty state, never a blank page", async () => {
  renderShell();
  await go("#/");
  fireEvent.click(await sidebarProject("Portfolio"));
  expect(await screen.findByText("Projet créé : Portfolio")).toBeTruthy();
  expect(location.hash).toBe(targetToHash({ kind: "project", projectId: "p2" }));
});

test("⌘K opens the palette, ⌘W closes the tab and returns home", async () => {
  renderShell();
  await go("#/p/p1/1%401");
  await expectTitle("Kibo · Board");
  fireEvent.keyDown(window, { key: "k", metaKey: true, ctrlKey: false });
  fireEvent.keyDown(window, { key: "k", ctrlKey: true, metaKey: false });
  expect(await screen.findByRole("dialog", { name: "Palette de commandes" })).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.keyDown(window, { key: "w", metaKey: true });
  fireEvent.keyDown(window, { key: "w", ctrlKey: true });
  await waitFor(() => expect(location.hash).toBe("#/"));
});

test("the sidebar search button opens the palette", async () => {
  renderShell();
  await go("#/");
  await userEvent.click(await screen.findByRole("button", { name: /Rechercher/ }));
  expect(await screen.findByRole("dialog", { name: "Palette de commandes" })).toBeTruthy();
});

test("the document title follows the active tab and the search shows the platform shortcut", async () => {
  renderShell();
  await go("#/");
  await waitFor(() => expect(document.title).toBe("Kibo"));
  const search = await screen.findByRole("button", { name: /Rechercher/ });
  expect(search.textContent).toContain(shortcutLabel(["K"], isMac()));
  await go("#/p/p1/1%401");
  await expectTitle("Kibo · Board");
});

test("⌘-click in the sidebar opens a new tab instead of replacing the current one", async () => {
  renderShell();
  await go("#/p/p1/1%401");
  await expectTitle("Kibo · Board");
  const inSidebar = screen
    .getAllByRole("button", { name: "Kibo" })
    .find((b) => !b.closest('nav[aria-label="Fil d\'Ariane"]'));
  if (!inSidebar) throw new Error("sidebar entry Kibo missing");
  fireEvent.click(inSidebar, { metaKey: true, ctrlKey: true });
  await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(3));
});

test("navigation opens one preview tab, a double click in the sidebar opens a kept tab", async () => {
  renderShell();
  await go("#/p/p1/1%401");
  await expectTitle("Kibo · Board");
  await go("#/settings/general");
  await expectTitle("Général");
  expect(screen.queryByRole("tablist", { name: "Onglets" })).toBeNull();
  const inbox = screen.getByRole("button", { name: "Boîte de réception" });
  fireEvent.click(inbox);
  fireEvent.doubleClick(inbox);
  await expectTitle("Boîte de réception");
  fireEvent.click(screen.getByRole("button", { name: "Mes tickets" }), { metaKey: true, ctrlKey: true });
  const bar = await screen.findByRole("tablist", { name: "Onglets" });
  const kept = await within(bar).findByRole("tab", { name: "Boîte de réception" });
  expect(kept.getAttribute("data-preview")).toBe("false");
  expect(bar.querySelectorAll('[data-preview="true"]')).toHaveLength(0);
});

test("a ticket tab shows the detail, its PR and opens file links in the preview", async () => {
  renderShell();
  await go("#/p/p1/t/7%401");
  await expectTitle("KIB-7 · Schéma");
  expect(await screen.findByRole("link", { name: "#4" })).toBeTruthy();
  expect(crumbs().getByText("KIB-7").getAttribute("aria-current")).toBe("page");
  await userEvent.click(screen.getByRole("button", { name: "src/a.ts:3" }));
  expect(await screen.findByText("Ligne 3 · Col 3")).toBeTruthy();
  expect(code.find((c) => c.method === "readFile")).toMatchObject({ path: "src/a.ts", worktree: "/repo" });
});

test("a project without folder has no Changements entry", async () => {
  renderShell();
  await go("#/p/p1/1%401");
  await expectTitle("Kibo · Board");
  const menu = await workspaceMenu();
  expect(menu.queryByRole("menuitem", { name: /Changements/ })).toBeNull();
});

test("a git project no longer offers Changements in the workspace menu", async () => {
  renderShell();
  await go("#/p/p2/");
  await expectTitle("Portfolio");
  expect((await workspaceMenu()).queryByRole("menuitem", { name: "Changements" })).toBeNull();
});

test("an agent-era URL leads back home, the tracking screens stay", async () => {
  renderShell();
  for (const hash of ["#/agents", "#/agents/queue", "#/components", "#/settings/domains", "#/p/p2/changes"]) {
    await go("#/p/p1/1%401");
    await expectTitle("Kibo · Board");
    await go(hash);
    await waitFor(() => expect(location.hash).toBe("#/"));
  }
  await go("#/inbox");
  await expectTitle("Boîte de réception");
  expect(location.hash).toBe("#/inbox");
});

test("the sidebar lists the inbox after my tickets with its open count, and opens it (screen 113)", async () => {
  renderShell();
  await go("#/");
  const entry = await screen.findByRole("button", { name: "Boîte de réception" });
  await waitFor(() => expect(entry.closest("li")?.textContent).toBe("Boîte de réception3"));
  const labels = within(entry.closest("ul") ?? document.body)
    .getAllByRole("button")
    .map((b) => b.textContent?.replace(/\d+$/, ""));
  expect(labels.indexOf("Boîte de réception")).toBe(labels.indexOf("Mes tickets") + 1);
  await userEvent.click(entry);
  expect(location.hash).toBe("#/inbox");
  await expectTitle("Boîte de réception");
  expect(await screen.findByRole("row", { name: /INB-2/ })).toBeTruthy();
  expect(screen.getAllByRole("heading", { level: 1, name: "Boîte de réception" })).toHaveLength(1);
  expect(entry.getAttribute("data-active")).toBe("true");
});

test("the workspace menu no longer offers the Components screen", async () => {
  renderShell();
  await go("#/");
  expect((await workspaceMenu()).queryByRole("menuitem", { name: "Composants" })).toBeNull();
});

test("the header offers no ticket button; the account sits at the foot of the sidebar with its initials", async () => {
  renderShell();
  await go("#/");
  const header = within(
    screen.getByRole("navigation", { name: "Fil d'Ariane" }).closest("header") ?? document.body,
  );
  expect(header.queryByRole("button", { name: /^Ticket/ })).toBeNull();
  expect(header.queryByRole("button", { name: "Menu de adam" })).toBeNull();
  expect((await screen.findByRole("button", { name: "Menu de adam" })).textContent).toContain("AD");
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
  const graph = {
    id: "k1",
    pageId: "1@1",
    component: "graph@1.0.0",
    layout: { x: 0, y: 0, w: 12, h: 8 },
    config: {},
    componentHash: null,
  };
  let current: ProjectSnapshot = { ...project, instances: [graph] };
  const get = () => current;
  const go = (t: TabTarget) => opened.push(t);
  function Harness() {
    const { openView, dialog } = useOpenView(get, go);
    return (
      <>
        <button type="button" onClick={() => openView("graph")}>
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
  expect(await screen.findByRole("dialog", { name: "Créer une page Graphe de dépendances ?" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Créer la page" }));
  await waitFor(() => expect(opened.at(-1)).toEqual({ kind: "page", projectId: "p1", pageId: "9@1" }));
  expect(saved.filter((r) => r.method === "command")).toEqual([
    {
      method: "command",
      projectId: "p1",
      command: { method: "addPage", title: "Graphe de dépendances", kind: "view" },
    },
    {
      method: "command",
      projectId: "p1",
      command: { method: "addInstance", pageId: "9@1", component: "graph@1.0.0" },
    },
  ]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("openView can target another project than the current one, by its snapshot", async () => {
  const { useOpenView } = await import("./use-open-view");
  const opened: TabTarget[] = [];
  const graph = {
    id: "k2",
    pageId: "1@1",
    component: "graph@1.0.0",
    layout: { x: 0, y: 0, w: 12, h: 8 },
    config: {},
    componentHash: null,
  };
  const other: ProjectSnapshot = { ...project, meta: { ...project.meta, id: "p2" }, instances: [graph] };
  function Harness() {
    const { openView, dialog } = useOpenView(
      () => project,
      (t) => opened.push(t),
      (projectId) => (projectId === "p2" ? other : null),
    );
    return (
      <>
        <button type="button" onClick={() => openView("graph", "p2")}>
          open p2
        </button>
        <button type="button" onClick={() => openView("questions", "p2")}>
          questions p2
        </button>
        {dialog}
      </>
    );
  }
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "open p2" }));
  expect(opened).toEqual([{ kind: "page", projectId: "p2", pageId: "1@1" }]);
  await user.click(screen.getByRole("button", { name: "questions p2" }));
  expect(await screen.findByRole("dialog", { name: "Créer une page Questions ?" })).toBeTruthy();
});

test("openView aims the view page at one question, even through the page it creates", async () => {
  const { useOpenView } = await import("./use-open-view");
  const opened: TabTarget[] = [];
  const questions = {
    id: "k3",
    pageId: "1@1",
    component: "questions@1.0.0",
    layout: { x: 0, y: 0, w: 12, h: 8 },
    config: {},
    componentHash: null,
  };
  let current: ProjectSnapshot = { ...project, instances: [questions] };
  function Harness() {
    const { openView, dialog } = useOpenView(
      () => current,
      (t) => opened.push(t),
    );
    return (
      <>
        <button
          type="button"
          onClick={() => openView("questions", undefined, { kind: "question", id: "q1" })}
        >
          open
        </button>
        {dialog}
      </>
    );
  }
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "open" }));
  expect(opened).toEqual([{ kind: "page", projectId: "p1", pageId: "1@1", question: "q1" }]);
  current = project;
  await user.click(screen.getByRole("button", { name: "open" }));
  await user.click(await screen.findByRole("button", { name: "Créer la page" }));
  await waitFor(() =>
    expect(opened.at(-1)).toEqual({ kind: "page", projectId: "p1", pageId: "9@1", question: "q1" }),
  );
});

test("openView hands any other intent to the page it opens, outside the address", async () => {
  const { useOpenView } = await import("./use-open-view");
  const { pageIntents } = await import("../pages/page-intents");
  const opened: TabTarget[] = [];
  const questions = {
    id: "k3",
    pageId: "1@1",
    component: "questions@1.0.0",
    layout: { x: 0, y: 0, w: 12, h: 8 },
    config: {},
    componentHash: null,
  };
  let current: ProjectSnapshot = { ...project, instances: [questions] };
  function Harness() {
    const { openView, dialog } = useOpenView(
      () => current,
      (t) => opened.push(t),
    );
    return (
      <>
        <button
          type="button"
          onClick={() => openView("questions", undefined, { kind: "newQuestion", ticketId: "f5" })}
        >
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
  expect(pageIntents.take("1@1")?.intent).toEqual({ kind: "newQuestion", ticketId: "f5" });
  current = project;
  await user.click(screen.getByRole("button", { name: "open" }));
  await user.click(await screen.findByRole("button", { name: "Créer la page" }));
  await waitFor(() => expect(opened.at(-1)).toEqual({ kind: "page", projectId: "p1", pageId: "9@1" }));
  expect(pageIntents.take("9@1")?.intent).toEqual({ kind: "newQuestion", ticketId: "f5" });
});

test("a read-only project hides page and ticket creation", async () => {
  renderShell();
  await go("#/p/p3/");
  expect(await screen.findByText("Cette page est vide : ajoute un composant pour commencer.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Nouvelle page" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Ajouter un composant/ })).toBeNull();
});

test("the project agent opens from the header and ⌘J, follows the project pages and closes without project", async () => {
  renderShell();
  await go("#/p/p1/1%401");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Agent de projet" }));
  expect(await screen.findByRole("dialog", { name: "Agent de projet · Kibo" })).toBeTruthy();
  await go("#/p/p1/");
  expect(screen.getByRole("dialog", { name: "Agent de projet · Kibo" })).toBeTruthy();
  fireEvent.keyDown(window, { key: "j", metaKey: true });
  fireEvent.keyDown(window, { key: "j", ctrlKey: true });
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Agent de projet · Kibo" })).toBeNull());
  fireEvent.keyDown(window, { key: "j", metaKey: isMac(), ctrlKey: !isMac() });
  expect(await screen.findByRole("dialog", { name: "Agent de projet · Kibo" })).toBeTruthy();
  await go("#/");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: /^Agent de projet/ })).toBeNull());
  expect(screen.queryByRole("button", { name: "Agent de projet" })).toBeNull();
});

test("a read-only project has no project agent: no button, ⌘J does nothing", async () => {
  renderShell();
  await go("#/p/p3/");
  await screen.findByText("Cette page est vide : ajoute un composant pour commencer.");
  expect(screen.queryByRole("button", { name: /^Agent de projet/ })).toBeNull();
  fireEvent.keyDown(window, { key: "j", metaKey: isMac(), ctrlKey: !isMac() });
  await act(async () => {});
  expect(screen.queryByRole("dialog", { name: /^Agent de projet/ })).toBeNull();
  expect(localStorage.getItem("kibo.projectAgent.open")).toBeNull();
});

const screenWidth = (narrow: boolean) => {
  const real = window.matchMedia;
  window.matchMedia = (media: string): MediaQueryList =>
    Object.assign(new EventTarget(), {
      matches: narrow,
      media,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
    });
  return () => {
    window.matchMedia = real;
  };
};

test("under 1180 px the project agent covers the content instead of docking", async () => {
  const restore = screenWidth(true);
  renderShell();
  await go("#/p/p1/");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Agent de projet" }));
  const panel = await screen.findByRole("dialog", { name: "Agent de projet · Kibo" });
  expect(panel.dataset.overlay).toBe("true");
  expect(document.documentElement.style.getPropertyValue("--project-agent-w")).toBe("");
  restore();
});

test("the project agent docks beside the content under the tab bar, its button stays pressed and closes it", async () => {
  const restore = screenWidth(false);
  renderShell();
  await go("#/p/p1/");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Agent de projet" }));
  const panel = await screen.findByRole("dialog", { name: "Agent de projet · Kibo" });
  expect(panel.style.top).toBe("var(--tabbar-h)");
  expect(panel.style.height).toBe("auto");
  expect(panel.style.width).toBe("340px");
  const docked = () => document.documentElement.style.getPropertyValue("--project-agent-w");
  expect(docked()).toBe("341px");
  const button = screen.getByRole("button", { name: "Agent de projet" });
  expect(button.getAttribute("aria-pressed")).toBe("true");
  await user.click(button);
  await waitFor(() => expect(screen.queryByRole("dialog", { name: /^Agent de projet/ })).toBeNull());
  expect(screen.getByRole("button", { name: "Agent de projet" }).getAttribute("aria-pressed")).toBe("false");
  expect(docked()).toBe("");
  restore();
});

test("the signal badge of the header opens the project agent conversation", async () => {
  agents = { ...agentsFixture(), signals: [{ projectId: "p1", open: 3, unread: 3 }] };
  renderShell();
  await go("#/p/p1/");
  const user = userEvent.setup();
  expect(await screen.findByRole("button", { name: "Agent de projet · 3 signaux en boîte" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Ouvrir l'agent de projet" }));
  const panel = await screen.findByRole("dialog", { name: "Agent de projet · Kibo" });
  expect(within(panel).queryByRole("tab")).toBeNull();
});
