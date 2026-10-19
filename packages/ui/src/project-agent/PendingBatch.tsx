import { type Batch, type ProposedAction, undecidedActionIds } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { useState } from "react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import type { Decision } from "./BatchCard";
import { actionTitle, type DiffLabels } from "./batch-groups";

type Props = {
  batch: Batch;
  labels: DiffLabels;
  afterWakeup?: boolean;
  onDecide(d: Decision): Promise<void>;
};

const t = frProjectAgent.batch;
const BUTTON =
  "h-[25px] gap-[6px] rounded-[6px] px-[10px] py-[5px] text-[12px] leading-[15px] font-medium shadow-none";
const BRAND = `${BUTTON} bg-(--tracking-brand-btn) text-white hover:bg-(--tracking-brand-btn)/90`;
const OUTLINE = `${BUTTON} border-(--tracking-border) bg-transparent text-(--tracking-fg) hover:bg-(--tracking-hover)`;
const BOX =
  "mt-px size-4 rounded-[4px] border-(--tracking-border) data-[state=checked]:border-(--tracking-brand-btn) data-[state=checked]:bg-(--tracking-brand-btn) data-[state=checked]:text-white dark:data-[state=checked]:bg-(--tracking-brand-btn) [&_svg]:size-[11px]";

type RowProps = { action: ProposedAction; labels: DiffLabels; checked: boolean; onCheck(on: boolean): void };

function ActionRow({ action, labels, checked, onCheck }: RowProps) {
  const title = actionTitle(action, labels);
  return (
    <li className="flex items-start gap-[10px] px-[14px] py-[11px]">
      <Checkbox
        aria-label={title}
        checked={checked}
        onCheckedChange={(v) => onCheck(v === true)}
        className={BOX}
      />
      <div className="grid min-w-0 flex-1 gap-[3px]">
        <span className="text-[13px] leading-[16px] font-medium text-(--tracking-fg)">{title}</span>
        {action.why && <span className="text-[12px] leading-[15px] text-(--tracking-mfg)">{action.why}</span>}
      </div>
    </li>
  );
}

export function PendingBatch({ batch, labels, afterWakeup = false, onDecide }: Props) {
  const [checked, setChecked] = useState<ReadonlySet<number>>(() => new Set(batch.actions.map((a) => a.id)));
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const undecided = new Set(undecidedActionIds(batch));
  const shown = batch.actions.filter((a) => undecided.has(a.id)).sort((a, b) => a.id - b.id);
  const chosen = shown.map((a) => a.id).filter((id) => checked.has(id));

  const check = (id: number, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const decide = async (d: Decision) => {
    setBusy(true);
    setError(false);
    try {
      await onDecide(d);
    } catch (e) {
      console.error(e);
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label={t.region(batch.seq)}
      className="flex w-full flex-col overflow-hidden rounded-[10px] border border-(--tracking-brand-line) bg-(--tracking-card)"
    >
      <header className="flex items-center gap-[8px] bg-(--tracking-brand-soft) px-[14px] py-[10px] leading-[15px]">
        <h3 className="text-[13px] font-semibold text-(--tracking-brand-text)">{t.region(batch.seq)}</h3>
        <span className="ml-auto text-[12px] leading-[15px] text-(--tracking-mfg)">
          {afterWakeup ? `${t.count(shown.length)} · ${t.afterWakeup}` : t.count(shown.length)}
        </span>
      </header>
      <ul className="divide-y divide-(--tracking-soft) border-y border-(--tracking-soft)">
        {shown.map((action) => (
          <ActionRow
            key={action.id}
            action={action}
            labels={labels}
            checked={checked.has(action.id)}
            onCheck={(on) => check(action.id, on)}
          />
        ))}
      </ul>
      <footer className="flex items-center gap-[8px] px-[14px] pt-[12px] pb-[11px]">
        {rejecting ? (
          <>
            <Button
              variant="outline"
              className={OUTLINE}
              disabled={busy}
              onClick={() => void decide({ decision: "reject" })}
            >
              {t.rejectConfirm}
            </Button>
            <Button variant="ghost" className={OUTLINE} onClick={() => setRejecting(false)}>
              {t.rejectCancel}
            </Button>
          </>
        ) : (
          <>
            <Button
              className={BRAND}
              disabled={busy || chosen.length === 0}
              onClick={() => void decide({ decision: "apply", actionIds: chosen })}
            >
              {t.apply(chosen.length)}
            </Button>
            <Button variant="outline" className={OUTLINE} disabled={busy} onClick={() => setRejecting(true)}>
              {t.reject}
            </Button>
          </>
        )}
      </footer>
      {error && (
        <p role="alert" className="px-[14px] pb-[12px] text-[12px] text-destructive">
          {frProjectAgent.decideFailed}
        </p>
      )}
    </section>
  );
}
