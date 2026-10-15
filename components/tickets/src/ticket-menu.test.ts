import { expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, EMPTY_PROGRESS, type TicketView } from "@kibo/schema";
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
  startable: false,
  agentProgress: EMPTY_PROGRESS,
  delivery: null,
  ...patch,
});
const actions = (): TicketMenuActions => ({
  open: mock(() => {}),
  setStatus: mock((_s: string) => {}),
  newSubTicket: mock(() => {}),
  moveToRoot: mock(() => {}),
  remove: mock(() => {}),
  deliver: mock(() => {}),
});
const labels = (entries: ReturnType<typeof ticketMenuEntries>) =>
  entries.map((e) => (isSeparator(e) ? "—" : isSubmenu(e) ? `${e.label} ▸` : e.label));

test("an editable ticket gets open, status submenu, new sub-ticket, move to root, delete", () => {
  const a = actions();
  const entries = ticketMenuEntries({
    ticket: ticket(),
    statuses: DEFAULT_WORKFLOW,
    readOnly: false,
    deliver: null,
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
    deliver: null,
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
    deliver: { disabledReason: null },
    texts: fr,
    actions: actions(),
  });
  expect(labels(entries)).toEqual(["Ouvrir"]);
});

const withDeliver = (deliver: { disabledReason: string | null } | null, a = actions()) =>
  ticketMenuEntries({
    ticket: ticket(),
    statuses: DEFAULT_WORKFLOW,
    readOnly: false,
    deliver,
    texts: fr,
    actions: a,
  });

test("Livrer comes right after Ouvrir when the ticket can be delivered", () => {
  const a = actions();
  const entries = withDeliver({ disabledReason: null }, a);
  expect(labels(entries).slice(0, 3)).toEqual(["Ouvrir", "Livrer", "Statut ▸"]);
  const deliver = entries[1];
  if (!deliver || isSeparator(deliver) || isSubmenu(deliver)) throw new Error("no Livrer");
  deliver.onSelect();
  expect(a.deliver).toHaveBeenCalled();
});

test("Livrer is disabled and says which run is already there", () => {
  const deliver = withDeliver({ disabledReason: "déjà un run : emis · full-delivery · EMIS-15" })[1];
  if (!deliver || isSeparator(deliver) || isSubmenu(deliver)) throw new Error("no Livrer");
  expect(deliver.disabled).toBe(true);
  expect(deliver.hint).toBe("déjà un run : emis · full-delivery · EMIS-15");
});
