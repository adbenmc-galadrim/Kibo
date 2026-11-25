import {
  CI_MARK,
  fr,
  frPrs,
  type GraphViewKind,
  type Lane,
  type PrReviewTone,
  RING_CLASS,
} from "@kibo/component-graph/models";
import { ChevronDown, GitPullRequest, GitPullRequestDraft, Hand } from "lucide-react";
import type { ReactNode } from "react";
import { frGraph } from "../../i18n/fr-graph";
import { BottomSheet } from "./BottomSheet";
import { PR_ICON_TONE } from "./PhonePrsView";

type Props = {
  view: GraphViewKind;
  lanes: readonly Lane[];
  filter: string | null;
  counter: string;
  onFilter(filter: string | null): void;
  onClose(): void;
};

type Item = { key: string; label: string; mark: ReactNode };

const DOT = "size-2 shrink-0 rounded-full";
const BOX = "h-[18px] w-7 shrink-0 rounded-[5px] border";
const L = fr.sprints.legend;

const STATUSES: readonly Item[] = [
  { key: "todo", label: L.todo, mark: <span className={`size-2 shrink-0 ${RING_CLASS}`} /> },
  { key: "progress", label: L.progress, mark: <span className={`${DOT} bg-(--tracking-blue)`} /> },
  { key: "review", label: L.review, mark: <span className={`${DOT} bg-(--tracking-purple)`} /> },
  { key: "blocked", label: L.blocked, mark: <span className={`${DOT} bg-(--tracking-red)`} /> },
  { key: "done", label: frGraph.steps.done, mark: <span className={`${DOT} bg-(--tracking-green)`} /> },
  { key: "hold", label: L.hold, mark: <span className={`${DOT} bg-(--tracking-hold)`} /> },
];

const SEGMENTS = [
  "bg-(--tracking-fg)",
  "bg-(--tracking-purple)",
  "bg-(--tracking-blue)",
  "bg-(--tracking-border)",
];

const MARKS: readonly Item[] = [
  {
    key: "session",
    label: frGraph.marks.session,
    mark: (
      <span className={`${BOX} flex items-center justify-center border-(--tracking-brand)`}>
        <span className="size-1.5 rounded-full bg-(--tracking-brand)" />
      </span>
    ),
  },
  {
    key: "startable",
    label: frGraph.marks.startable,
    mark: <span className={`${BOX} border-(--tracking-green)`} />,
  },
  { key: "late", label: frGraph.marks.late, mark: <span className={`${BOX} border-(--tracking-red)`} /> },
  {
    key: "frame",
    label: frGraph.marks.frame,
    mark: <span className={`${BOX} border-(--tracking-border) border-dashed`} />,
  },
  {
    key: "segments",
    label: frGraph.marks.segments,
    mark: (
      <span className="flex w-7 shrink-0 gap-0.5">
        {SEGMENTS.map((bg) => (
          <span key={bg} className={`h-[5px] flex-1 rounded-[1px] ${bg}`} />
        ))}
      </span>
    ),
  },
];

const REVIEW_TONES: readonly PrReviewTone[] = ["draft", "waiting", "changes", "approved"];
const CHECKS = ["ok", "error", "running"] as const;

const PR_ITEMS: readonly Item[] = [
  ...REVIEW_TONES.map((tone) => {
    const Icon = tone === "draft" ? GitPullRequestDraft : GitPullRequest;
    return {
      key: tone,
      label: frPrs.review[tone],
      mark: <Icon size={15} absoluteStrokeWidth className={`shrink-0 ${PR_ICON_TONE[tone]}`} />,
    };
  }),
  ...CHECKS.map((check) => {
    const { Icon, color } = CI_MARK[check];
    return {
      key: `ci-${check}`,
      label: frPrs.ci[check],
      mark: <Icon size={15} absoluteStrokeWidth className={`shrink-0 ${color}`} />,
    };
  }),
  {
    key: "on",
    label: frGraph.prs.on,
    mark: <ChevronDown size={15} absoluteStrokeWidth className="shrink-0 text-(--tracking-dim)" />,
  },
  {
    key: "session",
    label: frGraph.marks.session,
    mark: (
      <span className={`${BOX} flex items-center justify-center border-(--tracking-brand)`}>
        <span className="size-1.5 rounded-full bg-(--tracking-brand)" />
      </span>
    ),
  },
  {
    key: "tap",
    label: frGraph.prs.tap,
    mark: <Hand size={15} absoluteStrokeWidth className="shrink-0 text-(--tracking-mfg)" />,
  },
];

const SECTION = "border-(--tracking-border) border-t px-4 pt-3 pb-2 first:border-t-0";
const SECTION_TITLE = "pb-2 font-semibold text-(--tracking-mfg) text-[14px]";

function Items({ title, items, wrap }: { title: string; items: readonly Item[]; wrap: boolean }) {
  return (
    <section aria-label={title} className={SECTION}>
      <h3 className={SECTION_TITLE}>{title}</h3>
      <ul className={wrap ? "flex flex-wrap gap-x-5" : "flex flex-col"}>
        {items.map((item) => (
          <li key={item.key} className="flex min-h-11 items-center gap-3 text-[15px]">
            <span aria-hidden className="flex w-7 shrink-0 justify-center">
              {item.mark}
            </span>
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

const CHIP = "flex h-11 items-center rounded-[22px] border px-5 font-medium text-[15px]";

function SprintChips({ lanes, filter, onFilter }: Pick<Props, "lanes" | "filter" | "onFilter">) {
  const chips = [
    { id: null, label: frGraph.sprint.all },
    ...lanes.map((l) => ({ id: l.id, label: l.code ?? fr.sprints.reserve })),
  ];
  return (
    <section aria-label={frGraph.sprint.title} className={SECTION}>
      <h3 className={SECTION_TITLE}>{frGraph.sprint.title}</h3>
      <div className="flex flex-wrap gap-2 pb-2">
        {chips.map((chip) => {
          const on = chip.id === filter;
          return (
            <button
              key={chip.id ?? "all"}
              type="button"
              aria-pressed={on}
              onClick={() => onFilter(chip.id)}
              className={`${CHIP} ${on ? "border-(--tracking-fg) bg-(--tracking-fg) text-(--tracking-bg)" : "border-(--tracking-border) text-(--tracking-fg)"}`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function LegendSheet({ view, lanes, filter, counter, onFilter, onClose }: Props) {
  if (view === "prs")
    return (
      <BottomSheet label={frGraph.legendPrs} onClose={onClose} done>
        <Items title={frGraph.legendPrs} items={PR_ITEMS} wrap={false} />
      </BottomSheet>
    );
  return (
    <BottomSheet label={frGraph.legend} onClose={onClose} done>
      <p className="px-4 pb-2 text-(--tracking-dim) text-[13px]">{counter}</p>
      <SprintChips lanes={lanes} filter={filter} onFilter={onFilter} />
      <Items title={frGraph.steps.title} items={STATUSES} wrap />
      <Items title={frGraph.marks.title} items={MARKS} wrap={false} />
    </BottomSheet>
  );
}
