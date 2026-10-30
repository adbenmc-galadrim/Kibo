import { expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, type Environment, type ProjectSnapshot, type ProjectSummary } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
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
  app: {
    version: "1.5.0",
    platform: "darwin",
    arch: "arm64",
    home: "~/.kibo",
    userHome: null,
    daemonPid: 42,
    uptimeMs: 0,
    fixedNow: null,
    today: "2026-10-16",
  },
};

const none = () => () => {};
mock.module("../api", () =>
  apiMock({
    client: {
      pair: () => Promise.resolve(),
      rpc: async (req: { method: string }) => (req.method === "getAppInfo" ? environment.app : environment),
      subscribe: none,
      subscribeEvents: none,
      subscribeAi: none,
      onRunChanged: none,
      onConnection: none,
      online: () => true,
    },
  }),
);

const { ProjectHome } = await import("../pages/ProjectHome");
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
  storybook: null,
  delivery: null,
  tracking: null,
  description: null,
  client: null,
  counts,
};
const empty: ProjectSnapshot = {
  meta: {
    id: "p1",
    name: "Kibo",
    key: "KIB",
    folder: "/Users/adam/goinfre/Kibo",
    color: "#14B8A6",
    worktree: null,
    storybook: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  questions: [],
  questionRecipients: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-1",
  sprints: [],
};

test("ProjectHome names the created project and its folder", () => {
  render(<ProjectHome project={empty} onNewPage={() => {}} />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Projet créé : Kibo");
  expect(screen.getByText("~/goinfre/Kibo")).toBeTruthy();
});

const contentProps = {
  inboxCount: 0,
  snapshots: new Map([["p1", empty]]),
  target: null,
  viewer: "adam",
  project: null,
  domains: undefined,
  startEditing: false,
  onNewProject: () => {},
  onImportProject: () => {},
  onNewPage: () => {},
  onOpen: () => {},
  onOpenFile: () => {},
  onOpenTicket: () => {},
};

test("ContentView welcomes a workspace without any project", async () => {
  render(<ContentView {...contentProps} projects={[]} />);
  expect(await screen.findByText("Bienvenue dans Kibo")).toBeTruthy();
});

test("ContentView keeps the overview once a project exists", async () => {
  render(<ContentView {...contentProps} projects={[kibo]} />);
  await screen.findByRole("progressbar");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Bonjour Adam");
  expect(screen.queryByText("Bienvenue dans Kibo")).toBeNull();
});

test("ContentView leads from the overview inbox card to the inbox screen", async () => {
  const opened: unknown[] = [];
  render(<ContentView {...contentProps} projects={[kibo]} inboxCount={2} onOpen={(t) => opened.push(t)} />);
  await screen.findByRole("progressbar");
  screen.getByRole("button", { name: "Boîte de réception · 2 tickets sans projet" }).click();
  expect(opened).toEqual([{ kind: "screen", screen: "inbox" }]);
});

test("the empty project home no longer proposes starter pages", () => {
  render(
    <ContentView
      {...contentProps}
      target={{ kind: "project", projectId: "p1" }}
      project={empty}
      projects={[kibo]}
    />,
  );
  expect(screen.queryByText("Pages de départ selon ton rôle")).toBeNull();
  expect(screen.queryByRole("button", { name: "Proposer" })).toBeNull();
});

test("NewProjectDialog focuses the folder when importing", async () => {
  render(<NewProjectDialog open onOpenChange={() => {}} count={0} existingKeys={[]} focusFolder />);
  const folder = await screen.findByLabelText("Dossier du dépôt");
  expect(document.activeElement).toBe(folder);
});
