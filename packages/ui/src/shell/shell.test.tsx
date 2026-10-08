import { beforeEach, expect, mock, test } from "bun:test";
import {
  type CodeEvent,
  type CodeRequest,
  DEFAULT_WORKFLOW,
  EMPTY_TABS,
  INBOX_ID,
  type ProjectSnapshot,
  type RpcRequest,
  type SyncStatus,
  type TabTarget,
} from "@kibo/schema";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { isMac, shortcutLabel } from "../lib/shortcut-label";
import { targetToHash } from "../tabs/target-hash";

const project: ProjectSnapshot = {
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6", worktree: null },
  workflow: DEFAULT_WORKFLOW,
  pages: [{ id: "1@1", title: "Board", kind: "view", parentId: null }],
  tickets: [
    {
      id: "7@1",
      key: "KIB-7",
      pendingSeq: null,
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
        },
      ],
      progress: { done: 0, total: 0 },
      waitingOn: [],
      openQuestions: 0,
    },
  ],
  links: [],
  questions: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-8",
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
};
const repo: ProjectSnapshot = {
  ...project,
  meta: { id: "p2", name: "Portfolio", key: "POR", folder: "/repo", color: "#8B5CF6", worktree: null },
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
  meta: { id: INBOX_ID, name: "Inbox", key: "INB", folder: null, color: "#64748B", worktree: null },
  pages: [],
  tickets: [
    inboxTicket("i1", "INB-1", "todo"),
    inboxTicket("i2", "INB-2", "todo"),
    inboxTicket("i3", "INB-3", "todo"),
    inboxTicket("i4", "INB-4", "done"),
  ],
  nextTicketKey: "INB-5",
};
const snapshots = new Map([
  [INBOX_ID, inbox],
  ["p1", project],
  ["p2", repo],
  ["p3", readOnly],
  ["p4", sharedProject],
]);
const unconfigured: SyncStatus = {
  state: "unconfigured",
  serverUrl: null,
  user: null,
  deviceId: null,
  retryAt: null,
  lastError: null,
  projects: [],
};
let syncStatus: SyncStatus = unconfigured;
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
mock.module("../state/use-agents", () => ({
  useAgents: () => null,
  useConfig: () => null,
  useNow: () => 0,
  useRunLog: () => ({ log: null, missing: false }),
  useDaemonOnline: () => false,
}));
mock.module("../api", () => ({
  onWrite: () => () => {},
  client: {
    rpc: (req: RpcRequest) => {
      if (req.method === "getTabs") return Promise.resolve(EMPTY_TABS);
      if (req.method === "getProject") return Promise.resolve(snapshots.get(req.projectId));
      if (req.method === "getSyncStatus") return Promise.resolve(syncStatus);
      if (req.method === "getPresence") return Promise.resolve([]);
      if (req.method === "setPresence") return Promise.resolve(null);
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
    subscribeEvents: () => () => {},
    subscribeAi: () => () => {},
    subscribeIntegrations: () => () => undefined,
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
  syncStatus = unconfigured;
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
  expect(within(bar).getByRole("tab", { name: "Kibo · Board · aperçu" }).getAttribute("aria-selected")).toBe(
    "true",
  );
  expect(crumbs().getByText("Kibo")).toBeTruthy();
  expect(crumbs().getByText("Board").getAttribute("aria-current")).toBe("page");
  await waitFor(() => expect(saved.some((r) => r.method === "saveTabs")).toBe(true), { timeout: 1000 });
  fireEvent.click(crumbs().getByRole("button", { name: "Kibo" }));
  await waitFor(() => expect(location.hash).toBe(targetToHash({ kind: "project", projectId: "p1" })));
  expect(crumbs().queryByRole("button")).toBeNull();
});

test("⌘K opens the palette, ⌘W closes the tab and returns home", async () => {
  renderShell();
  await go("#/p/p1/1%401");
  await screen.findByRole("tab", { name: "Kibo · Board · aperçu" });
  fireEvent.keyDown(window, { key: "k", metaKey: true, ctrlKey: false });
  fireEvent.keyDown(window, { key: "k", ctrlKey: true, metaKey: false });
  expect(await screen.findByRole("dialog", { name: "Palette de commandes" })).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.keyDown(window, { key: "w", metaKey: true });
  fireEvent.keyDown(window, { key: "w", ctrlKey: true });
  await waitFor(() => expect(screen.queryByRole("tab", { name: "Kibo · Board · aperçu" })).toBeNull());
  expect(location.hash).toBe("#/");
});

test("the sidebar search button opens the palette", async () => {
  renderShell();
  await go("#/");
  await userEvent.click(await screen.findByRole("button", { name: /Rechercher…/ }));
  expect(await screen.findByRole("dialog", { name: "Palette de commandes" })).toBeTruthy();
});

test("the document title follows the active tab and the search shows the platform shortcut", async () => {
  renderShell();
  await go("#/");
  await waitFor(() => expect(document.title).toBe("Kibo"));
  const search = await screen.findByRole("button", { name: /Rechercher…/ });
  expect(search.textContent).toContain(shortcutLabel(["K"], isMac()));
  await go("#/p/p1/1%401");
  await screen.findByRole("tab", { name: "Kibo · Board · aperçu" });
  await waitFor(() => expect(document.title).toBe("Kibo · Board — Kibo"));
});

test("⌘-click in the sidebar opens a new tab instead of replacing the current one", async () => {
  renderShell();
  await go("#/p/p1/1%401");
  await screen.findByRole("tab", { name: "Kibo · Board · aperçu" });
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
  const bar = await screen.findByRole("tablist", { name: "Onglets" });
  await within(bar).findByRole("tab", { name: "Kibo · Board · aperçu" });
  await go("#/agents");
  await within(bar).findByRole("tab", { name: "Agents · aperçu" });
  expect(bar.querySelectorAll('[data-preview="true"]')).toHaveLength(1);
  const inbox = screen.getByRole("button", { name: "Boîte de réception" });
  fireEvent.click(inbox);
  fireEvent.doubleClick(inbox);
  const kept = await within(bar).findByRole("tab", { name: "Boîte de réception" });
  expect(kept.getAttribute("data-preview")).toBe("false");
  expect(bar.querySelectorAll('[data-preview="true"]')).toHaveLength(0);
});

test("a ticket tab shows the detail, its PR and opens file links in the preview", async () => {
  renderShell();
  await go("#/p/p1/t/7%401");
  expect(await screen.findByRole("tab", { name: "Kibo · KIB-7 · aperçu" })).toBeTruthy();
  expect(await screen.findByRole("link", { name: "#4" })).toBeTruthy();
  expect(crumbs().getByText("KIB-7").getAttribute("aria-current")).toBe("page");
  await userEvent.click(screen.getByRole("button", { name: "src/a.ts:3" }));
  expect(await screen.findByText("Ligne 3 · Col 3")).toBeTruthy();
  expect(code.find((c) => c.method === "readFile")).toMatchObject({ path: "src/a.ts", worktree: "/repo" });
});

test("a project without folder has no Changements entry", async () => {
  renderShell();
  await go("#/p/p1/1%401");
  await screen.findByRole("tab", { name: "Kibo · Board · aperçu" });
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
  await screen.findByRole("tab", { name: "Kibo · Board · aperçu" });
  await go("#/agents");
  expect(location.hash).toBe("#/agents");
  expect(crumbs().getByText("Agents")).toBeTruthy();
  const agents = await screen.findByRole("tab", { name: "Agents · aperçu" });
  expect(agents.getAttribute("aria-selected")).toBe("true");
  expect(screen.queryByRole("tab", { name: "Kibo · Board · aperçu" })).toBeNull();
  await userEvent.click(screen.getByRole("tab", { name: "Accueil" }));
  await waitFor(() => expect(location.hash).toBe("#/"));
  await userEvent.click(screen.getByRole("tab", { name: "Agents · aperçu" }));
  await waitFor(() => expect(location.hash).toBe("#/agents"));
});

test("the sidebar lists the inbox after my tickets with its open count, and opens it (screen 113)", async () => {
  renderShell();
  await go("#/");
  const entry = await screen.findByRole("button", { name: "Boîte de réception" });
  await waitFor(() => expect(entry.closest("li")?.textContent).toBe("Boîte de réception3"));
  const labels = within(entry.closest("ul") ?? document.body)
    .getAllByRole("button")
    .map((b) => b.textContent);
  expect(labels.indexOf("Boîte de réception")).toBe(labels.indexOf("Mes tickets") + 1);
  await userEvent.click(entry);
  expect(location.hash).toBe("#/inbox");
  expect(await screen.findByRole("tab", { name: "Boîte de réception · aperçu" })).toBeTruthy();
  expect(await screen.findByRole("row", { name: /INB-2/ })).toBeTruthy();
  expect(screen.getAllByRole("heading", { level: 1, name: "Boîte de réception" })).toHaveLength(1);
  expect(entry.getAttribute("data-active")).toBe("true");
});

test("the sidebar opens the Components screen in its own tab", async () => {
  renderShell();
  await go("#/");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Composants" }));
  expect(location.hash).toBe("#/components");
  expect(await screen.findByRole("columnheader", { name: "Confiance" })).toBeTruthy();
  expect(
    (await screen.findByRole("tab", { name: "Composants · aperçu" })).getAttribute("aria-selected"),
  ).toBe("true");
  expect(crumbs().queryByRole("heading", { level: 1 })).toBeNull();
  expect(crumbs().getByText("Composants").getAttribute("aria-current")).toBe("page");
  expect(screen.getAllByRole("heading", { level: 1, name: "Composants" })).toHaveLength(1);
});

test("the header always offers a ticket: in the inbox, then in the last project, and shows the initials", async () => {
  await go("#/");
  renderShell();
  await go("#/");
  const header = () =>
    within(screen.getByRole("navigation", { name: "Fil d'Ariane" }).closest("header") ?? document.body);
  const button = () => header().getByRole("button", { name: "Ticket" });
  expect(button().getAttribute("title")).toBe("Nouveau ticket dans Boîte de réception");
  const avatar = header().getByRole("img", { name: "adam" });
  expect(avatar.textContent).toBe("AD");
  await act(async () => button().click());
  const inboxDialog = await screen.findByRole("dialog", { name: "Nouveau ticket" });
  expect(within(inboxDialog).getByRole("combobox", { name: "Projet" }).textContent).toBe(
    "Boîte de réception",
  );
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await go("#/p/p1/1%401");
  await go("#/agents");
  expect(button().getAttribute("title")).toBe("Nouveau ticket dans Kibo");
  await act(async () => button().click());
  const dialog = await screen.findByRole("dialog", { name: "Nouveau ticket" });
  expect(within(dialog).getByRole("combobox", { name: "Projet" }).textContent).toBe("Kibo");
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
    const { openView } = useOpenView(
      () => project,
      (t) => opened.push(t),
      (projectId) => (projectId === "p2" ? other : null),
    );
    return (
      <button type="button" onClick={() => openView("graph", "p2")}>
        open p2
      </button>
    );
  }
  render(<Harness />);
  await userEvent.setup().click(screen.getByRole("button", { name: "open p2" }));
  expect(opened).toEqual([{ kind: "page", projectId: "p2", pageId: "1@1" }]);
});

test("a read-only project hides page and ticket creation and shows the banner", async () => {
  renderShell();
  await go("#/p/p3/");
  const banner = await screen.findByText("Lecture seule — tu es lecteur de ce projet.");
  expect(screen.getAllByRole("status")).toContain(banner);
  expect(screen.queryByRole("button", { name: "Nouvelle page" })).toBeNull();
  expect(screen.getByRole("button", { name: /^Ticket/ }).getAttribute("title")).toBe(
    "Nouveau ticket dans Boîte de réception",
  );
  expect(await screen.findByText("Cette page est vide : ajoute un composant pour commencer.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Ajouter un composant/ })).toBeNull();
});

test("Rejoindre un projet appears only once a server is configured", async () => {
  const { unmount } = renderShell();
  await go("#/p/p1/");
  expect(screen.queryByRole("button", { name: "Rejoindre un projet" })).toBeNull();
  unmount();
  syncStatus = { ...syncStatus, state: "online", serverUrl: "wss://sync.kibo.test" };
  renderShell();
  expect(await screen.findByRole("button", { name: "Rejoindre un projet" })).toBeTruthy();
});

test("a suspended project stays editable and explains why it no longer syncs", async () => {
  syncStatus = {
    ...unconfigured,
    state: "online",
    serverUrl: "wss://sync.kibo.test",
    projects: [
      {
        projectId: "p4",
        name: "Partagé",
        role: "owner",
        lastSyncAt: null,
        lastError: "TOO_LARGE",
        accessRevoked: false,
      },
    ],
  };
  renderShell();
  await go("#/p/p4/");
  const banner = await screen.findByText(
    "Sync suspendue : données trop volumineuses — Modifiable sur cette machine, mais plus synchronisé.",
  );
  expect(screen.getAllByRole("status")).toContain(banner);
  expect(screen.getByRole("button", { name: /^Ticket/ })).toBeTruthy();
});

test("the header and the project menu open the share dialog", async () => {
  renderShell();
  await go("#/p/p1/");
  await userEvent.click(await screen.findByRole("button", { name: "Partager" }));
  expect(await screen.findByRole("dialog", { name: "Partager « Kibo »" })).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await userEvent.click(screen.getByRole("button", { name: "Actions de Portfolio" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: "Partager" }));
  expect(await screen.findByRole("dialog", { name: "Partager « Portfolio »" })).toBeTruthy();
});
