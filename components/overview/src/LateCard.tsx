import { cn } from "@kibo/sdk/lib/utils";
import { CalendarRange, ClockAlert } from "lucide-react";
import { fr } from "./fr";
import type { LateRow } from "./late-model";
import { CARD, CardHeader, MONO_KEY, Pill, ROW_LINE, Segments } from "./parts";

const SEGMENT = 12;

function Row({ row, onOpen }: { row: LateRow; onOpen(id: string): void }) {
  return (
    <li className={cn("flex h-[38px] items-center gap-[10px] px-[16px]", ROW_LINE)}>
      <span className={cn("w-[26px] shrink-0", MONO_KEY)}>{row.shortKey}</span>
      <button
        type="button"
        className="min-w-0 flex-1 cursor-pointer truncate text-left font-medium text-(--tracking-fg) text-[13px] leading-[16px] hover:underline"
        onClick={() => onOpen(row.id)}
      >
        {row.title}
      </button>
      <span className="flex shrink-0 items-center gap-[6px] text-(--tracking-mfg) text-[12px] leading-[15px]">
        <CalendarRange absoluteStrokeWidth size={12} aria-hidden />
        <span className="font-mono">{row.sprintCode}</span>
        <span className="whitespace-nowrap">{row.sprintNote}</span>
      </span>
      <Pill tone="red" icon={ClockAlert}>
        {row.remaining}
      </Pill>
      <span className="flex w-[84px] shrink-0 items-center">
        <Segments tones={row.tones} width={SEGMENT} />
      </span>
      <span className="w-[30px] shrink-0 text-right font-mono text-(--tracking-fg) text-[12.5px] leading-[15px]">
        {row.steps}
      </span>
    </li>
  );
}

export function LateCard({
  rows,
  onOpenTicket,
}: {
  rows: readonly LateRow[];
  onOpenTicket(id: string): void;
}) {
  if (rows.length === 0) return null;
  return (
    <section aria-label={fr.late.title} className={CARD}>
      <CardHeader
        icon={ClockAlert}
        alert
        title={fr.late.title}
        count={rows.length}
        aside={<span className="text-(--tracking-mfg) text-[12.5px] leading-[15px]">{fr.late.subtitle}</span>}
      />
      <ul>
        {rows.map((row) => (
          <Row key={row.id} row={row} onOpen={onOpenTicket} />
        ))}
      </ul>
    </section>
  );
}
