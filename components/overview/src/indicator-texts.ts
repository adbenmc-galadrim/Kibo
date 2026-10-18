import type { OverviewIndicators } from "@kibo/schema";
import { fr } from "./fr";
import { dayMonth, weekdayDayMonth } from "./overview-facts";

type Dot = "amber" | "red";
export type IndicatorFacts = OverviewIndicators & {
  blockedFeatures: readonly string[];
  ahead: readonly string[];
  atRisk: number;
  remaining: number;
};
export type IndicatorText = { value: string; unit: string; sub?: string; dot?: Dot };
export type IndicatorTexts = {
  features: {
    value: string;
    unit: string;
    cells: OverviewIndicators["features"]["cells"];
    sub?: string;
    tone?: Dot;
  };
  sprint: IndicatorText;
  open: IndicatorText;
  review: IndicatorText;
  questions: IndicatorText;
};

const t = fr.indicators;
const TIGHT_CELLS_FROM = 13;

export const featureCellGap = (count: number): number => (count >= TIGHT_CELLS_FROM ? 2 : 3);

type Ending = Extract<OverviewIndicators["sprint"], { ending: unknown }>["ending"];
const phase = fr.sprint.phase;

function endingText(ending: Ending): string {
  if (ending === "today") return phase["ends-today"];
  return "days" in ending ? phase.current : phase.ended(dayMonth(ending.ended));
}

function sprintText(sprint: OverviewIndicators["sprint"], remaining: number): IndicatorText {
  if ("next" in sprint) {
    const next = sprint.next;
    return {
      value: t.noSprint,
      unit: "",
      ...(next === null ? {} : { sub: t.startsOn(next.code, weekdayDayMonth(next.start)) }),
    };
  }
  const ended = typeof sprint.ending === "object" && "ended" in sprint.ending;
  const state = endingText(sprint.ending);
  return {
    value: sprint.code,
    unit: sprint.name,
    sub: ended ? `${state} · ${fr.sprint.rest(remaining)}` : state,
  };
}

function levelText(
  open: OverviewIndicators["open"],
  ahead: readonly string[],
  short: boolean,
): string | null {
  if (open.count === 0) return short ? null : t.noneOpen;
  if (open.level === "over" && ahead.length > 0) return t.ahead(ahead);
  return short ? t.levelShort[open.level] : t.level[open.level];
}

function openSub(open: OverviewIndicators["open"], blocked: readonly string[], ahead: readonly string[]) {
  if (blocked.length === 0) return levelText(open, ahead, false) ?? t.noneOpen;
  const level = levelText(open, ahead, true);
  return level === null ? t.blocked(blocked) : `${level} · ${t.blocked(blocked)}`;
}

function openText(ind: IndicatorFacts): IndicatorText {
  const { open, blockedFeatures: blocked } = ind;
  const level = open.level === "reached" ? "amber" : open.level === "over" ? "red" : undefined;
  const dot: Dot | undefined = blocked.length > 0 ? "red" : level;
  return {
    value: String(open.count),
    unit: t.openOf(open.limit),
    sub: openSub(open, blocked, ind.ahead),
    ...(dot ? { dot } : {}),
  };
}

function featuresText(features: OverviewIndicators["features"], atRisk: number): IndicatorTexts["features"] {
  const base = {
    value: String(features.delivered),
    unit: t.deliveredOf(features.delivered, features.total),
    cells: features.cells,
  };
  const alerts = [
    ...(features.late > 0 ? [t.late(features.late)] : []),
    ...(atRisk > 0 ? [t.atRisk(atRisk)] : []),
  ];
  if (alerts.length > 0)
    return { ...base, sub: alerts.join(" · "), tone: features.late > 0 ? "red" : "amber" };
  return features.total === 0 ? { ...base, sub: t.noFeature } : base;
}

function questionsText(q: OverviewIndicators["questions"]): IndicatorText {
  const base = { value: String(q.open), unit: t.openQuestions(q.open) };
  if (q.open === 0) return { ...base, sub: t.noQuestion };
  if (q.blocking === null) return { ...base, sub: t.noBlocking };
  return { ...base, sub: t.blocks(q.blocking.ref, q.blocking.shortKey), dot: "red" };
}

export function indicatorTexts(ind: IndicatorFacts): IndicatorTexts {
  return {
    features: featuresText(ind.features, ind.atRisk),
    sprint: sprintText(ind.sprint, ind.remaining),
    open: openText(ind),
    review: {
      value: String(ind.review.count),
      unit: t.pr,
      sub: ind.review.count === 0 ? t.noPr : ind.review.numbers.map((n) => `#${n}`).join(" · "),
    },
    questions: questionsText(ind.questions),
  };
}
