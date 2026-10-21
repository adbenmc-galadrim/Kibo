import type { FeatureStatus } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import {
  CalendarRange,
  CircleCheck,
  ClockAlert,
  Lock,
  type LucideIcon,
  Pause,
  Target,
  TriangleAlert,
} from "lucide-react";
import { fr } from "./fr";
import { CARD, CardHeader, FLUSH_CARD, MONO_KEY, Pill, type PillTone, ROW_LINE, Segments } from "./parts";
import type { SprintCard, SprintRow } from "./sprint-model";

const STATE_PILL: Record<FeatureStatus, { tone: PillTone; icon?: LucideIcon }> = {
  delivered: { tone: "green", icon: CircleCheck },
  open: { tone: "blue" },
  late: { tone: "red", icon: ClockAlert },
  blocked: { tone: "red", icon: Lock },
  todo: { tone: "muted" },
};

export function StatePill({ state, risk = false }: { state: FeatureStatus; risk?: boolean }) {
  if (risk)
    return (
      <Pill tone="amber" icon={TriangleAlert}>
        {fr.sprint.risk}
      </Pill>
    );
  const pill = STATE_PILL[state];
  return (
    <Pill tone={pill.tone} icon={pill.icon}>
      {fr.sprint.state[state]}
    </Pill>
  );
}

function HeldMark({ count }: { count: number }) {
  return (
    <span
      role="img"
      aria-label={fr.held.steps(count)}
      className="flex shrink-0 items-center gap-[3px] pl-[6px] font-mono text-(--tracking-hold) text-[11.5px] leading-[14px]"
    >
      <Pause absoluteStrokeWidth size={11} aria-hidden />
      {count}
    </span>
  );
}

function FeatureRow({ row, onOpen }: { row: SprintRow; onOpen(id: string): void }) {
  const muted = row.state === "delivered" && row.held === 0;
  return (
    <li
      data-risk={row.risk || undefined}
      className={cn("flex h-[39px] items-center gap-[10px] px-[16px]", ROW_LINE)}
    >
      <span className={cn("w-[26px] shrink-0", MONO_KEY)}>{row.shortKey}</span>
      <span className="flex w-[214px] shrink-0 items-center">
        <button
          type="button"
          className={cn(
            "min-w-0 cursor-pointer truncate text-left font-medium text-[13px] leading-[16px] hover:underline",
            muted ? "text-(--tracking-mfg)" : "text-(--tracking-fg)",
          )}
          onClick={() => onOpen(row.id)}
        >
          {row.title}
        </button>
        {row.held > 0 && <HeldMark count={row.held} />}
      </span>
      <span className="flex w-[86px] shrink-0 items-center">
        <StatePill state={row.state} risk={row.risk} />
      </span>
      <span className="flex w-[66px] shrink-0 items-center">
        <Segments tones={row.tones} width={10} />
      </span>
      {row.slipped !== null && (
        <span className="truncate text-(--tracking-mfg) text-[12px] leading-[15px]">
          {fr.sprint.slipped(row.slipped)}
        </span>
      )}
      <span
        className={cn(
          "ml-auto font-mono text-[12.5px] leading-[15px]",
          muted ? "text-(--tracking-mfg)" : "text-(--tracking-fg)",
        )}
      >
        {row.steps}
      </span>
    </li>
  );
}

type Props = { card: SprintCard | null; onOpenTicket(id: string): void; onOpenSprint(id: string): void };

export function CurrentSprintCard({ card, onOpenTicket, onOpenSprint }: Props) {
  if (card === null)
    return (
      <section aria-label={fr.indicators.sprint} className={CARD}>
        <p className="px-[16px] py-[12px] text-(--tracking-mfg) text-[12.5px]">{fr.sprint.none}</p>
      </section>
    );
  return (
    <section aria-label={card.title} className={FLUSH_CARD}>
      <CardHeader
        icon={CalendarRange}
        title={card.title}
        onTitle={() => onOpenSprint(card.sprint.id)}
        aside={
          <>
            <span className="text-(--tracking-mfg) text-[12.5px] leading-[15px]">{card.dates}</span>
            {card.ahead !== null && <Pill tone="amber">{card.ahead}</Pill>}
          </>
        }
      />
      <ul>
        {card.rows.map((row) => (
          <FeatureRow key={row.id} row={row} onOpen={onOpenTicket} />
        ))}
      </ul>
      {card.note !== null && (
        <p
          className={cn(
            "flex h-[36px] items-center gap-[8px] bg-(--tracking-panel) px-[16px] text-(--tracking-mfg) text-[12px] leading-[15px]",
            ROW_LINE,
          )}
        >
          <Target absoluteStrokeWidth size={13} aria-hidden className="shrink-0" />
          {card.note}
        </p>
      )}
    </section>
  );
}
