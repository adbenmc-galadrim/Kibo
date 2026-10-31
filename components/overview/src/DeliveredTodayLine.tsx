import { useAutoAnimate } from "@kibo/sdk/ui/auto-animate";
import { CircleCheck } from "lucide-react";
import type { DeliveredToday } from "./delivered-today";
import { DeliverySegments } from "./delivery-segments";
import { fr } from "./fr";
import { clockTime } from "./overview-facts";
import { CARD, MONO_KEY } from "./parts";

const t = fr.delivered;

type Totals = { delivered: number; total: number };

function DeliveredTodayLine({
  row,
  totals,
  onOpen,
}: {
  row: DeliveredToday;
  totals: Totals;
  onOpen(id: string): void;
}) {
  return (
    <div className={CARD}>
      <button
        type="button"
        className="flex h-[42px] w-full cursor-pointer items-center gap-[10px] px-[16px] text-left hover:bg-(--tracking-hover)"
        onClick={() => onOpen(row.featureId)}
      >
        <CircleCheck absoluteStrokeWidth size={15} aria-hidden className="shrink-0 text-(--tracking-green)" />
        <span className="shrink-0 font-semibold text-(--tracking-fg) text-[13px]">{t.title}</span>
        <span className={MONO_KEY}>{row.label}</span>
        <span className="truncate font-semibold text-(--tracking-fg) text-[13px]">{row.title}</span>
        <DeliverySegments steps={row.steps} />
        <span className="shrink-0 text-(--tracking-mfg) text-[12.5px]">
          {t.steps(row.steps)} · {t.merged(row.prNumber, clockTime(row.lastMergeAt))}
        </span>
        <span className="ml-auto shrink-0 text-(--tracking-mfg) text-[12.5px]">
          {t.total(totals.delivered, totals.total)}
        </span>
      </button>
    </div>
  );
}

type Props = { rows: readonly DeliveredToday[]; features: Totals; onOpen(id: string): void };

export function DeliveredTodayLines({ rows, features, onOpen }: Props) {
  const [list] = useAutoAnimate<HTMLElement>();
  if (rows.length === 0) return null;
  return (
    <section ref={list} aria-label={t.title} className="flex flex-col gap-[14px]">
      {rows.map((row) => (
        <DeliveredTodayLine key={row.featureId} row={row} totals={features} onOpen={onOpen} />
      ))}
    </section>
  );
}
