import type { Overlap, OverlapDetail, OverlapRole } from "@kibo/schema";
import { formatClock } from "../agents/format";
import { frOverlaps } from "../i18n/fr-overlaps";

const t = frOverlaps.moment;

const sameDay = (a: number, b: number): boolean => new Date(a).toDateString() === new Date(b).toDateString();

export function momentStamp(at: number, now: number): string {
  if (sameDay(at, now)) return formatClock(at);
  const date = new Date(at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `${date} ${formatClock(at)}`;
}

export function overlapState(overlap: Overlap, now: number): string {
  if (overlap.status === "ignored") return t.ignoredState;
  if (overlap.status === "resolved")
    return t.resolved(momentStamp(overlap.resolvedAt ?? overlap.lastSeenAt, now));
  return t.open;
}

export const overlapRole = (role: OverlapRole, withRunName = ""): string =>
  role === "owner" ? t.ownedBy(withRunName) : t.role.other;

export const chipLabel = (open: number): string => frOverlaps.bar.chip(open);

export const activityCounts = (resolved: number, open: number): string =>
  frOverlaps.activity.counts(resolved, open);

export function overlapCounts(overlaps: readonly Overlap[]): { resolved: number; open: number } {
  return {
    resolved: overlaps.filter((o) => o.status === "resolved").length,
    open: overlaps.filter((o) => o.status === "open").length,
  };
}

export function overlapWhat(detail: OverlapDetail): { code: string | null; text: string } {
  if (detail.kind === "file") return { code: detail.path, text: t.bothSides };
  if (detail.kind === "export") return { code: detail.name, text: t.exported };
  return { code: null, text: t.sameLines(detail.lines) };
}

export function overlapSides(detail: OverlapDetail, role: OverlapRole): { mine: string; theirs: string } {
  if (detail.kind === "file") return { mine: detail.path, theirs: detail.path };
  const owner = detail.kind === "block" ? `${detail.ownerPath}:${detail.ownerStart}` : detail.ownerPath;
  const other = detail.kind === "block" ? `${detail.otherPath}:${detail.otherStart}` : detail.otherPath;
  return role === "other" ? { mine: other, theirs: owner } : { mine: owner, theirs: other };
}

export const actorName = (by: { ref: string } | null): string => by?.ref ?? "Kibo";
