import { cn } from "@kibo/sdk/lib/utils";
import { CASE_BG, type CaseTone } from "@kibo/sdk/tracking";
import { type LucideIcon, Package } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "./fr";

export const CARD =
  "flex w-full flex-col overflow-hidden rounded-[10px] border border-(--tracking-border) bg-(--tracking-card)";
export const FLUSH_CARD = `${CARD} [&>:last-child]:-mb-px`;
export const ROW_LINE = "border-(--tracking-soft) border-t";
export const MONO_KEY = "font-mono text-[12px] leading-[15px] text-(--tracking-mfg)";

type HeaderProps = {
  icon: LucideIcon;
  title: ReactNode;
  aside?: ReactNode;
  count?: ReactNode;
  alert?: boolean;
  onTitle?(): void;
};

export function CardHeader({ icon: Icon, title, aside, count, alert, onTitle }: HeaderProps) {
  const heading = "font-semibold text-(--tracking-fg) text-[14px] leading-[17px]";
  return (
    <div className="flex h-[43px] shrink-0 items-center gap-[8px] px-[16px]">
      <Icon
        absoluteStrokeWidth
        size={15}
        aria-hidden
        className={alert ? "text-(--tracking-red)" : "text-(--tracking-mfg)"}
      />
      {onTitle ? (
        <button type="button" className={cn(heading, "cursor-pointer hover:underline")} onClick={onTitle}>
          {title}
        </button>
      ) : (
        <h2 className={heading}>{title}</h2>
      )}
      {count !== undefined && (
        <span
          className={cn(
            "flex h-[15px] items-center rounded-[9px] px-[7px] font-medium font-mono text-[12px]",
            alert
              ? "bg-(--tracking-red-soft) text-(--tracking-red)"
              : "bg-(--tracking-muted) text-(--tracking-mfg)",
          )}
        >
          {count}
        </span>
      )}
      {aside && <div className="ml-auto flex items-center gap-[8px]">{aside}</div>}
    </div>
  );
}

export function FeatureChip({ shortKey, onOpen }: { shortKey: string; onOpen?(): void }) {
  const className =
    "inline-flex h-[17px] shrink-0 items-center gap-[4px] rounded-[4px] border border-(--tracking-border) px-[6px] font-medium font-mono text-(--tracking-mfg) text-[12px] leading-[15px]";
  const content = (
    <>
      <Package absoluteStrokeWidth size={12} aria-hidden />
      {shortKey}
    </>
  );
  if (!onOpen) return <span className={className}>{content}</span>;
  return (
    <button
      type="button"
      aria-label={fr.featureChip(shortKey)}
      className={cn(className, "cursor-pointer")}
      onClick={onOpen}
    >
      {content}
    </button>
  );
}

type SegmentsProps = { tones: readonly CaseTone[]; width: number; height?: number };

export function Segments({ tones, width, height = 8 }: SegmentsProps) {
  return (
    <span data-slot="segments" className="flex shrink-0 items-center gap-[3px]">
      {tones.map((tone, i) => (
        <span
          key={`${i}${tone}`}
          data-tone={tone}
          className={cn("rounded-[1.5px]", CASE_BG[tone])}
          style={{ width, height }}
        />
      ))}
    </span>
  );
}

const PILL_TONES = {
  green: "bg-(--tracking-green-soft) text-(--tracking-green)",
  blue: "bg-(--tracking-blue-soft) text-(--tracking-blue)",
  red: "bg-(--tracking-red-soft) text-(--tracking-red)",
  amber: "bg-(--tracking-amber-soft) text-(--tracking-amber)",
  muted: "bg-(--tracking-muted) text-(--tracking-mfg)",
};
export type PillTone = keyof typeof PILL_TONES;

export function Pill({
  tone,
  icon: Icon,
  children,
}: {
  tone: PillTone;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[19px] shrink-0 items-center gap-[5px] rounded-[10px] px-[8px] font-medium text-[12px] leading-[15px]",
        PILL_TONES[tone],
      )}
    >
      {Icon && <Icon absoluteStrokeWidth size={12} aria-hidden />}
      {children}
    </span>
  );
}

export function GithubMark({ size = 13, className }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={48 / size}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}
