import { expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, EMPTY_PROGRESS, type TicketView } from "@kibo/schema";
import { isSeparator, isSubmenu } from "@kibo/sdk/ui/menu-entries";
import { type CardMenuActions, cardMenuEntries } from "./card-menu";
import { fr } from "./fr";

const ticket = {
  id: "1@1",
  key: "KIB-1",
  pendingSeq: null,
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
  agentProgress: EMPTY_PROGRESS,
  delivery: null,
  sprintId: null,
  optional: false,
  shortKey: null,
} satisfies TicketView;
const actions = (): CardMenuActions => ({
  open: mock(() => {}),
  move: mock((_s: string) => {}),
  remove: mock(() => {}),
  deliver: mock(() => {}),
});
const labels = (entries: ReturnType<typeof cardMenuEntries>) =>
  entries.map((e) => (isSeparator(e) ? "—" : isSubmenu(e) ? `${e.label} ▸` : e.label));

test("an editable card offers open, move to the other statuses, delete", () => {
  const a = actions();
  const entries = cardMenuEntries({
    ticket,
    statuses: DEFAULT_WORKFLOW,
    readOnly: false,
    deliver: null,
    texts: fr,
    actions: a,
  });
  expect(labels(entries)).toEqual(["Ouvrir", "Déplacer vers ▸", "—", "Supprimer…"]);
  const move = entries.find(isSubmenu);
  expect(move?.items.map((i) => i.label)).toEqual(["Backlog", "En cours", "En review", "Bloqué…", "Terminé"]);
  move?.items[3]?.onSelect();
  expect(a.move).toHaveBeenCalledWith("blocked");
});

test("read-only keeps only Ouvrir", () => {
  expect(
    labels(
      cardMenuEntries({
        ticket,
        statuses: DEFAULT_WORKFLOW,
        readOnly: true,
        deliver: { disabledReason: null },
        texts: fr,
        actions: actions(),
      }),
    ),
  ).toEqual(["Ouvrir"]);
});

const entriesWith = (deliver: { disabledReason: string | null } | null, a = actions()) =>
  cardMenuEntries({ ticket, statuses: DEFAULT_WORKFLOW, readOnly: false, deliver, texts: fr, actions: a });

test("Livrer comes right after Ouvrir when the ticket can be delivered", () => {
  const a = actions();
  const entries = entriesWith({ disabledReason: null }, a);
  expect(labels(entries)).toEqual(["Ouvrir", "Livrer", "Déplacer vers ▸", "—", "Supprimer…"]);
  const deliver = entries[1];
  if (!deliver || isSeparator(deliver) || isSubmenu(deliver)) throw new Error("no Livrer");
  expect(deliver.disabled).toBe(false);
  deliver.onSelect();
  expect(a.deliver).toHaveBeenCalled();
});

test("Livrer is disabled and says which run is already there", () => {
  const deliver = entriesWith({ disabledReason: "déjà un run : emis · full-delivery · EMIS-15" })[1];
  if (!deliver || isSeparator(deliver) || isSubmenu(deliver)) throw new Error("no Livrer");
  expect(deliver.disabled).toBe(true);
  expect(deliver.hint).toBe("déjà un run : emis · full-delivery · EMIS-15");
});

test("no Livrer without a deliverable ticket", () => {
  expect(labels(entriesWith(null))).toEqual(["Ouvrir", "Déplacer vers ▸", "—", "Supprimer…"]);
});
