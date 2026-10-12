import { z } from "zod";
import type { IndexedFile } from "./overlap-index";
import type { Step } from "./progress";
import type { Actor } from "./question";
import type { RunState } from "./run";

export const OVERLAP_KINDS = ["file", "export", "block"] as const;
export const OverlapKind = z.enum(OVERLAP_KINDS);
export type OverlapKind = z.infer<typeof OverlapKind>;

export const OverlapRole = z.enum(["owner", "other"]);
export type OverlapRole = z.infer<typeof OverlapRole>;

const Line = z.number().int().min(1);

export const OverlapDetail = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("file"), path: z.string() }),
  z.object({ kind: z.literal("export"), name: z.string(), ownerPath: z.string(), otherPath: z.string() }),
  z.object({
    kind: z.literal("block"),
    ownerPath: z.string(),
    ownerStart: Line,
    otherPath: z.string(),
    otherStart: Line,
    lines: Line,
    chars: z.number().int().min(0),
  }),
]);
export type OverlapDetail = z.infer<typeof OverlapDetail>;

export const OverlapStatus = z.enum(["open", "resolved", "ignored"]);
export type OverlapStatus = z.infer<typeof OverlapStatus>;

export type OverlapRow = {
  id: string;
  projectId: string;
  kind: OverlapKind;
  key: string;
  ownerRunId: string;
  otherRunId: string;
  ownerWorkspace: string;
  otherWorkspace: string;
  detail: OverlapDetail;
  firstSeenAt: number;
};

export type OverlapEvent = {
  type: "delivered" | "resolved" | "ignored";
  role: OverlapRole | null;
  by: Actor | null;
  at: number;
};

export type Overlap = OverlapRow & {
  lastSeenAt: number;
  status: OverlapStatus;
  deliveredAt: number | null;
  ownerDeliveredAt: number | null;
  resolvedAt: number | null;
  ignoredBy: Actor | null;
  ignoredAt: number | null;
};

const firstDelivery = (events: readonly OverlapEvent[], role: OverlapRole): number | null =>
  events.find((e) => e.type === "delivered" && e.role === role)?.at ?? null;

export function foldOverlap(row: OverlapRow, lastSeenAt: number, events: readonly OverlapEvent[]): Overlap {
  const final = events.find((e) => e.type !== "delivered");
  return {
    ...row,
    lastSeenAt,
    status: final?.type === "resolved" || final?.type === "ignored" ? final.type : "open",
    deliveredAt: firstDelivery(events, "other"),
    ownerDeliveredAt: firstDelivery(events, "owner"),
    resolvedAt: final?.type === "resolved" ? final.at : null,
    ignoredBy: final?.type === "ignored" ? final.by : null,
    ignoredAt: final?.type === "ignored" ? final.at : null,
  };
}

export const overlapKey = (kind: OverlapKind, key: string): string => `${kind}:${key}`;

export const AUTO_LINK_REASONS = ["import", "copy"] as const;
export const AutoLinkReason = z.enum(AUTO_LINK_REASONS);
export type AutoLinkReason = z.infer<typeof AutoLinkReason>;

export type AutoLinkRow = {
  id: string;
  projectId: string;
  linkId: string;
  fromTicketId: string;
  toTicketId: string;
  fromTicketKey: string;
  toTicketKey: string;
  ownerRunId: string;
  otherRunId: string;
  reason: AutoLinkReason;
  detail: { path: string; name: string | null };
  at: number;
};

export type AutoLinkEvent = { type: "cancelled" | "removed"; by: Actor | null; at: number };

export type AutoLink = AutoLinkRow & {
  status: "added" | "cancelled" | "removed";
  cancelledBy: Actor | null;
  cancelledAt: number | null;
};

export function foldAutoLink(row: AutoLinkRow, events: readonly AutoLinkEvent[]): AutoLink {
  const [final] = events;
  return {
    ...row,
    status: final?.type ?? "added",
    cancelledBy: final?.type === "cancelled" ? final.by : null,
    cancelledAt: final?.type === "cancelled" ? final.at : null,
  };
}

export type RunOverlapCount = { runId: string; open: number };

export type OverlapIgnore = {
  projectId: string;
  kind: OverlapKind;
  key: string;
  label: string;
  by: Actor;
  at: number;
};

export type ParallelFile = { path: string; status: IndexedFile["status"]; added: number; removed: number };

export type ParallelRun = {
  runId: string;
  name: string;
  ticketKey: string;
  ticketTitle: string;
  startedAt: number;
  step: string | null;
  plan: Step[] | null;
  files: ParallelFile[];
  exports: { name: string; path: string }[];
  workspace: "worktree" | "repo" | "shared" | "isolated";
  worktreeName: string | null;
  truncated: boolean;
};

export type ParallelWork = { runs: ParallelRun[]; more: number; overlaps: Overlap[]; partial: boolean };

export type PeekWorkResult = {
  run: {
    id: string;
    name: string;
    ticketKey: string;
    ticketTitle: string;
    state: RunState;
    startedAt: number;
    workspace: "worktree" | "repo";
  };
  plan: Step[] | null;
  files: (ParallelFile & { exports: string[] })[];
  truncated: boolean;
  overlaps: Overlap[];
};

export type PeekFileResult = {
  path: string;
  status: IndexedFile["status"];
  content: string;
  diff: string;
  truncated: boolean;
};
