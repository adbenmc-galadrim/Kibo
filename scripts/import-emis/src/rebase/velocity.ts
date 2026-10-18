import { dateOf, dayNumber, type GithubPrRef, isoWeekday } from "@kibo/schema";
import type { Mapping } from "./mapping";

export const DEFAULT_VELOCITY = 5;
const MIN_WEEKS = 2;
const THURSDAY = 4;
const WEEK_DAYS = 7;

export type Merge = { number: number; mergedAt: string };
export type StepMerge = Merge & { key: string; week: string };
export type ObservedVelocity = { velocity: number; source: string; merges: StepMerge[] };

export function isoWeek(timestamp: string): string {
  const day = timestamp.slice(0, 10);
  const thursday = dateOf(dayNumber(day) + THURSDAY - isoWeekday(day));
  const year = thursday.slice(0, 4);
  const week = Math.floor((dayNumber(thursday) - dayNumber(`${year}-01-01`)) / WEEK_DAYS) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

const distinctWeeks = (merges: readonly { week: string }[]): string[] =>
  [...new Set(merges.map((m) => m.week))].sort();

export function velocity(merges: readonly { week: string }[], fallback = DEFAULT_VELOCITY): number {
  const weeks = distinctWeeks(merges).length;
  if (weeks < MIN_WEEKS) return fallback;
  return Math.max(1, Math.floor(merges.length / weeks));
}

const mergedPrs = (mapping: Mapping): GithubPrRef[] =>
  mapping.features.flatMap((f) =>
    f.steps.flatMap((s) =>
      s.ticket.refs.filter((r): r is GithubPrRef => r.kind === "github_pr" && r.state === "merged"),
    ),
  );

export function repoOf(mapping: Mapping): string | null {
  const url = mergedPrs(mapping)[0]?.url ?? null;
  const match = url?.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/\d+/);
  return match?.[1] ?? null;
}

function stepMerges(mapping: Mapping, merges: readonly Merge[]): StepMerge[] {
  const at = new Map(merges.map((m) => [m.number, m.mergedAt]));
  return mapping.features.flatMap((f) =>
    f.steps.flatMap((s) => {
      if (s.ticket.statusId !== "done") return [];
      const pr = s.ticket.refs.find((r): r is GithubPrRef => r.kind === "github_pr" && r.state === "merged");
      const mergedAt = pr ? at.get(pr.number) : undefined;
      if (!pr || mergedAt === undefined) return [];
      return [{ number: pr.number, mergedAt, key: s.newKey, week: isoWeek(mergedAt) }];
    }),
  );
}

const plural = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`;

export function observedVelocity(mapping: Mapping, merges: readonly Merge[] | null): ObservedVelocity {
  if (merges === null)
    return {
      velocity: DEFAULT_VELOCITY,
      merges: [],
      source: "valeur par défaut : fusions non lues (--no-gh ou gh indisponible)",
    };
  const steps = stepMerges(mapping, merges);
  const weeks = distinctWeeks(steps);
  const counted = `${plural(steps.length, "étape fusionnée", "étapes fusionnées")} sur ${plural(weeks.length, "semaine", "semaines")}`;
  if (weeks.length < MIN_WEEKS)
    return {
      velocity: DEFAULT_VELOCITY,
      merges: steps,
      source: `valeur par défaut : ${counted}, moins de deux semaines`,
    };
  return {
    velocity: velocity(steps),
    merges: steps,
    source: `gh : ${counted} (${weeks[0]} à ${weeks.at(-1)})`,
  };
}
