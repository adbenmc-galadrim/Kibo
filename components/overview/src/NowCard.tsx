import { cn } from "@kibo/sdk/lib/utils";
import { fr } from "./fr";
import type { NowRow, Segment } from "./overview-model";
import { FeatureChip, MONO_KEY } from "./parts";

const SEGMENT_BG: Record<Segment, string> = {
  done: "bg-(--tracking-mfg)",
  current: "bg-(--tracking-brand)",
  todo: "bg-(--tracking-border)",
};

type Props = { rows: readonly NowRow[]; onOpenTicket(id: string): void };

function SessionRow({ row, onOpenTicket }: { row: NowRow; onOpenTicket(id: string): void }) {
  return (
    <li className="flex h-[36px] items-center gap-[12px] border-(--tracking-brand-line) border-t first:border-t-0">
      <span className="flex w-[44px] shrink-0 items-center">
        {row.feature !== null && (
          <FeatureChip
            shortKey={row.feature}
            onOpen={row.featureId === null ? undefined : () => onOpenTicket(row.featureId ?? "")}
          />
        )}
      </span>
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-[8px] text-left"
        onClick={() => onOpenTicket(row.ticketId)}
      >
        <span className={MONO_KEY}>{row.key}</span>
        <span className="truncate font-medium text-(--tracking-fg) text-[13px] leading-[16px]">
          {row.title}
        </span>
      </button>
      <span className="flex w-[210px] shrink-0 items-center gap-[10px]">
        <span data-slot="delivery-bar" className="flex items-center gap-[2px]">
          {row.segments.map((s, i) => (
            <span
              key={`${i}${s}`}
              data-segment={s}
              className={cn("h-[12px] w-[5px] rounded-[1px]", SEGMENT_BG[s])}
            />
          ))}
        </span>
        {row.step !== null && (
          <span className="truncate text-(--tracking-fg) text-[12.5px] leading-[15px]">{row.step}</span>
        )}
      </span>
      <span className="w-[70px] shrink-0 text-right text-(--tracking-mfg) text-[12px] leading-[15px]">
        {row.duration}
      </span>
    </li>
  );
}

export function NowCard({ rows, onOpenTicket }: Props) {
  return (
    <section
      aria-label={fr.now.title}
      className="flex min-h-[86px] w-full shrink-0 rounded-[10px] border border-(--tracking-brand-line) bg-(--tracking-brand-soft)"
    >
      <div className="flex w-[150px] shrink-0 flex-col justify-center gap-[4px] border-(--tracking-brand-line) border-r px-[16px]">
        <span className="flex items-center gap-[8px]">
          <span
            aria-hidden
            className="flex size-[13px] items-center justify-center rounded-[6.5px] bg-(--tracking-brand)/22"
          >
            <span className="size-[7px] rounded-full bg-(--tracking-brand)" />
          </span>
          <span className="font-semibold text-(--tracking-brand-text) text-[13px] leading-[16px]">
            {fr.now.title}
          </span>
        </span>
        <span className="text-(--tracking-mfg) text-[12px] leading-[15px]">
          {fr.now.sessions(rows.length)}
        </span>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col px-[16px] py-[6px]">
        {rows.map((row) => (
          <SessionRow key={row.ticketId} row={row} onOpenTicket={onOpenTicket} />
        ))}
      </ul>
    </section>
  );
}
