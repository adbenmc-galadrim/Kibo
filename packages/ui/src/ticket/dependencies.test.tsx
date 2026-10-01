import { beforeEach, expect, mock, test } from "bun:test";
import {
  DEFAULT_WORKFLOW,
  KiboError,
  type ProjectSnapshot,
  type RpcRequest,
  type TicketView,
} from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let answer: (req: RpcRequest) => unknown = () => null;
mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "getSyncState") return { bindings: [], pending: [], errors: [] };
      if (req.method === "getPresence") return [];
      return answer(req);
    },
    subscribe: () => () => undefined,
    subscribeEvents: () => () => undefined,
    subscribeIntegrations: () => () => undefined,
  },
}));

const { TicketSheet } = await import("../shell/TicketSheet");

const ticket = (patch: Partial<TicketView> = {}): TicketView => ({
  id: "12@1",
  key: "KIB-12",
  pendingSeq: null,
  keyLabel: "KIB-12",
  title: "Schéma Loro des tickets",
  description: "Arbre LoroTree.",
  statusId: "in_progress",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  ...patch,
});
const project = (main: TicketView, access: ProjectSnapshot["sync"]["access"] = "write"): ProjectSnapshot => ({
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [main],
  links: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-22",
  sync: { shared: access !== "write", keyAllocator: "local", role: null, access, members: [] },
});
const withLinks = (
  main: TicketView,
  access: ProjectSnapshot["sync"]["access"] = "write",
): ProjectSnapshot => {
  const base = project(main, access);
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

const show = (main = ticket(), access: ProjectSnapshot["sync"]["access"] = "write", build = project) => {
  const onOpenTicket = mock((_id: string) => {});
  render(
    <TicketSheet
      project={build(main, access)}
      ticketId={main.id}
      domains={[]}
      viewer="adam"
      onClose={() => {}}
      onAssign={() => {}}
      onOpenInTab={() => {}}
      onOpenFile={() => {}}
      onOpenTicket={onOpenTicket}
      onDeleted={() => {}}
    />,
  );
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
});

test("the three groups list the linked tickets, done ones greyed, and open them", async () => {
  const { user, onOpenTicket } = show(ticket(), "write", withLinks);
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
  const { user } = show(ticket(), "write", withLinks);
  await user.click(screen.getByRole("button", { name: "Retirer KIB-13" }));
  expect(command(calls.at(-1))).toEqual({ method: "removeLink", linkId: "l2" });
});

test("a failed removal is shown", async () => {
  answer = () => {
    throw new KiboError("NOT_FOUND", "link");
  };
  const { user } = show(ticket(), "write", withLinks);
  await user.click(screen.getByRole("button", { name: "Retirer KIB-13" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Ce ticket n'existe plus.");
});

test("adding a dependency searches by key or title and sends addLink in the right direction", async () => {
  const { user } = show(ticket(), "write", withLinks);
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
  const { user } = show(ticket(), "write", withLinks);
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

test("a read-only project shows the groups without crosses or the add form", () => {
  show(ticket(), "read-only", withLinks);
  expect(screen.getByRole("group", { name: "Bloqué par" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Retirer / })).toBeNull();
  expect(screen.queryByRole("button", { name: "Ajouter une dépendance" })).toBeNull();
  expect(screen.queryByRole("textbox", { name: "Ticket" })).toBeNull();
});

test("a ticket without links in a read-only project shows no dependencies section", () => {
  show(ticket(), "read-only");
  expect(screen.queryByRole("region", { name: "Dépendances" })).toBeNull();
});
