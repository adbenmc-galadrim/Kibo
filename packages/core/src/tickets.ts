import {
  type Assignee,
  DeliveryStep,
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
import { getKeyAllocator, isFeatureKey, nextPendingSeq } from "./keys";
import { pruneLinks } from "./links";
import { getProjectMeta, nextTicketSeq } from "./project";
import { pruneQuestions } from "./questions";
import { assignShortKey, checkShortKey, nextShortKey, type ShortKeyAllocation } from "./short-key";
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
  feature?: boolean;
};
export type TicketPatch = {
  title?: string;
  description?: string;
  domainId?: string | null;
  assignee?: Assignee | null;
  labels?: readonly string[];
  shortKey?: string | null;
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

function readDelivery(node: LoroTreeNode): DeliveryStep | null {
  const raw = node.data.get("delivery");
  if (raw === undefined || raw === null) return null;
  const parsed = DeliveryStep.safeParse(raw);
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `invalid delivery step on ${node.id}`);
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
    delivery: readDelivery(n),
    sprintId: (d.get("sprintId") as string | null | undefined) ?? null,
    optional: d.get("optional") === true,
    shortKey: (d.get("shortKey") as string | null | undefined) ?? null,
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

type TicketKeys = { key: string | null; pendingSeq: number | null; shortKey: ShortKeyAllocation | null };

function stepKeys(doc: LoroDoc, parentId: string | null): TicketKeys {
  const shortKey = parentId === null ? null : nextShortKey(doc, parentId);
  if (getKeyAllocator(doc) === "server") return { key: null, pendingSeq: nextPendingSeq(doc), shortKey };
  return { key: formatTicketKey(getProjectMeta(doc).key, nextTicketSeq(doc)), pendingSeq: null, shortKey };
}

function featureKeys(doc: LoroDoc, ticketId: string): TicketKeys {
  const shortKey = nextShortKey(doc, ticketId);
  if (shortKey === null) throw new KiboError("INVALID_INPUT", "a feature is a root ticket");
  return { key: shortKey.key, pendingSeq: null, shortKey };
}

function assertRoot(doc: LoroDoc, ticketId: string, parentId: string | null): void {
  if (parentId !== null && isFeatureKey(getNode(ticketTree(doc), ticketId).data.get("key")))
    throw new KiboError("INVALID_INPUT", "a feature is a root ticket");
}

export function createTicket(doc: LoroDoc, input: NewTicket): Ticket {
  const blockedReason = input.statusId === "blocked" ? cleanReason(input.blockedReason) : null;
  const title = cleanTitle(input.title);
  const labels = normalizeLabels(input.labels ?? []);
  if (input.feature === true && input.parentId)
    throw new KiboError("INVALID_INPUT", "a feature is a root ticket");
  const parent = input.parentId ? getNode(ticketTree(doc), input.parentId) : undefined;
  const step = input.feature === true ? null : stepKeys(doc, parent?.id ?? null);
  const node = parent ? parent.createNode() : ticketTree(doc).createNode();
  const keys = step ?? featureKeys(doc, node.id);
  node.data.set("key", keys.key);
  node.data.set("pendingSeq", keys.pendingSeq);
  node.data.set("title", title);
  node.data.set("statusId", input.statusId ?? "todo");
  node.data.set("blockedReason", blockedReason);
  node.data.set("domainId", input.domainId ?? null);
  node.data.set("assignee", input.assignee ?? null);
  node.data.set("externalRefs", []);
  node.data.set("labels", labels);
  writeDescription(node, input.description ?? "");
  assignShortKey(doc, keys.shortKey);
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
  const title = patch.title === undefined ? undefined : cleanTitle(patch.title);
  const shortKey = patch.shortKey === undefined ? undefined : checkShortKey(doc, id, patch.shortKey);
  const key = node.data.get("key");
  if (shortKey !== undefined && isFeatureKey(key) && shortKey !== key)
    throw new KiboError("INVALID_INPUT", `the short key of feature ${key} is its key`);
  if (title !== undefined) node.data.set("title", title);
  if (patch.description !== undefined) writeDescription(node, patch.description);
  if (patch.domainId !== undefined) node.data.set("domainId", patch.domainId);
  if (patch.assignee !== undefined) node.data.set("assignee", patch.assignee);
  if (labels !== undefined) node.data.set("labels", labels);
  if (shortKey !== undefined) node.data.set("shortKey", shortKey);
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
  assertRoot(doc, id, parentId);
  const shortKey = parentId === null ? null : nextShortKey(doc, parentId);
  moveNode(ticketTree(doc), id, parentId, index);
  assignShortKey(doc, shortKey);
  doc.commit();
}

export function setTicketOptional(doc: LoroDoc, id: string, optional: boolean): Ticket {
  const node = getNode(ticketTree(doc), id);
  if (node.parent() === undefined)
    throw new KiboError("INVALID_INPUT", "an optional step needs a parent ticket");
  node.data.set("optional", optional);
  doc.commit();
  return readTicket(node);
}

export function deleteTicket(doc: LoroDoc, id: string): string[] {
  const ids = subtreeIds(getNode(ticketTree(doc), id));
  ticketTree(doc).delete(id as TreeID);
  pruneLinks(doc, ids);
  pruneQuestions(doc, ids);
  return ids;
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

export function setTicketDelivery(doc: LoroDoc, ticketId: string, delivery: DeliveryStep | null): Ticket {
  const node = getNode(ticketTree(doc), ticketId);
  const parsed = DeliveryStep.nullable().safeParse(delivery);
  if (!parsed.success)
    throw new KiboError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "invalid delivery step");
  node.data.set("delivery", parsed.data);
  doc.commit();
  return readTicket(node);
}
