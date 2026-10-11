import {
  type Assignee,
  EMPTY_PROGRESS,
  ExternalRef,
  type FileCheck,
  formatTicketKey,
  KiboError,
  normalizeLabels,
  REPORTS_MAX,
  type RunReport,
  type RunReportInput,
  type StatusId,
  type Step,
  type Ticket,
  TicketProgress,
} from "@kibo/schema";
import { type LoroDoc, LoroText, type LoroTreeNode, type TreeID } from "loro-crdt";
import { getKeyAllocator, nextPendingSeq } from "./keys";
import { pruneLinks } from "./links";
import { getProjectMeta, nextTicketSeq } from "./project";
import { pruneQuestions } from "./questions";
import { getNode, moveNode, subtreeIds, walkDepthFirst } from "./tree";

export type NewTicket = {
  title: string;
  description?: string;
  statusId?: StatusId;
  blockedReason?: string | null;
  parentId?: string | null;
  assignee?: Assignee | null;
  domainId?: string | null;
  labels?: readonly string[];
};
export type TicketPatch = {
  title?: string;
  description?: string;
  domainId?: string | null;
  assignee?: Assignee | null;
  labels?: readonly string[];
};

export type TicketProgressUpdate = {
  ticketId: string;
  runId: string;
  at: number;
  plan?: Step[];
  report?: RunReportInput;
  check?: FileCheck;
};

export const ticketTree = (doc: LoroDoc) => doc.getTree("tickets");

const RefList = ExternalRef.array();

export function readExternalRefs(node: LoroTreeNode): ExternalRef[] {
  const raw = node.data.get("externalRefs");
  if (raw === undefined || raw === null) return [];
  const parsed = RefList.safeParse(raw);
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `invalid external refs on ${node.id}`);
  return parsed.data;
}

function readProgress(node: LoroTreeNode): TicketProgress {
  const raw = node.data.get("agentProgress");
  if (raw === undefined || raw === null) return EMPTY_PROGRESS;
  const parsed = TicketProgress.safeParse(raw);
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `invalid agent progress on ${node.id}`);
  return parsed.data;
}

const cleanTitle = (title: string): string => {
  const t = title.trim();
  if (!t) throw new KiboError("INVALID_INPUT", "ticket title is empty");
  return t;
};

function readTicket(n: LoroTreeNode): Ticket {
  const d = n.data;
  const text = d.get("description");
  return {
    id: n.id,
    key: (d.get("key") as string | null | undefined) ?? null,
    pendingSeq: (d.get("pendingSeq") as number | null | undefined) ?? null,
    title: d.get("title") as string,
    description: text instanceof LoroText ? text.toString() : "",
    statusId: d.get("statusId") as StatusId,
    blockedReason: (d.get("blockedReason") as string | null | undefined) ?? null,
    domainId: (d.get("domainId") as string | null | undefined) ?? null,
    assignee: (d.get("assignee") as Assignee | null | undefined) ?? null,
    parentId: n.parent()?.id ?? null,
    externalRefs: readExternalRefs(n),
    labels: (d.get("labels") as string[] | undefined) ?? [],
    agentProgress: readProgress(n),
  };
}

function cleanReason(reason: string | null | undefined): string {
  const r = reason?.trim() ?? "";
  if (!r) throw new KiboError("BLOCKED_REASON_REQUIRED", "a blocked ticket needs a reason");
  return r;
}

function writeDescription(n: LoroTreeNode, value: string): void {
  const text = n.data.getOrCreateContainer("description", new LoroText());
  if (text.length > 0) text.delete(0, text.length);
  if (value) text.insert(0, value);
}

export function createTicket(doc: LoroDoc, input: NewTicket): Ticket {
  const blockedReason = input.statusId === "blocked" ? cleanReason(input.blockedReason) : null;
  const title = cleanTitle(input.title);
  const labels = normalizeLabels(input.labels ?? []);
  const parent = input.parentId ? getNode(ticketTree(doc), input.parentId) : undefined;
  const serverKeys = getKeyAllocator(doc) === "server";
  const pendingSeq = serverKeys ? nextPendingSeq(doc) : null;
  const key = serverKeys ? null : formatTicketKey(getProjectMeta(doc).key, nextTicketSeq(doc));
  const node = parent ? parent.createNode() : ticketTree(doc).createNode();
  node.data.set("key", key);
  node.data.set("pendingSeq", pendingSeq);
  node.data.set("title", title);
  node.data.set("statusId", input.statusId ?? "todo");
  node.data.set("blockedReason", blockedReason);
  node.data.set("domainId", input.domainId ?? null);
  node.data.set("assignee", input.assignee ?? null);
  node.data.set("externalRefs", []);
  node.data.set("labels", labels);
  writeDescription(node, input.description ?? "");
  doc.commit();
  return readTicket(node);
}

export function getTicket(doc: LoroDoc, id: string): Ticket {
  return readTicket(getNode(ticketTree(doc), id));
}

export function listTickets(doc: LoroDoc): Ticket[] {
  return walkDepthFirst(ticketTree(doc)).map(readTicket);
}

export function updateTicket(doc: LoroDoc, id: string, patch: TicketPatch): Ticket {
  const node = getNode(ticketTree(doc), id);
  const labels = patch.labels === undefined ? undefined : normalizeLabels(patch.labels);
  if (patch.title !== undefined) node.data.set("title", cleanTitle(patch.title));
  if (patch.description !== undefined) writeDescription(node, patch.description);
  if (patch.domainId !== undefined) node.data.set("domainId", patch.domainId);
  if (patch.assignee !== undefined) node.data.set("assignee", patch.assignee);
  if (labels !== undefined) node.data.set("labels", labels);
  doc.commit();
  return readTicket(node);
}

export function setStatus(doc: LoroDoc, id: string, statusId: StatusId, reason?: string): Ticket {
  const node = getNode(ticketTree(doc), id);
  node.data.set("blockedReason", statusId === "blocked" ? cleanReason(reason) : null);
  node.data.set("statusId", statusId);
  doc.commit();
  return readTicket(node);
}

export function moveTicket(doc: LoroDoc, id: string, parentId: string | null, index?: number): void {
  moveNode(ticketTree(doc), id, parentId, index);
  doc.commit();
}

export function deleteTicket(doc: LoroDoc, id: string): string[] {
  const ids = subtreeIds(getNode(ticketTree(doc), id));
  ticketTree(doc).delete(id as TreeID);
  pruneLinks(doc, ids);
  pruneQuestions(doc, ids);
  return ids;
}

export function childProgress(doc: LoroDoc, id: string): { done: number; total: number } {
  const children = getNode(ticketTree(doc), id).children() ?? [];
  return { done: children.filter((c) => c.data.get("statusId") === "done").length, total: children.length };
}

function withReport(reports: readonly RunReport[], report: RunReport): RunReport[] {
  const others = reports.filter((r) => r.runId !== report.runId);
  return [...others, report].sort((a, b) => a.at - b.at).slice(-REPORTS_MAX);
}

function withCheck(reports: readonly RunReport[], runId: string, check: FileCheck): RunReport[] {
  if (!reports.some((r) => r.runId === runId)) throw new KiboError("NOT_FOUND", `run ${runId} has no report`);
  return reports.map((r) => (r.runId === runId ? { ...r, check } : r));
}

export function setTicketProgress(doc: LoroDoc, update: TicketProgressUpdate): Ticket {
  const node = getNode(ticketTree(doc), update.ticketId);
  let next = readProgress(node);
  if (update.plan) next = { ...next, plan: update.plan, planRunId: update.runId, planAt: update.at };
  if (update.report) {
    const report = { ...update.report, runId: update.runId, at: update.at, check: null };
    next = { ...next, reports: withReport(next.reports, report) };
  }
  if (update.check) next = { ...next, reports: withCheck(next.reports, update.runId, update.check) };
  const parsed = TicketProgress.safeParse(next);
  if (!parsed.success)
    throw new KiboError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "invalid progress");
  node.data.set("agentProgress", parsed.data);
  doc.commit();
  return readTicket(node);
}
