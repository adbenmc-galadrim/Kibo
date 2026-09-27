import { beforeEach, expect, mock, test } from "bun:test";
import {
  EMPTY_TABS,
  type ProjectSnapshot,
  type RpcRequest,
  type Screen,
  type StatusId,
  type TicketView,
} from "@kibo/schema";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  agentsFixture,
  configFixture,
  domainsFixture,
  kiboProject,
  NOW,
  projectsFixture,
} from "../agents/fixtures";
import type { Route } from "../route";

const mineTicket = (id: string, key: string, title: string, statusId: StatusId): TicketView => ({
  id,
  key,
  pendingSeq: null,
  keyLabel: key,
  title,
  description: "",
  statusId,
  blockedReason: null,
  domainId: "facturation",
  assignee: { kind: "human", ref: "adam" },
  parentId: null,
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
});

function snapshotOf(projectId: string): ProjectSnapshot {
  const kibo = kiboProject();
  if (projectId !== "fac")
    return {
      ...kibo,
      tickets: [...kibo.tickets, mineTicket("t9", "KIB-9", "Setup Tauri + sidecar Bun", "todo")],
    };
  return {
    ...kibo,
    meta: { id: "fac", key: "FAC", name: "API Facturation", folder: null, color: "#22C55E" },
    tickets: [mineTicket("f31", "FAC-31", "Export PDF des factures", "in_progress")],
  };
}

const calls: RpcRequest[] = [];
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "getTabs") return Promise.resolve(EMPTY_TABS);
      if (req.method === "cliStatus")
        return Promise.resolve({ path: "/Users/adam/.local/bin/kibo", installed: false });
      if (req.method === "getProject") return Promise.resolve(snapshotOf(req.projectId));
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
  },
}));
mock.module("../state/use-projects", () => ({
  useProjects: () => projectsFixture,
  useProject: (id: string | null) => (id === "kibo" ? kiboProject() : null),
}));
mock.module("../state/use-agents", () => ({
  useAgents: () => agentsFixture(),
  useConfig: () => configFixture(),
  useNow: () => NOW,
  useRunLog: () => [],
  useDaemonOnline: () => true,
}));

const { Shell } = await import("./Shell");
const { TicketSheet } = await import("./TicketSheet");
const { NotifyButton } = await import("./NotifyButton");
const { parseRoute } = await import("../route");

beforeEach(() => {
  calls.length = 0;
});

const go = (hash: string) =>
  act(async () => {
    location.hash = hash;
    await new Promise((r) => setTimeout(r, 20));
  });

const header = () =>
  within(screen.getByRole("navigation", { name: "Fil d'Ariane" }).closest("header") ?? document.body);

function fakeNotification(initial: NotificationPermission) {
  let permission = initial;
  const requestPermission = mock(async () => {
    permission = "granted";
    return permission;
  });
  const saved = globalThis.Notification;
  Object.assign(globalThis, {
    Notification: Object.assign(function FakeNotification() {}, {
      get permission() {
        return permission;
      },
      requestPermission,
    }),
  });
  return { requestPermission, restore: () => Object.assign(globalThis, { Notification: saved }) };
}

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

test("the sidebar leads to the agents, the queue and the settings", async () => {
  render(<Shell viewer="adam" notifications="native" />);
  await go("#/");
  const sidebar = within(screen.getByRole("button", { name: /^Agents/ }).closest("ul") ?? document.body);
  expect(sidebar.getByText("3")).toBeTruthy();
  expect(sidebar.queryByRole("button", { name: "Files d'attente" })).toBeNull();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /^Agents/ }));
  expect(location.hash).toBe("#/agents");
  expect(await screen.findByRole("heading", { level: 1, name: "Agents" })).toBeTruthy();
  const bar = within(screen.getByRole("tablist", { name: "Onglets" }));
  expect(bar.getByRole("tab", { name: "Agents" }).getAttribute("aria-selected")).toBe("true");
  await user.click(screen.getByRole("button", { name: "Files d'attente" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Files d'attente" })).toBeTruthy();
  expect(bar.getByRole("tab", { name: "Files d'attente" }).getAttribute("aria-selected")).toBe("true");
  expect(bar.queryByRole("tab", { name: "Agents" })).toBeNull();
  const crumbs = within(screen.getByRole("navigation", { name: "Fil d'Ariane" }));
  expect(crumbs.getByText("Agents")).toBeTruthy();
  expect(crumbs.getByText("Files d'attente").getAttribute("aria-current")).toBe("page");
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

test("my tickets: sidebar count, rows of every project, sheet and assign in the right project", async () => {
  render(<Shell viewer="adam" notifications="native" />);
  await go("#/");
  const entry = await screen.findByRole("button", { name: "Mes tickets" });
  await waitFor(() => expect(entry.closest("li")?.textContent).toBe("Mes tickets2"));
  const user = userEvent.setup();
  await user.click(entry);
  expect(location.hash).toBe("#/mine");
  expect(await screen.findByRole("heading", { level: 1, name: "Mes tickets" })).toBeTruthy();
  expect(await screen.findByText("2 tickets · 2 projets")).toBeTruthy();
  const facturation = screen.getByRole("region", { name: "API Facturation" });
  await user.click(within(facturation).getByRole("button", { name: /^FAC-31/ }));
  expect(within(await screen.findByRole("dialog")).getByText("Export PDF des factures")).toBeTruthy();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const kibo = screen.getByRole("region", { name: "Kibo" });
  await user.click(within(kibo).getByRole("button", { name: "Assigner" }));
  expect(within(await screen.findByRole("dialog")).getByText("Assigner KIB-9 à un agent")).toBeTruthy();
});

test("the workspace header renames through the config command", async () => {
  render(<Shell viewer="adam" notifications="native" />);
  await go("#/");
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Perso/ }));
  await user.click(await screen.findByRole("menuitem", { name: "Renommer le workspace…" }));
  const field = await screen.findByLabelText("Nom");
  await user.clear(field);
  await user.type(field, "Maison");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(calls).toContainEqual({ method: "config", command: { method: "renameWorkspace", name: "Maison" } });
  await user.click(screen.getByRole("button", { name: /Perso/ }));
  await user.click(await screen.findByRole("menuitem", { name: "Paramètres du workspace" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Domaines & guidelines" })).toBeTruthy();
});

test("the header carries the actions of the agent screens", async () => {
  render(<Shell viewer="adam" notifications="native" />);
  await go("#/agents");
  const user = userEvent.setup();
  await user.click(header().getByRole("button", { name: "Nouveau profil" }));
  expect(within(await screen.findByRole("dialog")).getByText("Nouveau profil d'agent")).toBeTruthy();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await go("#/agents/queue");
  await user.click(header().getByRole("button", { name: "Mettre en pause l'admission" }));
  expect(calls).toContainEqual({ method: "setHost", patch: { paused: true } });
});

test("answering from the queue opens the drawer on that run", async () => {
  render(<Shell viewer="adam" notifications="native" />);
  await go("#/agents/queue");
  const waiting = within(await screen.findByRole("region", { name: "En attente de réponse" }));
  await userEvent.setup().click(waiting.getByRole("button", { name: "Répondre à opus-dev-2" }));
  expect(await screen.findByRole("list", { name: "Journal de opus-dev-2" })).toBeTruthy();
});

test("answering from the palette opens the drawer on that run", async () => {
  render(<Shell viewer="adam" notifications="native" />);
  await go("#/p/kibo/");
  const user = userEvent.setup();
  fireEvent.keyDown(window, { key: "k", metaKey: true });
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  const palette = await screen.findByRole("dialog", { name: "Palette de commandes" });
  await user.click(within(palette).getByRole("option", { name: "Répondre à opus-dev-2 (KIB-14)" }));
  expect(await screen.findByRole("list", { name: "Journal de opus-dev-2" })).toBeTruthy();
});

test("launching an agent from the drawer opens the assign dialog", async () => {
  render(<Shell viewer="adam" notifications="native" />);
  await go("#/p/kibo/");
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Déplier les agents" }));
  await user.click(screen.getByRole("button", { name: "Lancer un agent" }));
  expect(await screen.findByRole("dialog")).toBeTruthy();
  expect(within(screen.getByRole("dialog")).getByText("Lancer un agent")).toBeTruthy();
});

test("the ticket sheet offers a domain and the assign action", async () => {
  const onAssign = mock(() => {});
  render(
    <TicketSheet
      project={kiboProject()}
      ticketId="t15"
      domains={domainsFixture}
      viewer="adam"
      onClose={() => {}}
      onAssign={onAssign}
      onOpenInTab={() => {}}
      onOpenFile={() => {}}
      onOpenTicket={() => {}}
      onDeleted={() => {}}
    />,
  );
  expect(screen.getByRole("combobox", { name: "Domaine" }).textContent).toContain("UI");
  await userEvent.setup().click(screen.getByRole("button", { name: "Assigner à un agent" }));
  expect(onAssign).toHaveBeenCalled();
});

test("the bell asks for notification permission once", async () => {
  const fake = fakeNotification("default");
  render(<NotifyButton />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Activer les notifications" }));
  expect(fake.requestPermission).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Activer les notifications" })).toBeNull());
  fake.restore();
});

test("the bell is offered in the browser only", async () => {
  const fake = fakeNotification("default");
  const view = render(<Shell viewer="adam" notifications="native" />);
  await go("#/");
  expect(header().queryByRole("button", { name: "Activer les notifications" })).toBeNull();
  view.unmount();
  render(<Shell viewer="adam" notifications="browser" />);
  await go("#/");
  expect(header().getByRole("button", { name: "Activer les notifications" })).toBeTruthy();
  fake.restore();
});
