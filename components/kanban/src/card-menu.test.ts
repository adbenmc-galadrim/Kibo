import { afterEach, expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, EMPTY_PROGRESS, type TicketView } from "@kibo/schema";
import { isSeparator, isSubmenu } from "@kibo/sdk/ui/menu-entries";
import { type CardMenuActions, cardMenuEntries } from "./card-menu";
import { fr } from "./fr";

const ticket = {
  id: "1@1",
  key: "KIB-1",
  hold: null,
  keyLabel: "KIB-1",
  title: "Arbre",
  description: "",
  statusId: "todo",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  externalRefs: [],
  labels: [],
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
} satisfies TicketView;
const actions = (): CardMenuActions => ({
  open: mock(() => {}),
  move: mock((_s: string) => {}),
  remove: mock(() => {}),
});
const toasts: string[] = [];
const sdk = { toast: (message: string) => void toasts.push(message) };
const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
afterEach(() => {
  toasts.length = 0;
  if (original) Object.defineProperty(navigator, "clipboard", original);
  else Reflect.deleteProperty(navigator, "clipboard");
});
const labels = (entries: ReturnType<typeof cardMenuEntries>) =>
  entries.map((e) => (isSeparator(e) ? "—" : isSubmenu(e) ? `${e.label} ▸` : e.label));

test("an editable card offers open, move to the other statuses, delete", () => {
  const a = actions();
  const entries = cardMenuEntries({
    ticket,
    statuses: DEFAULT_WORKFLOW,
    texts: fr,
    sdk,
    actions: a,
  });
  expect(labels(entries)).toEqual([
    "Ouvrir",
    "Copier /full-delivery KIB-1",
    "Déplacer vers ▸",
    "—",
    "Supprimer…",
  ]);
  const move = entries.find(isSubmenu);
  expect(move?.items.map((i) => i.label)).toEqual(["Backlog", "En cours", "En review", "Bloqué…", "Terminé"]);
  move?.items[3]?.onSelect();
  expect(a.move).toHaveBeenCalledWith("blocked");
});

test("hidden agent execution replaces Livrer with copying the full-delivery command, with feedback", async () => {
  const a = actions();
  const entries = cardMenuEntries({
    ticket,
    statuses: DEFAULT_WORKFLOW,
    texts: fr,
    sdk,
    actions: a,
  });
  expect(labels(entries)).toEqual([
    "Ouvrir",
    "Copier /full-delivery KIB-1",
    "Déplacer vers ▸",
    "—",
    "Supprimer…",
  ]);
  const copy = entries[1];
  if (!copy || isSeparator(copy) || isSubmenu(copy)) throw new Error("no copy entry");
  const written: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: (text: string) => Promise.resolve(void written.push(text)) },
    configurable: true,
  });
  copy.onSelect();
  await Promise.resolve();
  await Promise.resolve();
  expect(written).toEqual(["/full-delivery KIB-1"]);
  expect(toasts).toEqual(["Copié"]);
});
