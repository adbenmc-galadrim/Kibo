import type { OverviewIndicators } from "@kibo/schema";
import { fr } from "./fr";
import { dayMonth } from "./overview-facts";

type Dot = "amber" | "red";
export type IndicatorText = { value: string; unit: string; sub?: string; dot?: Dot };
export type IndicatorTexts = {
  features: { value: string; unit: string; cells: OverviewIndicators["features"]["cells"] };
  sprint: IndicatorText;
  open: IndicatorText;
  review: IndicatorText;
  questions: IndicatorText;
};

const t = fr.indicators;

function sprintText(sprint: OverviewIndicators["sprint"]): IndicatorText {
  if ("next" in sprint) {
    const next = sprint.next;
    return {
      value: t.noSprint,
      unit: "",
      ...(next === null ? {} : { sub: t.startsOn(next.code, dayMonth(next.start)) }),
    };
  }
  const unit = sprint.ending === "today" ? t.endsToday : t.endsIn(sprint.ending.days);
  return { value: sprint.code, unit, sub: sprint.name };
}

function openText(open: OverviewIndicators["open"]): IndicatorText {
  const dot: Dot | undefined = open.level === "reached" ? "amber" : open.level === "over" ? "red" : undefined;
  return {
    value: String(open.count),
    unit: t.openOf(open.limit),
    sub: t.level[open.level],
    ...(dot ? { dot } : {}),
  };
}

function questionsText(q: OverviewIndicators["questions"]): IndicatorText {
  const base = { value: String(q.open), unit: t.openQuestions(q.open) };
  if (q.blocking === null) return { ...base, sub: t.noBlocking };
  return { ...base, sub: t.blocks(q.blocking.ref, q.blocking.shortKey), dot: "red" };
}

export function indicatorTexts(ind: OverviewIndicators): IndicatorTexts {
  return {
    features: {
      value: String(ind.features.delivered),
      unit: t.deliveredOf(ind.features.delivered, ind.features.total),
      cells: ind.features.cells,
    },
    sprint: sprintText(ind.sprint),
    open: openText(ind.open),
    review: {
      value: String(ind.review.count),
      unit: t.pr,
      sub: ind.review.count === 0 ? t.noPr : ind.review.numbers.map((n) => `#${n}`).join(" · "),
    },
    questions: questionsText(ind.questions),
  };
}
