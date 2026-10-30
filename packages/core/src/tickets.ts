import {
  type Assignee,
  DeliveryStep,
  type FileCheck,
  formatTicketKey,
  Hold,
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
import { pruneLinks } from "./links";
import { getProjectMeta, nextTicketSeq } from "./project";
import { pruneQuestions } from "./questions";
import {
  assignShortKey,
  checkShortKey,
  isFeatureNode,
  nextFeatureSlot,
  nextShortKey,
  type ShortKeyAllocation,
} from "./short-key";
import { readDelivery, readExternalRefs, readHold, readProgress } from "./ticket-fields";
import { getNode, moveNode, subtreeIds, walkDepthFirst } from "./tree";

export { readExternalRefs } from "./ticket-fields";

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
    hold: readHold(n),
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

type TicketKeys = {
  key: string;
  feature: boolean;
  shortKey: (ticketId: string) => ShortKeyAllocation | null;
};

const parentShortKey = (doc: LoroDoc, parent: LoroTreeNode | undefined): ShortKeyAllocation | null =>
  parent === undefined || isFeatureNode(parent) ? null : nextShortKey(doc, parent.id);

function stepKeys(doc: LoroDoc, parent: LoroTreeNode | undefined): TicketKeys {
  const parentKey = parentShortKey(doc, parent);
  const shortKey = () => parentKey;
  const key = formatTicketKey(getProjectMeta(doc).key, nextTicketSeq(doc));
  return { key, feature: false, shortKey };
}

function featureKeys(doc: LoroDoc): TicketKeys {
  const slot = nextFeatureSlot(doc, null);
  return { key: slot.key, feature: true, shortKey: (ticketId) => ({ ticketId, ...slot }) };
}

function assertRoot(doc: LoroDoc, ticketId: string, parentId: string | null): void {
  if (parentId !== null && isFeatureNode(getNode(ticketTree(doc), ticketId)))
    throw new KiboError("INVALID_INPUT", "a feature is a root ticket");
}

function stepIndex(parent: LoroTreeNode): number | undefined {
  const siblings = parent.children() ?? [];
  const last = siblings.at(-1);
  return last?.data.get("optional") === true ? siblings.length - 1 : undefined;
}

export function createTicket(doc: LoroDoc, input: NewTicket): Ticket {
  const blockedReason = input.statusId === "blocked" ? cleanReason(input.blockedReason) : null;
  const title = cleanTitle(input.title);
  const labels = normalizeLabels(input.labels ?? []);
  if (input.feature === true && input.parentId)
    throw new KiboError("INVALID_INPUT", "a feature is a root ticket");
  const parent = input.parentId ? getNode(ticketTree(doc), input.parentId) : undefined;
  const keys = input.feature === true ? featureKeys(doc) : stepKeys(doc, parent);
  const node = parent ? parent.createNode(stepIndex(parent)) : ticketTree(doc).createNode();
  node.data.set("key", keys.key);
  if (keys.feature) node.data.set("feature", true);
  node.data.set("title", title);
  node.data.set("statusId", input.statusId ?? "todo");
  node.data.set("blockedReason", blockedReason);
  node.data.set("domainId", input.domainId ?? null);
  node.data.set("assignee", input.assignee ?? null);
  node.data.set("externalRefs", []);
  node.data.set("labels", labels);
  writeDescription(node, input.description ?? "");
  assignShortKey(doc, keys.shortKey(node.id));
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
  if (shortKey !== undefined && isFeatureNode(node) && shortKey !== key)
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
  const shortKey = parentShortKey(doc, parentId === null ? undefined : getNode(ticketTree(doc), parentId));
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

function nextHold(node: LoroTreeNode, reason: string, since: string | undefined): Hold {
  if (node.parent() === undefined)
    throw new KiboError("INVALID_INPUT", "a hold needs a step (a feature cannot be held)");
  if (node.data.get("statusId") === "done")
    throw new KiboError("INVALID_INPUT", "a delivered step cannot be held");
  if (since === undefined) throw new KiboError("INVALID_INPUT", "a hold needs its day");
  const parsed = Hold.safeParse({ reason, since: readHold(node)?.since ?? since });
  if (!parsed.success)
    throw new KiboError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "invalid hold");
  return parsed.data;
}

export function setHold(doc: LoroDoc, id: string, reason: string | null, since?: string): Ticket {
  const node = getNode(ticketTree(doc), id);
  if (reason === null && readHold(node) === null) return readTicket(node);
  node.data.set("hold", reason === null ? null : nextHold(node, reason, since));
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
