import { beforeEach, expect, mock, test } from "bun:test";
import {
  DEFAULT_WORKFLOW,
  EMPTY_PROGRESS,
  type Phase7Event,
  type PresencePeer,
  type ProjectSnapshot,
  type RpcRequest,
} from "@kibo/schema";
import { act, render as renderPlain, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { apiMock } from "../api-mock";
import { AppSettingsProvider, fixedStore } from "../state/use-app-settings";

const shownExecution = fixedStore({ agentExecution: "shown" });
const ShownExecution = ({ children }: { children: ReactNode }) => (
  <AppSettingsProvider store={shownExecution}>{children}</AppSettingsProvider>
);
const render = (ui: ReactElement) => renderPlain(ui, { wrapper: ShownExecution });

const calls: RpcRequest[] = [];
let peers: PresencePeer[] = [];
const events = new Set<(event: Phase7Event) => void>();
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return Promise.resolve(req.method === "getPresence" ? peers : null);
      },
      subscribe: () => () => undefined,
      subscribeTopic: () => () => undefined,
      subscribeIntegrations: () => () => undefined,
      subscribeEvents: (listener: (event: Phase7Event) => void) => {
        events.add(listener);
        return () => events.delete(listener);
      },
    },
  }),
);

const { PresenceAvatars } = await import("./PresenceAvatars");
const { TicketSheet } = await import("./TicketSheet");
const { TicketTab } = await import("../pages/TicketTab");
const { usePresenceReporter } = await import("../state/use-presence");

const peer = (name: string, i: number, extra: Partial<PresencePeer> = {}): PresencePeer => ({
  deviceId: `d${i}`,
  self: false,
  userId: `u${i}`,
  name,
  pageId: null,
  ticketId: null,
  runs: [],
  ...extra,
});
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
  pages: [{ id: "pg1", title: "Kanban", kind: "view", parentId: null }],
  tickets: [
    {
      id: "t1",
      key: null,
      pendingSeq: 1,
      hold: null,
      keyLabel: "KIB-…",
      title: "Schéma",
      description: "",
      statusId: "todo",
      blockedReason: null,
      domainId: null,
      assignee: null,
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
    },
  ],
  links: [],
  questions: [],
  questionRecipients: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: null,
  sprints: [],
  sync: { shared: true, keyAllocator: "server", role: "editor", access: "write", members: [] },
};
const noop = () => {};
const presenceReads = () => calls.filter((c) => c.method === "getPresence");

beforeEach(() => {
  calls.length = 0;
  peers = [];
});

test("the avatar stack shows three colleagues then a counter, never self", async () => {
  peers = [
    peer("Léa", 1),
    peer("Sam", 2),
    peer("Noé", 3),
    peer("Inès", 4),
    peer("Zoé", 5),
    { ...peer("Adam", 0), self: true },
  ];
  render(<PresenceAvatars project={{ id: "p1", name: "Kibo" }} pages={project.pages} />);
  expect(await screen.findByText("+2")).toBeTruthy();
  expect(screen.getAllByRole("img").map((a) => a.getAttribute("aria-label"))).toEqual(["Inès", "Léa", "Noé"]);
  expect(screen.queryByText("AD")).toBeNull();
});

test("a page header only shows the colleagues on that page", async () => {
  peers = [peer("Léa", 1, { pageId: "pg1" }), peer("Sam", 2, { pageId: "other" })];
  render(<PresenceAvatars project={{ id: "p1", name: "Kibo" }} pages={project.pages} pageId="pg1" />);
  expect(await screen.findByRole("img", { name: "Léa" })).toBeTruthy();
  expect(screen.getByText("Léa regarde cette page")).toBeTruthy();
  expect(screen.queryByRole("img", { name: "Sam" })).toBeNull();
});

test("presence is read for the shown project only, and refreshed by its own events", async () => {
  peers = [peer("Léa", 1)];
  render(<PresenceAvatars project={{ id: "p1", name: "Kibo" }} pages={project.pages} />);
  await screen.findByRole("img", { name: "Léa" });
  expect(presenceReads()).toEqual([{ method: "getPresence", projectId: "p1" }]);
  act(() => {
    for (const l of events) l({ type: "presence.changed", projectId: "p2" });
  });
  expect(presenceReads()).toHaveLength(1);
  peers = [];
  act(() => {
    for (const l of events) l({ type: "presence.changed", projectId: "p1" });
  });
  await waitFor(() => expect(screen.queryByRole("img", { name: "Léa" })).toBeNull());
  expect(presenceReads()).toHaveLength(2);
});

test("the sheet says who is looking at the ticket and offers no command to copy yet", async () => {
  peers = [peer("Léa", 1, { ticketId: "t1" }), peer("Sam", 2, { ticketId: "t9" })];
  render(
    <TicketSheet
      project={project}
      ticketId="t1"
      domains={[]}
      viewer="adam"
      onClose={noop}
      onOpenInTab={noop}
      onOpenFile={noop}
      onOpenTicket={noop}
      onDeleted={noop}
    />,
  );
  expect(await screen.findByText("Léa regarde ce ticket")).toBeTruthy();
  expect(screen.queryByText("Sam regarde ce ticket")).toBeNull();
  expect(screen.getByText("KIB-…").className).toContain("italic");
  expect(screen.queryByRole("button", { name: /^Copier \/full-delivery/ })).toBeNull();
});

test("the ticket tab shows the provisional key and offers no command to copy yet", () => {
  render(<TicketTab project={project} ticketId="t1" viewer="adam" onOpenFile={noop} onOpenTicket={noop} />);
  expect(screen.getByText("KIB-…").className).toContain("italic");
  expect(screen.queryByRole("button", { name: /^Copier \/full-delivery/ })).toBeNull();
});

function Reporter(props: Parameters<typeof usePresenceReporter>[0]) {
  usePresenceReporter(props);
  return null;
}

test("navigation reports presence only for shared projects", async () => {
  const { rerender } = render(<Reporter projectId="p1" pageId="pg1" ticketId={null} shared />);
  await waitFor(() =>
    expect(calls).toContainEqual({ method: "setPresence", projectId: "p1", pageId: "pg1", ticketId: null }),
  );
  calls.length = 0;
  rerender(<Reporter projectId="p2" pageId="pgX" ticketId={null} shared={false} />);
  await Bun.sleep(20);
  expect(calls.filter((c) => c.method === "setPresence")).toEqual([]);
});

test("the tab bar presence reports where I am in this project only", async () => {
  const { ProjectPresence } = await import("./ProjectPresence");
  const { rerender } = render(
    <ProjectPresence
      project={project}
      active={{ kind: "page", projectId: "p1", pageId: "pg1" }}
      sheet={{ projectId: "p2", ticketId: "x9" }}
      avatars="inline"
    />,
  );
  await waitFor(() =>
    expect(calls).toContainEqual({ method: "setPresence", projectId: "p1", pageId: "pg1", ticketId: null }),
  );
  rerender(
    <ProjectPresence
      project={project}
      active={{ kind: "page", projectId: "p1", pageId: "pg1" }}
      sheet={{ projectId: "p1", ticketId: "t1" }}
      avatars="inline"
    />,
  );
  await waitFor(() =>
    expect(calls).toContainEqual({ method: "setPresence", projectId: "p1", pageId: "pg1", ticketId: "t1" }),
  );
  expect(calls.some((c) => c.method === "setPresence" && c.ticketId === "x9")).toBe(false);
});

test("on a page that shows its own presence, the project presence still reports but draws no second list", async () => {
  peers = [peer("Léa", 1, { pageId: "pg1" })];
  const { ProjectPresence } = await import("./ProjectPresence");
  render(
    <ProjectPresence
      project={project}
      active={{ kind: "page", projectId: "p1", pageId: "pg1" }}
      sheet={null}
      avatars="none"
    />,
  );
  await waitFor(() =>
    expect(calls).toContainEqual({ method: "setPresence", projectId: "p1", pageId: "pg1", ticketId: null }),
  );
  await Bun.sleep(20);
  expect(screen.queryByRole("list", { name: "Personnes présentes" })).toBeNull();
});

test("without the tab bar, the project presence draws its list in the page header", async () => {
  peers = [peer("Léa", 1)];
  const { ProjectPresence } = await import("./ProjectPresence");
  const { PageActionsProvider, PagePresenceSlot } = await import("./page-actions");
  render(
    <PageActionsProvider>
      <section aria-label="En-tête de la page">
        <PagePresenceSlot />
      </section>
      <ProjectPresence project={project} active={null} sheet={null} avatars="page" />
    </PageActionsProvider>,
  );
  const header = within(screen.getByRole("region", { name: "En-tête de la page" }));
  expect(await header.findByRole("img", { name: "Léa" })).toBeTruthy();
});
