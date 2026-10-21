import {
  type FeatureStatus,
  type FeatureStep,
  featureSteps,
  type ProjectSnapshot,
  type SprintView,
} from "@kibo/schema";

export type SprintFeature = {
  id: string;
  shortKey: string;
  title: string;
  status: FeatureStatus;
  steps: Pick<FeatureStep, "ticketId" | "statusId" | "onHold">[];
};

export type SprintTiming =
  | { kind: "endsToday" }
  | { kind: "endsIn"; days: number }
  | { kind: "ended"; end: string }
  | { kind: "starts"; start: string };

const DAY_MS = 86_400_000;
const dayNumber = (day: string): number => Date.parse(`${day}T00:00:00Z`) / DAY_MS;

export function sprintFeatures(
  project: Pick<ProjectSnapshot, "tickets" | "links">,
  sprint: Pick<SprintView, "id">,
): SprintFeature[] {
  return project.tickets.flatMap((t) =>
    t.feature === null || t.sprintId !== sprint.id
      ? []
      : [
          {
            id: t.id,
            shortKey: t.shortKey ?? t.keyLabel,
            title: t.title,
            status: t.feature.status,
            steps: featureSteps({ feature: t.id, tickets: project.tickets, links: project.links }).map(
              (s) => ({ ticketId: s.ticketId, statusId: s.statusId, onHold: s.onHold }),
            ),
          },
        ],
  );
}

export function sprintTiming(sprint: Pick<SprintView, "start" | "end">, today: string): SprintTiming {
  if (sprint.end < today) return { kind: "ended", end: sprint.end };
  if (sprint.start > today) return { kind: "starts", start: sprint.start };
  if (sprint.end === today) return { kind: "endsToday" };
  return { kind: "endsIn", days: dayNumber(sprint.end) - dayNumber(today) };
}

const pad = (n: number): string => String(n).padStart(2, "0");

export function localDay(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
