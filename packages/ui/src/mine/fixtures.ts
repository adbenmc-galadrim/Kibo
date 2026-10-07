import type { Assignee, ProjectMeta, ProjectSnapshot, StatusId, TicketView } from "@kibo/schema";
import { kiboProject } from "../agents/fixtures";

let seq = 0;

export function mineTicket(
  key: string | null,
  statusId: StatusId,
  assignee: Assignee | null,
  waitingOn: string[] = [],
): TicketView {
  seq += 1;
  return {
    id: `${seq}@1`,
    key,
    pendingSeq: key === null ? seq : null,
    keyLabel: key ?? "KIB-…",
    title: key ?? `Ticket ${seq}`,
    description: "",
    statusId,
    blockedReason: statusId === "blocked" ? "Audit sécurité externe en attente" : null,
    domainId: null,
    assignee,
    parentId: null,
    labels: [],
    externalRefs: [],
    progress: { done: 0, total: 0 },
    waitingOn,
  };
}

const adam: Assignee = { kind: "human", ref: "adam" };
const agent: Assignee = { kind: "agent", ref: "opus" };
const base = kiboProject();

export const mineMeta = (
  id: string,
  name: string,
  key: string,
  folder: string | null = null,
): ProjectMeta => ({
  ...base.meta,
  id,
  name,
  key,
  folder,
});
const snapshot = (m: ProjectMeta, tickets: TicketView[]): ProjectSnapshot => ({ ...base, meta: m, tickets });

export const kib = mineMeta("kib", "Kibo", "KIB", "/tmp/kibo");
export const fac = mineMeta("fac", "API Facturation", "FAC");
export const por = mineMeta("por", "Portfolio", "POR");

export const mineSnapshots: ReadonlyMap<string, ProjectSnapshot> = new Map([
  [
    kib.id,
    snapshot(kib, [
      mineTicket("KIB-9", "todo", adam),
      mineTicket("KIB-22", "backlog", adam),
      mineTicket("KIB-11", "in_review", adam),
      mineTicket("KIB-15", "todo", adam, ["KIB-12"]),
      mineTicket("KIB-7", "in_review", adam),
      mineTicket("KIB-21", "blocked", adam),
      mineTicket("KIB-5", "done", adam),
      mineTicket("KIB-12", "in_progress", agent),
      mineTicket("KIB-3", "in_progress", null),
    ]),
  ],
  [fac.id, snapshot(fac, [mineTicket("FAC-34", "todo", adam), mineTicket("FAC-31", "in_progress", adam)])],
  [por.id, snapshot(por, [mineTicket("POR-9", "todo", adam)])],
]);
