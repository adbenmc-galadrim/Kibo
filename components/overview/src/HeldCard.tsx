import { cn } from "@kibo/sdk/lib/utils";
import { ChevronRight, Pause } from "lucide-react";
import { fr } from "./fr";
import { type HeldRow, heldCount } from "./held-model";
import { CardHeader, FLUSH_CARD, MONO_KEY, ROW_LINE } from "./parts";

function Row({ row, onOpen }: { row: HeldRow; onOpen(): void }) {
  return (
    <li className={ROW_LINE}>
      <button
        type="button"
        className="group flex h-[38px] w-full cursor-pointer items-center gap-[10px] px-[16px] text-left"
        onClick={onOpen}
      >
        <Pause absoluteStrokeWidth size={13} aria-hidden className="shrink-0 text-(--tracking-hold)" />
        <span className="min-w-0 flex-1 truncate font-medium text-(--tracking-fg) text-[13px] leading-[16px] group-hover:underline">
          {row.reason}
        </span>
        <span className={cn("shrink-0", MONO_KEY)}>{row.keys.join(", ")}</span>
        {row.dependents > 0 && (
          <span className="shrink-0 text-(--tracking-mfg) text-[12px] leading-[15px]">
            {fr.held.dependents(row.dependents)}
          </span>
        )}
        <ChevronRight absoluteStrokeWidth size={13} aria-hidden className="shrink-0 text-(--tracking-dim)" />
      </button>
    </li>
  );
}

export function HeldCard({ rows, onOpenPlanning }: { rows: readonly HeldRow[]; onOpenPlanning(): void }) {
  if (rows.length === 0) return null;
  return (
    <section aria-label={fr.held.title} className={FLUSH_CARD}>
      <CardHeader
        icon={Pause}
        title={fr.held.title}
        count={heldCount(rows)}
        aside={
          <span className="truncate text-(--tracking-mfg) text-[12.5px] leading-[15px]">
            {fr.held.subtitle}
          </span>
        }
      />
      <ul>
        {rows.map((row) => (
          <Row key={row.reason} row={row} onOpen={onOpenPlanning} />
        ))}
      </ul>
    </section>
  );
}
