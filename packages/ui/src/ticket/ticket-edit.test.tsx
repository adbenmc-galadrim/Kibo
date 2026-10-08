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
const { TicketTab } = await import("../pages/TicketTab");

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
  labels: [],
  externalRefs: [],
  progress: { done: 3, total: 5 },
  waitingOn: [],
  openQuestions: 0,
  ...patch,
});
const child = (n: number, parentId: string): TicketView =>
  ticket({
    id: `${n}@1`,
    key: `KIB-${n}`,
    keyLabel: `KIB-${n}`,
    title: `Sous-tâche ${n}`,
    parentId,
    progress: { done: 0, total: 0 },
  });
const project = (main: TicketView, access: ProjectSnapshot["sync"]["access"] = "write"): ProjectSnapshot => ({
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6", worktree: null },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [main, child(20, main.id), child(21, "20@1")],
  links: [],
  questions: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-22",
  sync: {
    shared: access !== "write",
    keyAllocator: "local",
    role: null,
    access,
    members: [{ userId: "u-lea", name: "Léa", role: "editor" }],
  },
});

const show = (main = ticket(), access: ProjectSnapshot["sync"]["access"] = "write") => {
  const onDeleted = mock(() => {});
  const onOpenTicket = mock((_id: string) => {});
  const onOpenInTab = mock(() => {});
  render(
    <TicketSheet
      project={project(main, access)}
      ticketId={main.id}
      domains={[]}
      viewer="adam"
      onClose={() => {}}
      onAssign={() => {}}
      onOpenInTab={onOpenInTab}
      onOpenFile={() => {}}
      onOpenTicket={onOpenTicket}
      onDeleted={onDeleted}
    />,
  );
  return { onDeleted, onOpenTicket, onOpenInTab, user: userEvent.setup() };
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

test("the sheet title stays a heading named after the ticket, and names the dialog", () => {
  show();
  const dialog = screen.getByRole("dialog", { name: "Schéma Loro des tickets" });
  expect(dialog.className).toContain("w-full sm:max-w-[min(90vw,560px)]");
  const heading = within(dialog).getByRole("heading", { name: "Schéma Loro des tickets" });
  expect(heading.textContent).toBe("Schéma Loro des tickets");
  // Chromium names the heading after the button's aria-label, dom-accessibility-api does not.
  expect(heading.getAttribute("aria-label")).toBe("Schéma Loro des tickets");
  expect(within(heading).getByRole("button", { name: "Modifier le titre" }).textContent).toBe(
    "Schéma Loro des tickets",
  );
});

test("while the title is edited, the sheet keeps its name", async () => {
  const { user } = show();
  await user.click(screen.getByRole("button", { name: "Modifier le titre" }));
  expect(screen.getByRole("textbox", { name: "Titre" })).toBeTruthy();
  expect(screen.getByRole("dialog", { name: "Schéma Loro des tickets" })).toBeTruthy();
});

test("the tab title stays a heading named after the ticket", () => {
  const main = ticket();
  render(
    <TicketTab
      project={project(main)}
      ticketId={main.id}
      viewer="adam"
      onOpenFile={() => {}}
      onOpenTicket={() => {}}
    />,
  );
  const heading = screen.getByRole("heading", { level: 1, name: "Schéma Loro des tickets" });
  expect(heading.textContent).toBe("Schéma Loro des tickets");
  // Chromium names the heading after the button's aria-label, dom-accessibility-api does not.
  expect(heading.getAttribute("aria-label")).toBe("Schéma Loro des tickets");
  expect(within(heading).getByRole("button", { name: "Modifier le titre" }).textContent).toBe(
    "Schéma Loro des tickets",
  );
});

test("the title is edited in place and saved on Enter", async () => {
  const { user } = show();
  await user.click(screen.getByRole("button", { name: "Modifier le titre" }));
  const field = screen.getByRole("textbox", { name: "Titre" });
  expect(screen.getByText("Entrée pour enregistrer · Échap pour annuler")).toBeTruthy();
  await user.clear(field);
  await user.type(field, "Schéma Loro des tickets (LoroTree){Enter}");
  expect(command(calls.at(-1))).toEqual({
    method: "updateTicket",
    ticketId: "12@1",
    title: "Schéma Loro des tickets (LoroTree)",
  });
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "Titre" })).toBeNull());
});

test("an empty title is refused by the daemon: the error shows, the field stays, Escape restores the old title", async () => {
  answer = () => {
    throw new KiboError("INVALID_INPUT", "ticket title is empty");
  };
  const { user } = show();
  await user.click(screen.getByRole("button", { name: "Modifier le titre" }));
  const field = screen.getByRole("textbox", { name: "Titre" });
  await user.clear(field);
  await user.type(field, "   {Enter}");
  expect((await screen.findByRole("alert")).textContent).toBe("Le titre ne peut pas être vide.");
  expect(screen.getByRole("textbox", { name: "Titre" })).toBeTruthy();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("button", { name: "Modifier le titre" }).textContent).toBe(
    "Schéma Loro des tickets",
  );
  expect(screen.queryByRole("alert")).toBeNull();
});

test("the status select sends setStatus, Bloqué asks for a reason first", async () => {
  const { user } = show();
  await openSelect(user, "Statut");
  await user.click(await screen.findByRole("option", { name: "En review" }));
  expect(command(calls.at(-1))).toEqual({ method: "setStatus", ticketId: "12@1", statusId: "in_review" });
  await openSelect(user, "Statut");
  await user.click(await screen.findByRole("option", { name: "Bloqué" }));
  const dialog = await screen.findByRole("dialog", { name: "Bloquer KIB-12" });
  expect(calls.filter((c) => command(c)?.method === "setStatus")).toHaveLength(1);
  await user.type(within(dialog).getByLabelText("Motif"), "Attente du client");
  await user.click(within(dialog).getByRole("button", { name: "Bloquer" }));
  expect(command(calls.at(-1))).toEqual({
    method: "setStatus",
    ticketId: "12@1",
    statusId: "blocked",
    reason: "Attente du client",
  });
});

test("the assignee select offers nobody, me and the members; an agent assignee is not editable here", async () => {
  const { user } = show();
  await openSelect(user, "Assigné");
  expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual([
    "Personne",
    "Moi",
    "Léa",
  ]);
  await user.click(screen.getByRole("option", { name: "Moi" }));
  expect(command(calls.at(-1))).toEqual({
    method: "updateTicket",
    ticketId: "12@1",
    assignee: { kind: "human", ref: "adam" },
  });
});

test("an agent assignee shows a disabled select with the hint", () => {
  show(ticket({ assignee: { kind: "agent", ref: "opus-dev-1" } }));
  const select = screen.getByRole("combobox", { name: "Assigné" });
  expect(select.getAttribute("data-disabled")).not.toBeNull();
  expect(select.textContent).toContain("opus-dev-1");
  expect(screen.getByText("Choisis un profil via Assigner à un agent")).toBeTruthy();
});

test("the description is edited in a textarea and saved", async () => {
  const { user } = show();
  await user.click(screen.getByRole("button", { name: "Modifier" }));
  const field = screen.getByRole("textbox", { name: "Description" });
  await user.clear(field);
  await user.type(field, "Nouveau texte");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(command(calls.at(-1))).toEqual({
    method: "updateTicket",
    ticketId: "12@1",
    description: "Nouveau texte",
  });
});

test("a description save error is shown once, inside the editor", async () => {
  answer = () => {
    throw new KiboError("NOT_FOUND", "ticket not found");
  };
  const { user } = show();
  await user.click(screen.getByRole("button", { name: "Modifier" }));
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  await screen.findByRole("alert");
  expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual(["Ce ticket n'existe plus."]);
  expect(screen.getByRole("textbox", { name: "Description" })).toBeTruthy();
});

test("sub-tickets open in the sheet", async () => {
  const { user, onOpenTicket } = show();
  await user.click(screen.getByRole("button", { name: /KIB-20/ }));
  expect(onOpenTicket).toHaveBeenCalledWith("20@1");
});

test("the menu opens in a tab, copies the key and deletes after confirmation", async () => {
  answer = (req) => (command(req)?.method === "deleteTicket" ? ["12@1", "20@1", "21@1"] : null);
  const { user, onDeleted, onOpenInTab } = show();
  const written: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (t: string) => void written.push(t) },
  });
  await user.click(screen.getByRole("button", { name: "Actions KIB-12" }));
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
    "Ouvrir dans un onglet",
    "Copier la clé",
    "Supprimer…",
  ]);
  await user.click(screen.getByRole("menuitem", { name: "Ouvrir dans un onglet" }));
  expect(onOpenInTab).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Actions KIB-12" }));
  await user.click(await screen.findByRole("menuitem", { name: "Copier la clé" }));
  expect(written).toEqual(["KIB-12"]);
  expect((await screen.findByRole("status")).textContent).toBe("Clé copiée");
  await user.click(screen.getByRole("button", { name: "Actions KIB-12" }));
  await user.click(await screen.findByRole("menuitem", { name: "Supprimer…" }));
  const dialog = await screen.findByRole("alertdialog", { name: "Supprimer KIB-12 ?" });
  expect(dialog.textContent).toContain(
    "Ses 2 sous-tickets et ses liens seront supprimés aussi. Cette action est irréversible.",
  );
  await user.click(within(dialog).getByRole("button", { name: "Supprimer" }));
  expect(command(calls.at(-1))).toEqual({ method: "deleteTicket", ticketId: "12@1" });
  await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
});

test("a read-only project shows the ticket without any editing control", async () => {
  const { user } = show(ticket(), "read-only");
  expect(screen.queryByRole("button", { name: "Modifier le titre" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Schéma Loro des tickets" })).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Statut" })).toBeNull();
  expect(screen.getByText("En cours")).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Assigné" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Modifier" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Actions KIB-12" }));
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
    "Ouvrir dans un onglet",
    "Copier la clé",
  ]);
});
