import type { OverviewIndicators } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import {
  CalendarRange,
  GitPullRequest,
  type LucideIcon,
  MessageCircleQuestion,
  Package,
  Target,
} from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "./fr";
import { type IndicatorText, indicatorTexts } from "./indicator-texts";

const CELL_BG = {
  delivered: "bg-(--tracking-green)",
  open: "bg-(--tracking-blue)",
  todo: "bg-(--tracking-border)",
};
const DOT_BG = { amber: "bg-(--tracking-amber)", red: "bg-(--tracking-red)" };

type BoxProps = {
  icon: LucideIcon;
  label: string;
  text: Pick<IndicatorText, "value" | "unit">;
  children?: ReactNode;
};

function Box({ icon: Icon, label, text, children }: BoxProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[5px] border-(--tracking-soft) border-l px-[18px] py-[12px] first:border-l-0">
      <span className="flex h-[15px] items-center gap-[6px] font-medium text-(--tracking-mfg) text-[12.5px]">
        <Icon absoluteStrokeWidth size={14} aria-hidden />
        {label}
      </span>
      <span className="flex h-[28px] items-end gap-[6px]">
        <span className="font-semibold text-(--tracking-fg) text-[28px] leading-[28px] tracking-[-0.5px]">
          {text.value}
        </span>
        <span className="whitespace-nowrap text-(--tracking-mfg) text-[13px] leading-[16px]">
          {text.unit}
        </span>
      </span>
      <span className="flex h-[16px] min-w-0 items-center gap-[6px] text-(--tracking-mfg) text-[12px] leading-[15px]">
        {children}
      </span>
    </div>
  );
}

function Sub({ text }: { text: IndicatorText }) {
  return (
    <>
      {text.dot && <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", DOT_BG[text.dot])} />}
      <span className="truncate">{text.sub}</span>
    </>
  );
}

export function Indicators({ indicators }: { indicators: OverviewIndicators }) {
  const t = indicatorTexts(indicators);
  return (
    <section
      aria-label={fr.indicators.label}
      className="flex h-[92px] w-full shrink-0 rounded-[10px] border border-(--tracking-border) bg-(--tracking-card)"
    >
      <Box icon={Package} label={fr.indicators.features} text={t.features}>
        <span className="flex items-center gap-[3px]">
          {t.features.cells.map((cell, i) => (
            <span
              key={`${i}${cell}`}
              data-cell={cell}
              className={cn("h-[6px] w-[14px] rounded-[1.5px]", CELL_BG[cell])}
            />
          ))}
        </span>
      </Box>
      <Box icon={CalendarRange} label={fr.indicators.sprint} text={t.sprint}>
        <Sub text={t.sprint} />
      </Box>
      <Box icon={Target} label={fr.indicators.open} text={t.open}>
        <Sub text={t.open} />
      </Box>
      <Box icon={GitPullRequest} label={fr.indicators.review} text={t.review}>
        <Sub text={t.review} />
      </Box>
      <Box icon={MessageCircleQuestion} label={fr.indicators.questions} text={t.questions}>
        <Sub text={t.questions} />
      </Box>
    </section>
  );
}
