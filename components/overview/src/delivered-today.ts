import { FINAL_STATUSES, type ProjectEvent } from "@kibo/schema";
import type { FeatureFacts } from "./overview-facts";

export type DeliveredToday = {
  featureId: string;
  label: string;
  title: string;
  steps: number;
  lastMergeAt: number;
  prNumber: number | null;
};

const pad = (n: number): string => String(n).padStart(2, "0");

const localDay = (at: number): string => {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const movedToDone = (e: ProjectEvent): boolean =>
  e.kind === "status_changed" && FINAL_STATUSES.some((status) => status === e.data.to);

function deliveringEvent(f: FeatureFacts, events: readonly ProjectEvent[]): ProjectEvent | null {
  const mandatory = new Set(f.steps.filter((s) => !s.optional).map((s) => s.ticketId));
  const closing = events.filter(
    (e) => e.ticketId !== null && mandatory.has(e.ticketId) && (e.kind === "pr_merged" || movedToDone(e)),
  );
  return closing.reduce<ProjectEvent | null>(
    (last, e) => (last === null || e.at >= last.at ? e : last),
    null,
  );
}

export function deliveredToday(
  features: readonly FeatureFacts[],
  events: readonly ProjectEvent[],
  today: string,
): DeliveredToday[] {
  return features.flatMap((f) => {
    if (f.state.status !== "delivered") return [];
    const event = deliveringEvent(f, events);
    if (event === null || localDay(event.at) !== today) return [];
    const number = event.kind === "pr_merged" ? event.data.number : null;
    return [
      {
        featureId: f.id,
        label: f.shortKey,
        title: f.title,
        steps: f.steps.length,
        lastMergeAt: event.at,
        prNumber: typeof number === "number" ? number : null,
      },
    ];
  });
}
