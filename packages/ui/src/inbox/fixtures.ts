import {
  INBOX_ID,
  type ProjectSnapshot,
  type ProjectSummary,
  type StatusId,
  type TicketView,
} from "@kibo/schema";
import { kiboProject } from "../agents/fixtures";

const base = kiboProject();

export function inboxTicket(n: number, title: string, statusId: StatusId, adam: boolean): TicketView {
  return {
    id: `inb${n}`,
    key: `INB-${n}`,
    pendingSeq: null,
    keyLabel: `INB-${n}`,
    title,
    description: "",
    statusId,
    blockedReason: null,
    domainId: null,
    assignee: adam ? { kind: "human", ref: "adam" } : null,
    parentId: null,
    labels: [],
    externalRefs: [],
    progress: { done: 0, total: 0 },
    waitingOn: [],
    openQuestions: 0,
  };
}

export const inboxSnapshot: ProjectSnapshot = {
  ...base,
  meta: { id: INBOX_ID, key: "INB", name: "Inbox", folder: null, color: "#64748B", worktree: null },
  tickets: [
    inboxTicket(1, "Idée : export CSV des tickets", "backlog", false),
    inboxTicket(2, "Appeler le comptable", "todo", true),
    inboxTicket(3, "Relire la doc d'onboarding", "in_progress", true),
  ],
  links: [],
  nextTicketKey: "INB-4",
};

const counts = { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 };

export const fileTargets: ProjectSummary[] = [
  { ...base.meta, id: "p1", key: "KIB", name: "Kibo", counts },
  { ...base.meta, id: "p2", key: "POR", name: "Portfolio", counts },
  { ...base.meta, id: "p3", key: "FAC", name: "API Facturation", counts },
];

const sync = base.sync;

export const fileSnapshots: ReadonlyMap<string, ProjectSnapshot> = new Map([
  [INBOX_ID, inboxSnapshot],
  ["p1", { ...base, meta: fileTargets[0] ?? base.meta, nextTicketKey: "KIB-25" }],
  [
    "p2",
    {
      ...base,
      meta: fileTargets[1] ?? base.meta,
      nextTicketKey: "POR-…",
      sync: { ...sync, shared: true, keyAllocator: "server", role: "owner", access: "write" },
    },
  ],
  [
    "p3",
    {
      ...base,
      meta: fileTargets[2] ?? base.meta,
      nextTicketKey: "FAC-3",
      sync: { ...sync, shared: true, keyAllocator: "server", role: "viewer", access: "read-only" },
    },
  ],
]);
