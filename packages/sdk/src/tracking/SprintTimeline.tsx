import type { DeadlineRow } from "@kibo/schema";
import { ClockAlert, Lock } from "lucide-react";
import { useState } from "react";
import { trackingFr as t } from "./fr";
import { type LegendEntry, LegendToggle } from "./LegendToggle";
import { CASE_BG, SLIPPED_CASE, StepCases } from "./StepCases";
import { TimelineHeader } from "./TimelineHeader";
import {
  type CaseTone,
  TIMELINE_GEOMETRY,
  type TimelineColumnInput,
  type TimelineGeometry,
  type TimelineInput,
  type TimelineLayout,
  type TimelineRow,
  timelineLayout,
} from "./timeline-model";

export type RowMark = { tone?: "risk" | "late"; note?: string };
export type MarkedRow = DeadlineRow & RowMark;
type Props = Omit<TimelineInput<TimelineColumnInput>, "rows" | "collapsed"> & {
  rows: MarkedRow[];
  collapsed?: { label: string; rows: MarkedRow[] };
  onOpen?(featureId: string): void;
  legend?: boolean;
  todayLabel?: string;
};
type Marks = ReadonlyMap<string, RowMark>;
type RowProps = {
  row: TimelineRow;
  mark: RowMark | undefined;
  last: boolean;
  width: number;
  onOpen?(featureId: string): void;
};

const MARK_TEXT: Record<NonNullable<RowMark["tone"]>, string> = {
  risk: "text-(--tracking-amber)",
  late: "text-(--tracking-red)",
};

const LABEL_X = 16;
const LEGEND: readonly Exclude<CaseTone, "hold">[] = ["done", "review", "progress", "blocked", "todo"];

function RowLabel({ row, mark, onOpen }: Pick<RowProps, "row" | "mark" | "onOpen">) {
  const tone = mark?.tone === undefined ? null : MARK_TEXT[mark.tone];
  const content = (
    <>
      <span className={`font-mono text-[12px] ${tone ?? "text-(--tracking-mfg)"}`}>{row.row.shortKey}</span>
      <span className="truncate text-[12.5px] text-(--tracking-fg)">{row.row.title}</span>
      {mark?.note && (
        <span className={`shrink-0 whitespace-nowrap text-[11px] ${tone ?? "text-(--tracking-dim)"}`}>
          {mark.note}
        </span>
      )}
    </>
  );
  const className = "absolute flex max-w-[226px] items-center gap-[8px] leading-[15px]";
  const style = { left: LABEL_X, top: row.y + 8 };
  if (!onOpen)
    return (
      <span className={className} style={style}>
        {content}
      </span>
    );
  return (
    <button
      type="button"
      className={`${className} cursor-pointer text-left hover:underline`}
      style={style}
      onClick={() => onOpen(row.row.featureId)}
    >
      {content}
    </button>
  );
}

function Row({ row, mark, last, width, onOpen }: RowProps) {
  return (
    <div data-feature={row.row.shortKey} data-mark={mark?.tone}>
      <RowLabel row={row} mark={mark} onOpen={onOpen} />
      <StepCases cases={row.cases} y={row.y} />
      {row.slip && (
        <span
          className="absolute flex items-center gap-[4px] whitespace-nowrap font-medium text-(--tracking-red) text-[12px] leading-[15px]"
          style={{ left: row.slip.x, top: row.y + 8 }}
        >
          <ClockAlert absoluteStrokeWidth size={12} aria-hidden />
          {t.slip(row.slip.code)}
        </span>
      )}
      {row.blocked && (
        <span
          className="absolute flex h-[19px] items-center gap-[5px] whitespace-nowrap rounded-[10px] bg-(--tracking-red-soft) px-[8px] font-medium text-(--tracking-red) text-[12px] leading-[15px]"
          style={{ left: row.blocked.x, top: row.y + 7 }}
        >
          <Lock absoluteStrokeWidth size={12} aria-hidden />
          {t.blocked(row.blocked.ref)}
        </span>
      )}
      {!last && (
        <span
          aria-hidden
          className="absolute h-px bg-(--tracking-soft)/60"
          style={{ left: LABEL_X, top: row.y + 30, width: width - LABEL_X }}
        />
      )}
    </div>
  );
}

const TODAY_ROOM = 22;

const TODAY_WIDTH = 90;
const CUSTOM_WIDTH = 140;
const MARK_WIDTH = 110;
const ROW_LABEL_WIDTH = 226;

type Span = readonly [number, number];

function labelSpan(todayX: number, label: string | undefined): Span {
  return label === undefined ? [todayX, todayX + 6 + TODAY_WIDTH] : [todayX - 6 - CUSTOM_WIDTH, todayX];
}

function lastRowSpans(layout: TimelineLayout): Span[] {
  const row = layout.rows.at(-1);
  if (row === undefined) return [];
  const marks = [row.slip, row.blocked].flatMap((m): Span[] => (m === null ? [] : [[m.x, m.x + MARK_WIDTH]]));
  return [
    [LABEL_X, LABEL_X + ROW_LABEL_WIDTH],
    ...row.cases.map((c): Span => [c.x, c.x + c.width]),
    ...marks,
  ];
}

function roomFor(layout: TimelineLayout, label?: string): number {
  if (layout.todayX === null) return 0;
  const [a, b] = labelSpan(layout.todayX, label);
  return lastRowSpans(layout).some(([x, y]) => x < b && y > a) ? TODAY_ROOM : 0;
}

function Today({ layout, label }: { layout: TimelineLayout; label: string | undefined }) {
  if (layout.todayX === null) return null;
  const room = roomFor(layout, label);
  const height = layout.height + room;
  const left = label === undefined ? layout.todayX + 6 : layout.todayX - 6;
  return (
    <>
      <span
        aria-hidden
        className="absolute w-[2px] bg-(--tracking-fg)"
        style={{ left: layout.todayX, top: 24, height: height - 24 }}
      />
      <span
        className="absolute whitespace-nowrap rounded-[4px] bg-primary px-[6px] py-px font-semibold text-[12px] text-primary-foreground leading-[15px]"
        style={{
          left,
          top: room === 0 ? layout.height - 24 : height - 20,
          ...(label === undefined ? {} : { transform: "translateX(-100%)" }),
        }}
      >
        {label ?? t.today}
      </span>
    </>
  );
}

function Grid({
  layout,
  g,
  onOpen,
  todayLabel,
  marks,
}: {
  layout: TimelineLayout;
  g: TimelineGeometry;
  onOpen?(id: string): void;
  todayLabel?: string | undefined;
  marks: Marks;
}) {
  return (
    <div
      className="relative shrink-0"
      style={{ width: layout.width, height: layout.height + roomFor(layout, todayLabel) }}
    >
      <TimelineHeader columns={layout.columns} height={layout.height + roomFor(layout, todayLabel)} g={g} />
      {layout.rows.map((row, i) => (
        <Row
          key={row.row.featureId}
          row={row}
          mark={marks.get(row.row.featureId)}
          last={i === layout.rows.length - 1}
          width={layout.width}
          onOpen={onOpen}
        />
      ))}
      <Today layout={layout} label={todayLabel} />
    </div>
  );
}

const swatch = (bg: string) => <span className={`h-[10px] w-[12px] rounded-[2px] ${bg}`} />;

const LEGEND_ENTRIES: readonly LegendEntry[] = [
  ...LEGEND.map((tone) => ({ key: tone, label: t.legend[tone], mark: swatch(CASE_BG[tone]) })),
  { key: "slipped", label: t.legend.slipped, mark: swatch(SLIPPED_CASE) },
];

function Legend() {
  return (
    <LegendToggle
      items={LEGEND_ENTRIES}
      className="h-[35px] border-(--tracking-soft) border-t bg-(--tracking-panel) px-[14px]"
    />
  );
}

export function SprintTimeline(props: Props) {
  const { columns, rows, today, collapsed, onOpen, legend = false, todayLabel } = props;
  const marks: Marks = new Map(
    [...rows, ...(collapsed?.rows ?? [])].map((r) => [r.featureId, { tone: r.tone, note: r.note }]),
  );
  const [open, setOpen] = useState(false);
  const g = TIMELINE_GEOMETRY;
  const layout = timelineLayout({ columns, rows, today }, g);
  const folded = { ...g, header: 0, bottom: 0 };
  const extra =
    collapsed && open ? timelineLayout({ columns, rows: collapsed.rows, today: null }, folded) : null;
  return (
    <section aria-label={t.timeline} className="flex min-w-0 flex-col">
      <div className="overflow-x-auto">
        <Grid layout={layout} g={g} onOpen={onOpen} todayLabel={todayLabel} marks={marks} />
        {collapsed && collapsed.rows.length > 0 && (
          <button
            type="button"
            aria-expanded={open}
            className="flex h-[30px] w-full items-center border-(--tracking-soft) border-t px-[16px] text-left text-(--tracking-mfg) text-[12px]"
            onClick={() => setOpen((v) => !v)}
          >
            {collapsed.label}
          </button>
        )}
        {extra && <Grid layout={extra} g={folded} onOpen={onOpen} marks={marks} />}
      </div>
      {legend && <Legend />}
    </section>
  );
}
