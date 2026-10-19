import { cn } from "@kibo/sdk/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@kibo/sdk/ui/tooltip";
import {
  CalendarRange,
  ClockAlert,
  GitPullRequest,
  type LucideIcon,
  MessageCircleQuestion,
  Package,
  Pause,
  Target,
} from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "./fr";
import {
  featureCellGap,
  type IndicatorFacts,
  type IndicatorText,
  type IndicatorTexts,
  indicatorTexts,
} from "./indicator-texts";

const CELL_BG = {
  delivered: "bg-(--tracking-green)",
  open: "bg-(--tracking-blue)",
  todo: "bg-(--tracking-border)",
};
const DOT_BG = { amber: "bg-(--tracking-amber)", red: "bg-(--tracking-red)" };

type BoxProps = {
  icon: LucideIcon;
  label: string;
  hint?: string;
  text: Pick<IndicatorText, "value" | "unit">;
  children?: ReactNode;
};

const LABEL = "flex h-[15px] items-center gap-[6px] font-medium text-(--tracking-mfg) text-[12.5px]";

function BoxLabel({ icon: Icon, label, hint }: Pick<BoxProps, "icon" | "label" | "hint">) {
  const content = (
    <>
      <Icon absoluteStrokeWidth size={14} aria-hidden />
      {label}
    </>
  );
  if (hint === undefined) return <span className={LABEL}>{content}</span>;
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-description={hint} className={cn(LABEL, "w-fit cursor-help")}>
            {content}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4} className="max-w-[260px] rounded-[6px] text-[12px]">
          {hint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Box({ icon, label, hint, text, children }: BoxProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[5px] border-(--tracking-soft) border-l px-[18px] py-[12px] first:border-l-0">
      <BoxLabel icon={icon} label={label} hint={hint} />
      <span className="flex h-[28px] min-w-0 items-end gap-[6px]">
        <span className="shrink-0 font-semibold text-(--tracking-fg) text-[28px] leading-[28px] tracking-[-0.5px]">
          {text.value}
        </span>
        <span title={text.unit} className="min-w-0 truncate text-(--tracking-mfg) text-[13px] leading-[16px]">
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
      <span title={text.sub} className="truncate">
        {text.sub}
      </span>
    </>
  );
}

function FeatureCells({ cells }: { cells: IndicatorTexts["features"]["cells"] }) {
  return (
    <span
      className="flex min-w-0 flex-1 items-center overflow-hidden"
      style={{ columnGap: `${featureCellGap(cells.length)}px` }}
    >
      {cells.map((cell, i) => (
        <span
          key={`${i}${cell}`}
          data-cell={cell}
          className={cn("h-[6px] w-[14px] min-w-[4px] shrink rounded-[1.5px]", CELL_BG[cell])}
        />
      ))}
    </span>
  );
}

function HeldSub({ text, onOpen }: { text: string; onOpen(): void }) {
  return (
    <button
      type="button"
      className="flex min-w-0 shrink-0 cursor-pointer items-center gap-[6px] font-medium hover:underline"
      onClick={onOpen}
    >
      <Pause absoluteStrokeWidth size={12} aria-hidden className="shrink-0" />
      <span className="truncate">{text}</span>
    </button>
  );
}

type FeatureSubProps = { text: IndicatorTexts["features"]; onOpenHeld(): void };

function FeatureSub({ text, onOpenHeld }: FeatureSubProps) {
  if (text.held !== undefined)
    return (
      <>
        {text.sub !== undefined && <AlertSub text={text.sub} />}
        <HeldSub text={text.held} onOpen={onOpenHeld} />
      </>
    );
  if (text.sub === undefined) return <FeatureCells cells={text.cells} />;
  if (text.tone === undefined) return <span className="truncate">{text.sub}</span>;
  if (text.tone === "amber")
    return (
      <>
        <FeatureCells cells={text.cells} />
        <span className="shrink-0 whitespace-nowrap text-(--tracking-amber)">{text.sub}</span>
      </>
    );
  return <AlertSub text={text.sub} />;
}

function AlertSub({ text }: { text: string }) {
  return (
    <span className="flex min-w-0 items-center gap-[6px] text-(--tracking-red)">
      <ClockAlert absoluteStrokeWidth size={12} aria-hidden className="shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  );
}

type Props = { indicators: IndicatorFacts; onOpenHeld(): void };

export function Indicators({ indicators, onOpenHeld }: Props) {
  const t = indicatorTexts(indicators);
  return (
    <section
      aria-label={fr.indicators.label}
      className="flex h-[92px] w-full shrink-0 rounded-[10px] border border-(--tracking-border) bg-(--tracking-card)"
    >
      <Box icon={Package} label={fr.indicators.features} text={t.features}>
        <FeatureSub text={t.features} onOpenHeld={onOpenHeld} />
      </Box>
      <Box icon={CalendarRange} label={fr.indicators.sprint} text={t.sprint}>
        <Sub text={t.sprint} />
      </Box>
      <Box icon={Target} label={fr.indicators.open} hint={fr.indicators.openHint} text={t.open}>
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
