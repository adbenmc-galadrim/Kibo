import type { SprintRecap } from "@kibo/schema";
import { ArrowRight, CalendarRange, X } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import { shortRange, trackingFr } from "./fr";

const t = trackingFr.recap;

type Props = { recap: SprintRecap; onOpenPlanning(): void; onClose(): void };

function Line({ dot, strong, children }: { dot: string; strong: string; children: ReactNode }) {
  return (
    <p className="flex items-center gap-[8px] text-[12.5px] leading-[16px]">
      <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", dot)} />
      <span className="shrink-0 font-semibold text-(--tracking-fg) text-[13px]">{strong}</span>
      <span className="truncate text-(--tracking-mfg)">{children}</span>
    </p>
  );
}

export function SprintRecapCard({ recap, onOpenPlanning, onClose }: Props) {
  const title = t.title(recap.code);
  return createPortal(
    <section
      aria-label={title}
      className="fixed right-[16px] bottom-[16px] z-50 flex w-[440px] flex-col gap-[10px] rounded-[10px] border border-(--tracking-border) bg-(--tracking-card) px-[16px] py-[14px] shadow-lg"
    >
      <header className="flex items-center gap-[8px]">
        <CalendarRange absoluteStrokeWidth size={15} aria-hidden className="text-(--tracking-mfg)" />
        <h2 className="font-semibold text-(--tracking-fg) text-[14px] leading-[17px]">{title}</h2>
        <span className="text-(--tracking-mfg) text-[12.5px]">{shortRange(recap.start, recap.end)}</span>
        <button
          type="button"
          aria-label={t.close}
          className="ml-auto cursor-pointer text-(--tracking-dim) hover:text-(--tracking-fg)"
          onClick={onClose}
        >
          <X absoluteStrokeWidth size={13} aria-hidden />
        </button>
      </header>
      {recap.delivered.length > 0 && (
        <Line dot="bg-(--tracking-green)" strong={t.delivered(recap.delivered.length)}>
          {recap.delivered.map((f) => `${f.label} ${f.title}`).join(", ")}
        </Line>
      )}
      <Line dot="bg-(--tracking-fg)" strong={t.merged(recap.mergedSteps)}>
        {t.planned(recap.plannedSteps, recap.capacity)}
      </Line>
      {recap.slipped.map((f) => (
        <Line
          key={f.label}
          dot="bg-(--tracking-amber)"
          strong={f.to === null ? t.stays(f.label) : t.slipsTo(f.label, f.to)}
        >
          {t.left(f.remaining)}
        </Line>
      ))}
      <footer className="flex items-center gap-[8px] border-(--tracking-soft) border-t pt-[10px]">
        {recap.next !== null && (
          <span className="truncate text-(--tracking-mfg) text-[12.5px]">
            {t.next(recap.next.code, shortRange(recap.next.start, recap.next.end), recap.next.plannedSteps)}
          </span>
        )}
        <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={onOpenPlanning}>
          {t.openPlanning}
          <ArrowRight absoluteStrokeWidth size={13} aria-hidden />
        </Button>
      </footer>
    </section>,
    document.body,
  );
}
