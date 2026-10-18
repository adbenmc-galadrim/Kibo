import type { OverviewIndicators } from "@kibo/schema";
import { fr } from "./fr";
import { dayMonth, weekdayDayMonth } from "./overview-facts";

type Dot = "amber" | "red";
export type IndicatorText = { value: string; unit: string; sub?: string; dot?: Dot };
export type IndicatorTexts = {
  features: {
    value: string;
    unit: string;
    cells: OverviewIndicators["features"]["cells"];
    sub?: string;
    alert?: true;
  };
  sprint: IndicatorText;
  open: IndicatorText;
  review: IndicatorText;
  questions: IndicatorText;
};

const t = fr.indicators;
const TIGHT_CELLS_FROM = 13;

export const featureCellGap = (count: number): number => (count >= TIGHT_CELLS_FROM ? 2 : 3);

function endingText(ending: Extract<OverviewIndicators["sprint"], { ending: unknown }>["ending"]): string {
  if (ending === "today") return t.endsToday;
  return "days" in ending ? t.endsIn(ending.days) : t.endedOn(dayMonth(ending.ended));
}

function sprintText(sprint: OverviewIndicators["sprint"]): IndicatorText {
  if ("next" in sprint) {
    const next = sprint.next;
    return {
      value: t.noSprint,
      unit: "",
      ...(next === null ? {} : { sub: t.startsOn(next.code, weekdayDayMonth(next.start)) }),
    };
  }
  return { value: sprint.code, unit: endingText(sprint.ending), sub: sprint.name };
}

function openText(open: OverviewIndicators["open"], blocked: number): IndicatorText {
  const level = open.level === "reached" ? "amber" : open.level === "over" ? "red" : undefined;
  const dot: Dot | undefined = blocked > 0 ? "red" : level;
  const sub = open.count === 0 ? t.noneOpen : t.level[open.level];
  return {
    value: String(open.count),
    unit: t.openOf(open.limit),
    sub: blocked > 0 ? `${sub} · ${t.blocked(blocked)}` : sub,
    ...(dot ? { dot } : {}),
  };
}

function featuresText(features: OverviewIndicators["features"]): IndicatorTexts["features"] {
  const base = {
    value: String(features.delivered),
    unit: t.deliveredOf(features.delivered, features.total),
    cells: features.cells,
  };
  if (features.late > 0) return { ...base, sub: t.late(features.late), alert: true };
  return features.total === 0 ? { ...base, sub: t.noFeature } : base;
}

function questionsText(q: OverviewIndicators["questions"]): IndicatorText {
  const base = { value: String(q.open), unit: t.openQuestions(q.open) };
  if (q.open === 0) return { ...base, sub: t.noQuestion };
  if (q.blocking === null) return { ...base, sub: t.noBlocking };
  return { ...base, sub: t.blocks(q.blocking.ref, q.blocking.shortKey), dot: "red" };
}

export function indicatorTexts(ind: OverviewIndicators): IndicatorTexts {
  return {
    features: featuresText(ind.features),
    sprint: sprintText(ind.sprint),
    open: openText(ind.open, ind.blocked.count),
    review: {
      value: String(ind.review.count),
      unit: t.pr,
      sub: ind.review.count === 0 ? t.noPr : ind.review.numbers.map((n) => `#${n}`).join(" · "),
    },
    questions: questionsText(ind.questions),
  };
}
