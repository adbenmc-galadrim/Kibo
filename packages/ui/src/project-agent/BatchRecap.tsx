import type { ActionOutcome, ActionResult, Batch, ProposedAction } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Check, CircleCheck, Minus, X } from "lucide-react";
import { formatClock } from "../agents/format";
import { frProjectAgent, type RecapOutcome } from "../i18n/fr-project-agent";
import { actionTitle, type DiffLabels } from "./batch-groups";

type Props = { batch: Batch; labels: DiffLabels; onClose(): void };

const t = frProjectAgent.recap;
const RECAP_OF: Record<ActionOutcome, RecapOutcome> = {
  applied: "applied",
  stale: "failed",
  failed: "failed",
  skipped: "skipped",
};
const TONE: Record<RecapOutcome, string> = {
  applied: "text-(--tracking-green)",
  failed: "text-(--tracking-red)",
  skipped: "text-(--tracking-mfg)",
};
const DOT: Record<RecapOutcome, string> = {
  applied: "bg-(--tracking-green)",
  failed: "bg-(--tracking-red)",
  skipped: "bg-(--tracking-mfg)",
};
const ICON = { applied: Check, failed: X, skipped: Minus } as const;
const ORDER: readonly RecapOutcome[] = ["applied", "failed", "skipped"];

function slipText(action: ProposedAction, labels: DiffLabels): string | null {
  if (action.type !== "setSprint" || !labels.feature) return null;
  const feature = labels.feature(action.ticket);
  return feature.sprint && feature.sprint !== action.sprint ? t.slipped(feature.label, feature.sprint) : null;
}

function noteOf(action: ProposedAction, result: ActionResult, labels: DiffLabels): string {
  const outcome = RECAP_OF[result.outcome];
  const extra = (outcome === "applied" ? slipText(action, labels) : null) ?? result.detail;
  return extra ? `${t.outcome(outcome)} · ${extra}` : t.outcome(outcome);
}

export function BatchRecap({ batch, labels, onClose }: Props) {
  const rows = batch.actions
    .flatMap((action) => {
      const result = batch.results.find((r) => r.actionId === action.id);
      return result ? [{ action, result, outcome: RECAP_OF[result.outcome] }] : [];
    })
    .sort((a, b) => a.action.id - b.action.id);
  const count = (o: RecapOutcome) => rows.filter((r) => r.outcome === o).length;
  const title = t.title(batch.seq);
  return (
    <section
      aria-label={title}
      className="flex w-full flex-col overflow-hidden rounded-[10px] border border-(--tracking-border) bg-(--tracking-card)"
    >
      <header className="flex items-center gap-[8px] bg-(--tracking-muted) px-[14px] py-[10px] leading-[15px]">
        <CircleCheck aria-hidden className="size-[15px] text-(--tracking-green)" />
        <h3 className="text-[13px] font-semibold text-(--tracking-fg)">{title}</h3>
        <span className="ml-auto text-[12px] text-(--tracking-mfg)">
          {formatClock(batch.decidedAt ?? batch.createdAt)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t.close}
          className="-mr-[4px] size-[20px] text-(--tracking-mfg) [&_svg:not([class*='size-'])]:size-[13px]"
          onClick={onClose}
        >
          <X />
        </Button>
      </header>
      <p className="flex items-center gap-[14px] border-y border-(--tracking-soft) px-[14px] py-[9px] text-[12px] text-(--tracking-mfg)">
        <span className="sr-only">{t.counts(count("applied"), count("failed"), count("skipped"))}</span>
        {ORDER.map((o) => (
          <span key={o} aria-hidden className="flex items-center gap-[6px]">
            <span className={cn("size-[6px] rounded-full", DOT[o])} />
            <b className="font-mono font-semibold text-(--tracking-fg)">{count(o)}</b>
            {t.word(o, count(o))}
          </span>
        ))}
      </p>
      <ul className="divide-y divide-(--tracking-soft)">
        {rows.map(({ action, result, outcome }) => {
          const Icon = ICON[outcome];
          return (
            <li key={action.id} className="flex items-start gap-[10px] px-[14px] py-[11px]">
              <Icon aria-hidden className={cn("mt-px size-[14px] shrink-0", TONE[outcome])} />
              <div className="grid min-w-0 flex-1 gap-[3px]">
                <span className="text-[13px] leading-[16px] font-medium text-(--tracking-fg)">
                  {actionTitle(action, labels)}
                </span>
                <span
                  className={cn(
                    "text-[12px] leading-[15px]",
                    outcome === "failed" ? TONE.failed : "text-(--tracking-mfg)",
                  )}
                >
                  {noteOf(action, result, labels)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
