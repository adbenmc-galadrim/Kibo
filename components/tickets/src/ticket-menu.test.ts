import { expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, type TicketView } from "@kibo/schema";
import { isSeparator, isSubmenu } from "@kibo/sdk/ui/menu-entries";
import { fr } from "./fr";
import { type TicketMenuActions, ticketMenuEntries } from "./ticket-menu";

const ticket = (patch: Partial<TicketView> = {}): TicketView => ({
  id: "27@1",
  key: "KIB-27",
  pendingSeq: null,
  keyLabel: "KIB-27",
  title: "Récepteur",
  description: "",
  statusId: "in_progress",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: "12@1",
  labels: [],
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
  ...patch,
});
const actions = (): TicketMenuActions => ({
  open: mock(() => {}),
  setStatus: mock((_s: string) => {}),
  newSubTicket: mock(() => {}),
  moveToRoot: mock(() => {}),
  remove: mock(() => {}),
});
const labels = (entries: ReturnType<typeof ticketMenuEntries>) =>
  entries.map((e) => (isSeparator(e) ? "—" : isSubmenu(e) ? `${e.label} ▸` : e.label));

test("an editable ticket gets open, status submenu, new sub-ticket, move to root, delete", () => {
  const a = actions();
  const entries = ticketMenuEntries({
    ticket: ticket(),
    statuses: DEFAULT_WORKFLOW,
    readOnly: false,
    texts: fr,
    actions: a,
  });
  expect(labels(entries)).toEqual([
    "Ouvrir",
    "Statut ▸",
    "Nouveau sous-ticket",
    "Déplacer à la racine",
    "—",
    "Supprimer…",
  ]);
  const status = entries.find(isSubmenu);
  expect(status?.items.map((i) => [i.label, i.disabled ?? false])).toEqual([
    ["Backlog", false],
    ["À faire", false],
    ["En cours", true],
    ["En review", false],
    ["Bloqué…", false],
    ["Terminé", false],
  ]);
  status?.items[5]?.onSelect();
  expect(a.setStatus).toHaveBeenCalledWith("done");
  status?.items[4]?.onSelect();
  expect(a.setStatus).toHaveBeenCalledWith("blocked");
});

test("a root ticket cannot be moved to the root", () => {
  const entries = ticketMenuEntries({
    ticket: ticket({ parentId: null }),
    statuses: DEFAULT_WORKFLOW,
    readOnly: false,
    texts: fr,
    actions: actions(),
  });
  const root = entries.find((e) => !isSeparator(e) && !isSubmenu(e) && e.label === "Déplacer à la racine");
  expect(root && !isSeparator(root) && !isSubmenu(root) && root.disabled).toBe(true);
});

test("read-only keeps only Ouvrir", () => {
  const entries = ticketMenuEntries({
    ticket: ticket(),
    statuses: DEFAULT_WORKFLOW,
    readOnly: true,
    texts: fr,
    actions: actions(),
  });
  expect(labels(entries)).toEqual(["Ouvrir"]);
});
