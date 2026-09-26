import { beforeEach, expect, mock, test } from "bun:test";
import { EMPTY_TABS, type RpcRequest, type Screen } from "@kibo/schema";
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

const calls: RpcRequest[] = [];
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "getTabs") return Promise.resolve(EMPTY_TABS);
      if (req.method === "getProject") return Promise.resolve(kiboProject());
      return Promise.resolve(
        req.method === "previewAssign" ? { position: null, reason: null, guidelines: 0 } : null,
      );
    },
    code: () => Promise.resolve([]),
    subscribe: () => () => {},
    subscribeCode: () => () => {},
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
  expect(await screen.findByRole("heading", { level: 1, name: "Domaines & guidelines" })).toBeTruthy();
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
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
      onClose={() => {}}
      onAssign={onAssign}
      onOpenInTab={() => {}}
      onOpenFile={() => {}}
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
