import { ClockAlert, Lock } from "lucide-react";
import { useState } from "react";
import { trackingFr as t } from "./fr";
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

type Props = TimelineInput<TimelineColumnInput> & {
  onOpen?(featureId: string): void;
  legend?: boolean;
  todayLabel?: string;
};
type RowProps = { row: TimelineRow; last: boolean; width: number; onOpen?(featureId: string): void };

const LABEL_X = 16;
const LEGEND: readonly CaseTone[] = ["done", "review", "progress", "blocked", "todo"];

function RowLabel({ row, onOpen }: Pick<RowProps, "row" | "onOpen">) {
  const content = (
    <>
      <span className="font-mono text-[12px] text-(--tracking-mfg)">{row.row.shortKey}</span>
      <span className="truncate text-[12.5px] text-(--tracking-fg)">{row.row.title}</span>
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

function Row({ row, last, width, onOpen }: RowProps) {
  return (
    <div data-feature={row.row.shortKey}>
      <RowLabel row={row} onOpen={onOpen} />
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

const roomFor = (layout: TimelineLayout): number => (layout.todayX === null ? 0 : TODAY_ROOM);

function Today({ layout, label }: { layout: TimelineLayout; label: string | undefined }) {
  if (layout.todayX === null) return null;
  const height = layout.height + TODAY_ROOM;
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
          top: height - 20,
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
}: {
  layout: TimelineLayout;
  g: TimelineGeometry;
  onOpen?(id: string): void;
  todayLabel?: string | undefined;
}) {
  return (
    <div
      className="relative shrink-0"
      style={{ width: layout.width, height: layout.height + roomFor(layout) }}
    >
      <TimelineHeader columns={layout.columns} height={layout.height + roomFor(layout)} g={g} />
      {layout.rows.map((row, i) => (
        <Row
          key={row.row.featureId}
          row={row}
          last={i === layout.rows.length - 1}
          width={layout.width}
          onOpen={onOpen}
        />
      ))}
      <Today layout={layout} label={todayLabel} />
    </div>
  );
}

function Legend() {
  const item = "flex items-center gap-[6px] text-[12px] leading-[15px] text-(--tracking-mfg)";
  return (
    <div className="flex h-[35px] items-center gap-[16px] border-(--tracking-soft) border-t bg-(--tracking-panel) px-[16px]">
      {LEGEND.map((tone) => (
        <span key={tone} className={item}>
          <span aria-hidden className={`h-[10px] w-[12px] rounded-[2px] ${CASE_BG[tone]}`} />
          {t.legend[tone]}
        </span>
      ))}
      <span className={item}>
        <span aria-hidden className={`h-[10px] w-[12px] rounded-[2px] ${SLIPPED_CASE}`} />
        {t.legend.slipped}
      </span>
    </div>
  );
}

export function SprintTimeline(props: Props) {
  const { columns, rows, today, collapsed, onOpen, legend = false, todayLabel } = props;
  const [open, setOpen] = useState(false);
  const g = TIMELINE_GEOMETRY;
  const layout = timelineLayout({ columns, rows, today }, g);
  const folded = { ...g, header: 0, bottom: 0 };
  const extra =
    collapsed && open ? timelineLayout({ columns, rows: collapsed.rows, today: null }, folded) : null;
  return (
    <section aria-label={t.timeline} className="flex min-w-0 flex-col">
      <div className="overflow-x-auto">
        <Grid layout={layout} g={g} onOpen={onOpen} todayLabel={todayLabel} />
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
        {extra && <Grid layout={extra} g={folded} onOpen={onOpen} />}
      </div>
      {legend && <Legend />}
    </section>
  );
}
