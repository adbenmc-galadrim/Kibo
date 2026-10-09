import { expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, type Environment, type ProjectSnapshot, type ProjectSummary } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import { apiMock } from "../api-mock";

const environment: Environment = {
  daemon: { address: "127.0.0.1:47831", home: "/Users/adam/.kibo" },
  ai: {
    available: true,
    reason: null,
    version: "2.1.283",
    loggedIn: true,
    profiles: { assistant: true, generateur: true },
  },
  git: "2.51",
  gh: "2.80",
  capacity: { cores: 8, ramGb: 16, hostSlots: 3 },
  github: { connected: false },
  app: { version: "1.5.0", platform: "darwin", arch: "arm64", home: "~/.kibo", daemonPid: 42, uptimeMs: 0 },
};

const isolated = { kind: "sandbox-exec", available: true, reason: null, fix: null, allowUnsandboxed: false };
const none = () => () => {};
mock.module("../api", () =>
  apiMock({
    client: {
      pair: () => Promise.resolve(),
      pairWithCode: () => Promise.resolve(),
      rpc: async (req: { method: string }) =>
        req.method === "listComponents" || req.method === "listDrafts"
          ? []
          : req.method === "getSandboxStatus"
            ? isolated
            : environment,
      subscribe: none,
      subscribeEvents: none,
      subscribeAi: none,
      onRunChanged: none,
      onConnection: none,
      online: () => true,
    },
  }),
);

const { Overview } = await import("./Overview");
const { ProjectHome } = await import("../pages/ProjectHome");
const { PairingScreen } = await import("./PairingScreen");
const { ContentView } = await import("./ContentView");
const { NewProjectDialog } = await import("../dialogs/NewProjectDialog");

const counts = { backlog: 1, todo: 9, in_progress: 6, in_review: 2, blocked: 1, done: 5 };
const kibo: ProjectSummary = {
  id: "p1",
  name: "Kibo",
  key: "KIB",
  folder: "/Users/adam/goinfre/Kibo",
  color: "#14B8A6",
  worktree: null,
  counts,
};
const portfolio: ProjectSummary = {
  ...kibo,
  id: "p2",
  name: "Portfolio",
  key: "POR",
  folder: null,
  counts: { ...counts, done: 0, todo: 4, in_progress: 1, blocked: 0, backlog: 0, in_review: 0 },
};

const noInbox = { inboxCount: 0, onOpenInbox: () => {} };

test("Overview greets the viewer and sums up the open work", () => {
  render(<Overview viewer="adam" projects={[kibo, portfolio]} onNewProject={() => {}} {...noInbox} />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Bonjour Adam");
  expect(screen.getByText("2 projets · 24 tickets ouverts")).toBeTruthy();
});

test("Overview cards show counts, progress and a short folder", () => {
  render(<Overview viewer="adam" projects={[kibo]} onNewProject={() => {}} {...noInbox} />);
  const card = screen.getByRole("article", { name: "Kibo" });
  expect(within(card).getByText("~/goinfre/Kibo")).toBeTruthy();
  expect(within(card).getByText("6").parentElement?.textContent).toBe("6 en cours");
  expect(within(card).getByText("9").parentElement?.textContent).toBe("9 à faire");
  expect(within(card).getByText("1").parentElement?.textContent).toBe("1 bloqué");
  const bar = within(card).getByRole("progressbar", { name: "5 terminés sur 24" });
  expect(bar.getAttribute("aria-valuenow")).toBe("5");
  expect(bar.getAttribute("aria-valuemax")).toBe("24");
});

test("a 120-character folder wraps on the overview card instead of overflowing (screen 1)", () => {
  const folder = `/srv/${"dossier-tres-long/".repeat(6)}kibo/v2`;
  render(<Overview viewer="adam" projects={[{ ...kibo, folder }]} onNewProject={() => {}} {...noInbox} />);
  const path = within(screen.getByRole("article", { name: "Kibo" })).getByText(folder);
  expect(folder).toHaveLength(120);
  expect(path.className).toContain("break-all");
  expect(path.className).not.toContain("truncate");
  expect(path.parentElement?.className).toContain("min-w-0");
  expect(path.parentElement?.parentElement?.className).toContain("items-start");
});

const empty: ProjectSnapshot = {
  meta: {
    id: "p1",
    name: "Kibo",
    key: "KIB",
    folder: "/Users/adam/goinfre/Kibo",
    color: "#14B8A6",
    worktree: null,
  },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  questions: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-1",
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
};

test("Overview points to the inbox only when it holds open tickets", () => {
  const opened: string[] = [];
  const { unmount } = render(
    <Overview viewer="adam" projects={[kibo]} onNewProject={() => {}} {...noInbox} />,
  );
  expect(screen.queryByRole("button", { name: /Boîte de réception/ })).toBeNull();
  unmount();
  render(
    <Overview
      viewer="adam"
      projects={[kibo]}
      onNewProject={() => {}}
      inboxCount={3}
      onOpenInbox={() => opened.push("inbox")}
    />,
  );
  screen.getByRole("button", { name: "Boîte de réception · 3 tickets sans projet" }).click();
  expect(opened).toEqual(["inbox"]);
});

test("ProjectHome names the created project and its folder", () => {
  render(<ProjectHome project={empty} onNewPage={() => {}} onSuggest={() => {}} />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Projet créé : Kibo");
  expect(screen.getByText("~/goinfre/Kibo")).toBeTruthy();
});

test("PairingScreen shows the logo, a centred title and the security notice", () => {
  render(<PairingScreen onPaired={() => {}} />);
  expect(screen.getByRole("img", { name: "Kibo" })).toBeTruthy();
  expect(screen.getByText("Appairer ce navigateur")).toBeTruthy();
  expect(screen.getByText(/révocable dans Paramètres › Sécurité/)).toBeTruthy();
});

const contentProps = {
  inboxCount: 0,
  target: null,
  viewer: "adam",
  project: null,
  domains: undefined,
  startEditing: false,
  onNewProject: () => {},
  onImportProject: () => {},
  onTutorial: () => {},
  onNewPage: () => {},
  onSuggestPages: () => {},
  onOpen: () => {},
  onOpenFile: () => {},
  onAssign: () => {},
  onOpenTicket: () => {},
};

test("ContentView welcomes a workspace without any project", async () => {
  render(<ContentView {...contentProps} projects={[]} />);
  expect(await screen.findByText("Bienvenue dans Kibo")).toBeTruthy();
});

test("ContentView keeps the overview once a project exists", () => {
  render(<ContentView {...contentProps} projects={[kibo]} />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Bonjour Adam");
  expect(screen.queryByText("Bienvenue dans Kibo")).toBeNull();
});

test("ContentView leads from the overview inbox card to the inbox screen", () => {
  const opened: unknown[] = [];
  render(<ContentView {...contentProps} projects={[kibo]} inboxCount={2} onOpen={(t) => opened.push(t)} />);
  screen.getByRole("button", { name: "Boîte de réception · 2 tickets sans projet" }).click();
  expect(opened).toEqual([{ kind: "screen", screen: "inbox" }]);
});

test("the empty project home suggests pages for its project", async () => {
  const asked: string[] = [];
  render(
    <ContentView
      {...contentProps}
      target={{ kind: "project", projectId: "p1" }}
      project={empty}
      projects={[kibo]}
      onSuggestPages={(id) => asked.push(id)}
    />,
  );
  expect(screen.getByText("Pages de départ selon ton rôle")).toBeTruthy();
  screen.getByRole("button", { name: "Proposer" }).click();
  expect(asked).toEqual(["p1"]);
});

test("NewProjectDialog focuses the folder when importing", async () => {
  render(<NewProjectDialog open onOpenChange={() => {}} count={0} focusFolder />);
  const folder = await screen.findByLabelText("Dossier du projet");
  expect(document.activeElement).toBe(folder);
});
