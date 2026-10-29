import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import {
  type AgentsState,
  EMPTY_PROGRESS,
  EMPTY_TABS,
  INBOX_ID,
  type ProjectSnapshot,
  type RpcRequest,
  type Screen,
  type StatusId,
  type TicketView,
} from "@kibo/schema";
import { act, render as renderPlain, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { apiMock } from "../api-mock";
import {
  agentsFixture,
  configFixture,
  domainsFixture,
  kiboProject,
  NOW,
  projectsFixture,
} from "../lib/fixtures";
import type { Route } from "../route";
import { AppSettingsProvider, fixedStore } from "../state/use-app-settings";

const shownExecution = fixedStore({ agentExecution: "shown" });
const ShownExecution = ({ children }: { children: ReactNode }) => (
  <AppSettingsProvider store={shownExecution}>{children}</AppSettingsProvider>
);
const render = (ui: ReactElement) => renderPlain(ui, { wrapper: ShownExecution });

const mineTicket = (id: string, key: string, title: string, statusId: StatusId): TicketView => ({
  id,
  key,
  pendingSeq: null,
  hold: null,
  keyLabel: key,
  title,
  description: "",
  statusId,
  blockedReason: null,
  domainId: "facturation",
  assignee: { kind: "human", ref: "adam" },
  parentId: null,
  labels: [],
  externalRefs: [],
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
});

function snapshotOf(projectId: string): ProjectSnapshot {
  const kibo = kiboProject();
  if (projectId === INBOX_ID)
    return {
      ...kibo,
      meta: {
        id: INBOX_ID,
        key: "INB",
        name: "Inbox",
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
      tickets: [mineTicket("i2", "INB-2", "Appeler le comptable", "todo")],
      links: [],
      nextTicketKey: "INB-3",
      sprints: [],
    };
  if (projectId !== "fac")
    return {
      ...kibo,
      tickets: [...kibo.tickets, mineTicket("t9", "KIB-9", "Setup Tauri + sidecar Bun", "todo")],
    };
  return {
    ...kibo,
    meta: {
      id: "fac",
      key: "FAC",
      name: "API Facturation",
      folder: null,
      color: "#22C55E",
      worktree: null,
      storybook: null,
      duplication: null,
      delivery: null,
      tracking: null,
      description: null,
      client: null,
    },
    tickets: [mineTicket("f31", "FAC-31", "Export PDF des factures", "in_progress")],
  };
}

const calls: RpcRequest[] = [];
mock.module("../api", () =>
  apiMock({
    onWrite: () => () => {},
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "getTabs") return Promise.resolve(EMPTY_TABS);
        if (req.method === "getAppSettings") return Promise.resolve({ agentExecution: "shown" });
        if (req.method === "getRunLog") return Promise.resolve([]);
        if (req.method === "autoLinks.list") return Promise.resolve([]);
        if (req.method === "cliStatus")
          return Promise.resolve({ path: "/Users/adam/.local/bin/kibo", installed: false });
        if (req.method === "getProject") return Promise.resolve(snapshotOf(req.projectId));
        if (req.method === "agents.list")
          return Promise.resolve({ agents: [], notices: [], partialWatch: false });
        if (req.method === "listIntegrations")
          return Promise.resolve([
            { id: "git", state: "active", account: null, servers: [], error: null, resumeAt: null },
          ]);
        return Promise.resolve(
          req.method === "previewAssign" ? { position: null, reason: null, guidelines: 0 } : null,
        );
      },
      code: () => Promise.resolve([]),
      subscribe: () => () => {},
      subscribeCode: () => () => {},
      subscribeIntegrations: () => () => {},
      subscribeEvents: () => () => {},
      subscribeAi: () => () => {},
      subscribeMoments: () => () => {},
      subscribeTopic: () => () => {},
    },
  }),
);
mock.module("../state/use-projects", () => ({
  useProjects: () => ({ projects: projectsFixture, error: null, retry: () => {} }),
  useProject: (id: string | null) => (id === "kibo" ? kiboProject() : null),
}));
let agents: () => AgentsState = agentsFixture;

mock.module("../state/use-agents", () => ({
  useAgents: () => agents(),
  useConfig: () => configFixture(),
  useNow: () => NOW,
  useRunLog: () => ({ log: [], missing: false }),
  useDaemonOnline: () => true,
}));

const { Shell } = await import("./Shell");

afterEach(() => window.sessionStorage.clear());
const { TicketSheet } = await import("./TicketSheet");
const { parseRoute } = await import("../route");

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
  calls.length = 0;
  agents = agentsFixture;
});

const go = (hash: string) =>
  act(async () => {
    location.hash = hash;
    await new Promise((r) => setTimeout(r, 20));
  });

test("routes name the agent screens", () => {
  const screenRoute = (screen: Screen): Route => ({
    projectId: null,
    pageId: null,
    target: { kind: "screen", screen },
  });
  expect(parseRoute("#/agents")).toEqual(screenRoute("agents"));
  expect(parseRoute("#/agents/queue")).toEqual(screenRoute("queue"));
  expect(parseRoute("#/settings/domains")).toEqual(screenRoute("domains"));
  expect(parseRoute("#/settings/general")).toEqual(screenRoute("general"));
  expect(parseRoute("#/settings/integrations")).toEqual(screenRoute("integrations"));
  expect(parseRoute("#/p/kibo/1%401")).toEqual({
    projectId: "kibo",
    pageId: "1@1",
    target: { kind: "page", projectId: "kibo", pageId: "1@1" },
  });
  expect(parseRoute("#/elsewhere")).toEqual({ projectId: null, pageId: null, target: null });
});

test("the sidebar leads to the settings, never to the agents", async () => {
  render(<Shell viewer="adam" notifications="native" />);
  await go("#/");
  expect(await screen.findAllByRole("button", { name: /^Boîte de réception/ })).not.toHaveLength(0);
  for (const name of [/^Agents/, /^Files d'attente/, /^Skills/])
    expect(screen.queryByRole("button", { name })).toBeNull();
  const user = userEvent.setup();
  const crumbs = within(screen.getByRole("navigation", { name: "Fil d'Ariane" }));
  await user.click(screen.getByRole("button", { name: "Paramètres" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Général" })).toBeTruthy();
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(crumbs.getByText("Paramètres")).toBeTruthy();
  expect(crumbs.getByText("Général").getAttribute("aria-current")).toBe("page");
  const settingsNav = within(screen.getByRole("navigation", { name: "Paramètres" }));
  expect(settingsNav.getByRole("link", { name: "Intégrations" }).getAttribute("href")).toBe(
    "#/settings/integrations",
  );
  await go("#/settings/integrations");
  expect(await screen.findByRole("heading", { level: 1, name: "Intégrations" })).toBeTruthy();
  expect(await screen.findByText("Branches, commits, worktrees, diff")).toBeTruthy();
  expect(crumbs.getByText("Intégrations").getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("button", { name: "Paramètres" }).getAttribute("data-active")).toBe("true");
});

test("the workspace header leads to the workspace settings", async () => {
  render(<Shell viewer="adam" notifications="native" />);
  await go("#/");
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Perso/ }));
  expect(screen.queryByRole("menuitem", { name: "Renommer le workspace…" })).toBeNull();
  await user.click(await screen.findByRole("menuitem", { name: "Paramètres du workspace" }));
  expect(location.hash).toBe("#/settings/workspace");
  expect(await screen.findByRole("heading", { level: 1, name: "Workspace" })).toBeTruthy();
});

test("the ticket sheet offers a domain, folded, and no assign action", async () => {
  render(
    <TicketSheet
      project={kiboProject()}
      ticketId="t15"
      domains={domainsFixture}
      viewer="adam"
      onClose={() => {}}
      onOpenInTab={() => {}}
      onOpenFile={() => {}}
      onOpenTicket={() => {}}
      onDeleted={() => {}}
    />,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: /^Domaine/ }));
  expect(screen.getByRole("combobox", { name: "Domaine" }).textContent).toContain("UI");
  expect(screen.queryByRole("button", { name: "Assigner à un agent" })).toBeNull();
});

test("right click and the ellipsis open the same project menu; edit and delete open their dialogs", async () => {
  render(<Shell viewer="adam" notifications="native" />);
  await go("#/p/kibo/");
  const user = userEvent.setup();
  const entry = await screen.findByRole("button", { name: "Kibo" });
  await user.pointer({ keys: "[MouseRight]", target: entry });
  const names = () => screen.getAllByRole("menuitem").map((i) => i.textContent);
  expect(names()).toEqual([
    "Nouvelle page",
    "Ajouter la page Vue d'ensemble",
    "Ajouter la page Planning",
    "Partager",
    "Modifier…",
    "Fichiers du projet…",
    "Supprimer…",
  ]);
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Actions de Kibo" }));
  expect(names()).toEqual([
    "Nouvelle page",
    "Ajouter la page Vue d'ensemble",
    "Ajouter la page Planning",
    "Partager",
    "Modifier…",
    "Fichiers du projet…",
    "Supprimer…",
  ]);
  await user.click(screen.getByRole("menuitem", { name: "Modifier…" }));
  expect(await screen.findByRole("dialog", { name: "Modifier le projet" })).toBeTruthy();
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Actions de Kibo" }));
  await user.click(screen.getByRole("menuitem", { name: "Fichiers du projet…" }));
  expect(await screen.findByRole("dialog", { name: "Fichiers du projet" })).toBeTruthy();
  expect(calls).toContainEqual({ method: "listAssets", projectId: "kibo" });
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Actions de Kibo" }));
  await user.click(screen.getByRole("menuitem", { name: "Supprimer…" }));
  expect(await screen.findByRole("dialog", { name: "Des agents travaillent sur ce projet" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Voir les agents" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Annuler" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(calls.some((c) => c.method === "deleteProject")).toBe(false);
});

test("deleting a project closes its tabs and returns to the overview", async () => {
  agents = () => {
    const state = agentsFixture();
    return { ...state, runs: state.runs.filter((r) => r.projectId !== "fac") };
  };
  render(<Shell viewer="adam" notifications="native" />);
  await go("#/p/fac/");
  await waitFor(() => expect(document.title).toMatch(/^API Facturation/));
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actions de API Facturation" }));
  await user.click(screen.getByRole("menuitem", { name: "Supprimer…" }));
  await screen.findByRole("dialog", { name: "Supprimer le projet API Facturation ?" });
  await user.type(screen.getByLabelText("Tape API Facturation pour confirmer"), "API Facturation");
  await user.click(screen.getByRole("button", { name: "Supprimer" }));
  await waitFor(() => expect(location.hash).toBe("#/"));
  expect(calls.filter((c) => c.method === "deleteProject")).toEqual([
    { method: "deleteProject", projectId: "fac" },
  ]);
  await waitFor(() => expect(document.title).toBe("Kibo"));
  expect(screen.queryByRole("dialog")).toBeNull();
});
