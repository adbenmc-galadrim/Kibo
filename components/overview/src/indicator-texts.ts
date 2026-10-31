import type { OverviewIndicators } from "@kibo/schema";
import { fr } from "./fr";
import { dayMonth, weekdayDayMonth } from "./overview-facts";

type Dot = "amber" | "red";
export type IndicatorFacts = OverviewIndicators & {
  blockedFeatures: readonly string[];
  ahead: readonly string[];
  atRisk: number;
  remaining: number;
  held: number;
};
export type IndicatorText = {
  value: string;
  unit: string;
  sub?: string;
  dot?: Dot;
  subTone?: "amber";
  hint?: string;
};
export type IndicatorTexts = {
  features: {
    value: string;
    unit: string;
    cells: OverviewIndicators["features"]["cells"];
    sub?: string;
    tone?: Dot;
    held?: string;
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

function openHint(open: OverviewIndicators["open"], blocked: readonly string[], ahead: readonly string[]) {
  return [
    t.openHint,
    ...(open.level === "over" && ahead.length > 0 ? [t.ahead(ahead)] : []),
    ...(blocked.length > 0 ? [t.blocked(blocked)] : []),
  ].join(" · ");
}

function openText(ind: IndicatorFacts): IndicatorText {
  const { open } = ind;
  const atLimit = open.level !== "under" && open.count > 0;
  return {
    value: String(open.count),
    unit: t.openUnit(open.count),
    sub: t.openLimit(open.limit),
    ...(atLimit ? { dot: "amber" as const, subTone: "amber" as const } : {}),
    hint: openHint(open, ind.blockedFeatures, ind.ahead),
  };
}

function featuresText(
  features: OverviewIndicators["features"],
  atRisk: number,
  held: number,
): IndicatorTexts["features"] {
  const base = {
    value: String(features.delivered),
    unit: t.deliveredOf(features.delivered, features.total),
    cells: features.cells,
  };
  if (held > 0)
    return {
      ...base,
      held: t.held(held),
      ...(features.late > 0 ? { sub: t.late(features.late), tone: "red" as const } : {}),
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
    features: featuresText(ind.features, ind.atRisk, ind.held),
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
