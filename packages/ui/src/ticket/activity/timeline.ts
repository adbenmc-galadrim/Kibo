import { isTerminal, type Question, type QuestionAnswer, type RunMoment, type RunView } from "@kibo/schema";
import { frMoments } from "../../i18n/fr-moments";
import type { FeedExtra } from "../../moments/Feed";

export const ACTIVITY_PAGE = 10;
export const WIDE_ACTIVITY_MIN = 1_100;

export type TimelineItem = {
  at: number;
  kind: "run-start" | "run-end" | "moment" | "question";
  runId: string | null;
  moment?: RunMoment;
  run?: RunView;
  question?: Question;
};

export type TimelineSegment = { run: RunView | null; items: TimelineItem[] };

const runStart = (run: RunView): number => run.startedAt ?? run.createdAt;

function runItems(run: RunView, moments: readonly RunMoment[]): TimelineItem[] {
  const items: TimelineItem[] = [{ at: runStart(run), kind: "run-start", runId: run.id, run }];
  for (const moment of moments) {
    if (moment.data.kind !== "reasoning")
      items.push({ at: moment.at, kind: "moment", runId: run.id, moment });
  }
  if (isTerminal(run.state) && run.endedAt !== null) {
    items.push({ at: run.endedAt, kind: "run-end", runId: run.id, run });
  }
  return items;
}

export function ticketRuns(runs: readonly RunView[], ticketId: string): RunView[] {
  return runs.filter((r) => r.ticketId === ticketId).sort((a, b) => runStart(a) - runStart(b));
}

export function buildTimeline(
  runs: readonly RunView[],
  momentsByRun: ReadonlyMap<string, readonly RunMoment[]>,
  questions: readonly Question[],
): TimelineItem[] {
  const ordered = [...runs].sort((a, b) => runStart(a) - runStart(b));
  const items = [
    ...ordered.flatMap((run) => runItems(run, momentsByRun.get(run.id) ?? [])),
    ...questions.map(
      (question): TimelineItem => ({
        at: question.createdAt,
        kind: "question",
        runId: question.runId,
        question,
      }),
    ),
  ];
  return items.sort((a, b) => a.at - b.at);
}

export function segmentsOf(items: readonly TimelineItem[]): TimelineSegment[] {
  const byRun = new Map<string, TimelineSegment>();
  const starts: { at: number; segment: TimelineSegment }[] = [];
  for (const item of items) {
    if (item.kind !== "run-start" || !item.run) continue;
    const segment: TimelineSegment = { run: item.run, items: [] };
    byRun.set(item.run.id, segment);
    starts.push({ at: item.at, segment });
  }
  const leading: TimelineSegment = { run: null, items: [] };
  for (const item of items) {
    const own = item.runId === null ? undefined : byRun.get(item.runId);
    const before = starts.filter((s) => s.at <= item.at).at(-1)?.segment;
    (own ?? before ?? leading).items.push(item);
  }
  const segments = starts.map((s) => s.segment);
  return leading.items.length > 0 ? [leading, ...segments] : segments;
}

const answerText = (answer: QuestionAnswer): string =>
  answer.text || answer.option || frMoments.activity.confirmed;

export function questionExtras(items: readonly TimelineItem[]): FeedExtra[] {
  return items.flatMap((item): FeedExtra[] => {
    const q = item.question;
    if (!q) return [];
    const asked: FeedExtra = {
      key: `q-${q.id}`,
      at: q.createdAt,
      kind: q.createdBy.kind === "agent" ? "question" : "system",
      text: q.title,
    };
    if (!q.answer) return [asked];
    return [asked, { key: `a-${q.id}`, at: q.answer.at, kind: "human", text: answerText(q.answer) }];
  });
}
