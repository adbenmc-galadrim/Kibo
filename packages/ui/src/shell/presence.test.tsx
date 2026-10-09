import { beforeEach, expect, mock, test } from "bun:test";
import {
  DEFAULT_WORKFLOW,
  type Phase7Event,
  type PresencePeer,
  type ProjectSnapshot,
  type RpcRequest,
} from "@kibo/schema";
import { act, render, screen, waitFor } from "@testing-library/react";
import { apiMock } from "../api-mock";

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
const { KeyRequired } = await import("./KeyRequired");
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
  },
  workflow: DEFAULT_WORKFLOW,
  pages: [{ id: "pg1", title: "Kanban", kind: "view", parentId: null }],
  tickets: [
    {
      id: "t1",
      key: null,
      pendingSeq: 1,
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
    },
  ],
  links: [],
  questions: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: null,
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

test("the sheet says who is looking at the ticket and disables the agent", async () => {
  peers = [peer("Léa", 1, { ticketId: "t1" }), peer("Sam", 2, { ticketId: "t9" })];
  render(
    <TicketSheet
      project={project}
      ticketId="t1"
      domains={[]}
      viewer="adam"
      onClose={noop}
      onAssign={noop}
      onOpenInTab={noop}
      onOpenFile={noop}
      onOpenTicket={noop}
      onDeleted={noop}
    />,
  );
  expect(await screen.findByText("Léa regarde ce ticket")).toBeTruthy();
  expect(screen.queryByText("Sam regarde ce ticket")).toBeNull();
  expect(screen.getByText("KIB-…").className).toContain("italic");
  expect((screen.getByRole("button", { name: "Assigner à un agent" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
});

test("the ticket tab shows the provisional key and keeps the agent away", () => {
  render(
    <TicketTab
      project={project}
      ticketId="t1"
      viewer="adam"
      onAssign={noop}
      onOpenFile={noop}
      onOpenTicket={noop}
    />,
  );
  expect(screen.getByText("KIB-…").className).toContain("italic");
  expect((screen.getByRole("button", { name: "Assigner à un agent" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
});

test("actions that need a key are disabled with an explanation", () => {
  const ticket = project.tickets[0];
  if (!ticket) throw new Error("no ticket");
  render(
    <KeyRequired ticket={ticket}>
      <button type="button">Assigner à un agent</button>
    </KeyRequired>,
  );
  const button = screen.getByRole("button", { name: "Assigner à un agent" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(button.closest("[data-key-required]")?.getAttribute("title")).toBe(
    "Clé attribuée à la prochaine synchronisation",
  );
});

test("a ticket with a key keeps its actions", () => {
  render(
    <KeyRequired ticket={{ key: "KIB-7" }}>
      <button type="button">Assigner à un agent</button>
    </KeyRequired>,
  );
  const button = screen.getByRole("button", { name: "Assigner à un agent" }) as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  expect(button.closest("[data-key-required]")).toBeNull();
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
    />,
  );
  await waitFor(() =>
    expect(calls).toContainEqual({ method: "setPresence", projectId: "p1", pageId: "pg1", ticketId: "t1" }),
  );
  expect(calls.some((c) => c.method === "setPresence" && c.ticketId === "x9")).toBe(false);
});
