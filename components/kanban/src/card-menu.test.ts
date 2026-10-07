import { expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, type TicketView } from "@kibo/schema";
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
} satisfies TicketView;
const actions = (): CardMenuActions => ({
  open: mock(() => {}),
  move: mock((_s: string) => {}),
  remove: mock(() => {}),
});
const labels = (entries: ReturnType<typeof cardMenuEntries>) =>
  entries.map((e) => (isSeparator(e) ? "—" : isSubmenu(e) ? `${e.label} ▸` : e.label));

test("an editable card offers open, move to the other statuses, delete", () => {
  const a = actions();
  const entries = cardMenuEntries({
    ticket,
    statuses: DEFAULT_WORKFLOW,
    readOnly: false,
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
      cardMenuEntries({ ticket, statuses: DEFAULT_WORKFLOW, readOnly: true, texts: fr, actions: actions() }),
    ),
  ).toEqual(["Ouvrir"]);
});
