import { beforeEach, expect, mock, test } from "bun:test";
import {
  DEFAULT_WORKFLOW,
  EMPTY_PROGRESS,
  KiboError,
  type ProjectSnapshot,
  type RpcRequest,
  type TicketView,
} from "@kibo/schema";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
let answer: (req: RpcRequest) => unknown = () => null;
mock.module("../api", () =>
  apiMock({
    client: {
      subscribeTopic: () => () => {},
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        return answer(req);
      },
      subscribe: () => () => undefined,
      subscribeEvents: () => () => undefined,
      subscribeIntegrations: () => () => undefined,
    },
  }),
);

const { TicketSheet } = await import("../shell/TicketSheet");
const { TICKET_TAB_KEY } = await import("./activity/TicketTabs");

const ticket = (patch: Partial<TicketView> = {}): TicketView => ({
  id: "12@1",
  key: "KIB-12",
  hold: null,
  keyLabel: "KIB-12",
  title: "Schéma Loro des tickets",
  description: "Arbre LoroTree.",
  statusId: "in_progress",
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
  thread: null,
  updatedAt: null,
  feature: null,
  ...patch,
});
const project = (main: TicketView): ProjectSnapshot => ({
  meta: {
    id: "p1",
    name: "Kibo",
    key: "KIB",
    folder: null,
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
  tickets: [main],
  links: [],
  questions: [],
  questionRecipients: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-22",
  sprints: [],
});
const withLinks = (main: TicketView): ProjectSnapshot => {
  const base = project(main);
  const t = (n: number, title: string, statusId: TicketView["statusId"] = "todo") =>
    ticket({ id: `${n}@1`, key: `KIB-${n}`, keyLabel: `KIB-${n}`, title, statusId });
  return {
    ...base,
    tickets: [
      { ...main, waitingOn: ["KIB-5", "KIB-13"] },
      t(5, "Loro", "done"),
      t(13, "Sync", "done"),
      t(15, "Kanban"),
      t(16, "Notes"),
      t(20, "Schéma des pages"),
    ],
    links: [
      { id: "l1", from: "5@1", to: main.id, type: "blocks" },
      { id: "l2", from: "13@1", to: main.id, type: "blocks" },
      { id: "l3", from: main.id, to: "15@1", type: "blocks" },
      { id: "l4", from: "16@1", to: main.id, type: "relates" },
    ],
  };
};

const show = async (main = ticket(), build = project) => {
  const onOpenTicket = mock((_id: string) => {});
  render(
    <TicketSheet
      project={build(main)}
      ticketId={main.id}
      domains={[]}
      viewer="adam"
      onClose={() => {}}
      onOpenInTab={() => {}}
      onOpenFile={() => {}}
      onOpenTicket={onOpenTicket}
      onDeleted={() => {}}
    />,
  );
  await act(async () => {});
  return { onOpenTicket, user: userEvent.setup() };
};
const command = (req: RpcRequest | undefined) => (req?.method === "command" ? req.command : null);
const openSelect = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  screen.getByRole("combobox", { name }).focus();
  await user.keyboard("{ArrowDown}");
};

beforeEach(() => {
  calls.length = 0;
  answer = () => null;
  sessionStorage.removeItem(TICKET_TAB_KEY);
});

test("the three groups list the linked tickets, done ones greyed, and open them", async () => {
  const { user, onOpenTicket } = await show(ticket(), withLinks);
  const section = screen.getByRole("region", { name: "Dépendances" });
  const group = (name: string) => within(within(section).getByRole("group", { name }));
  expect(
    group("Bloqué par")
      .getAllByRole("button", { name: /^KIB-/ })
      .map((b) => b.textContent),
  ).toEqual(["KIB-5 Loro", "KIB-13 Sync"]);
  expect(group("Bloqué par").getByRole("button", { name: /^KIB-5/ }).className).toContain(
    "text-muted-foreground",
  );
  expect(group("Bloque").getByRole("button", { name: /^KIB-15/ }).className).not.toContain(
    "text-muted-foreground",
  );
  expect(
    group("Bloque")
      .getAllByRole("button", { name: /^KIB-/ })
      .map((b) => b.textContent),
  ).toEqual(["KIB-15 Kanban"]);
  expect(
    group("Lié à")
      .getAllByRole("button", { name: /^KIB-/ })
      .map((b) => b.textContent),
  ).toEqual(["KIB-16 Notes"]);
  expect(screen.queryByText("Attend")).toBeNull();
  await user.click(group("Bloque").getByRole("button", { name: /^KIB-15/ }));
  expect(onOpenTicket).toHaveBeenCalledWith("15@1");
});

test("the cross removes the link", async () => {
  const { user } = await show(ticket(), withLinks);
  await user.click(screen.getByRole("button", { name: "Retirer KIB-13" }));
  expect(command(calls.at(-1))).toEqual({ method: "removeLink", linkId: "l2" });
});

test("a failed removal is shown", async () => {
  answer = () => {
    throw new KiboError("NOT_FOUND", "link");
  };
  const { user } = await show(ticket(), withLinks);
  await user.click(screen.getByRole("button", { name: "Retirer KIB-13" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Ce ticket n'existe plus.");
});

test("adding a dependency searches by key or title and sends addLink in the right direction", async () => {
  const { user } = await show(ticket(), withLinks);
  await user.click(screen.getByRole("button", { name: "Ajouter une dépendance" }));
  await user.type(screen.getByRole("textbox", { name: "Ticket" }), "KIB-2");
  expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["KIB-20 Schéma des pages"]);
  await user.click(screen.getByRole("option", { name: /KIB-20/ }));
  expect(command(calls.at(-1))).toEqual({ method: "addLink", from: "20@1", to: "12@1", type: "blocks" });
  await openSelect(user, "Type");
  await user.click(await screen.findByRole("option", { name: "Bloque" }));
  await user.clear(screen.getByRole("textbox", { name: "Ticket" }));
  await user.type(screen.getByRole("textbox", { name: "Ticket" }), "pages");
  await user.click(screen.getByRole("option", { name: /KIB-20/ }));
  expect(command(calls.at(-1))).toEqual({ method: "addLink", from: "12@1", to: "20@1", type: "blocks" });
  await openSelect(user, "Type");
  await user.click(await screen.findByRole("option", { name: "Lié à" }));
  await user.click(screen.getByRole("option", { name: /KIB-20/ }));
  expect(command(calls.at(-1))).toEqual({ method: "addLink", from: "12@1", to: "20@1", type: "relates" });
});

test("a cycle and a duplicate are explained, nothing else changes", async () => {
  answer = (req) => {
    if (command(req)?.method !== "addLink") return null;
    throw new KiboError("LINK_CYCLE", "cycle");
  };
  const { user } = await show(ticket(), withLinks);
  await user.click(screen.getByRole("button", { name: "Ajouter une dépendance" }));
  await user.type(screen.getByRole("textbox", { name: "Ticket" }), "pages");
  await user.click(screen.getByRole("option", { name: /KIB-20/ }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Impossible : cela créerait une boucle de dépendances.",
  );
  expect((screen.getByRole("textbox", { name: "Ticket" }) as HTMLInputElement).value).toBe("pages");
  answer = () => {
    throw new KiboError("INVALID_INPUT", "duplicate link");
  };
  await user.click(screen.getByRole("option", { name: /KIB-20/ }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Ce lien existe déjà."));
  expect(calls.filter((c) => command(c)?.method === "addLink")).toHaveLength(2);
});
