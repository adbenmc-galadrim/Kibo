import { type Batch, isDecidable, undecidedActionIds } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { useId, useState } from "react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { BatchActionRow } from "./BatchActionRow";
import { type DiffLabels, groupActions, retiredActions } from "./batch-groups";
import { RetiredActionRow } from "./RetiredActionRow";

export type Decision = { decision: "apply"; actionIds: number[] } | { decision: "reject"; comment?: string };

type Props = {
  batch: Batch;
  labels: DiffLabels;
  afterWakeup: boolean;
  readOnly: boolean;
  onDecide(d: Decision): Promise<void>;
};

const t = frProjectAgent.batch;

function statusText(batch: Batch): string | null {
  if (batch.status === "pending") return null;
  if (batch.status === "partial" && batch.results.length === 0) return t.applying;
  return t.status(batch.status);
}

const BUTTON = "h-[25px] rounded-md px-2.5 text-xs font-medium";

type RejectProps = { busy: boolean; onCancel(): void; onConfirm(comment: string): void };

function RejectForm({ busy, onCancel, onConfirm }: RejectProps) {
  const id = useId();
  const [comment, setComment] = useState("");
  return (
    <div className="grid gap-2 border-t border-(--tracking-soft) px-3.5 py-3">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {t.comment}
      </label>
      <Textarea
        id={id}
        className="min-h-16 text-sm"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t.rejectCancel}
        </Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => onConfirm(comment.trim())}>
          {t.rejectConfirm}
        </Button>
      </div>
    </div>
  );
}

export function BatchCard({ batch, labels, afterWakeup, readOnly, onDecide }: Props) {
  const actions = groupActions(batch.actions).flatMap((group) => group.actions);
  const retired = retiredActions(batch.actions);
  const [checked, setChecked] = useState<ReadonlySet<number>>(() => new Set(actions.map((a) => a.id)));
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectable = isDecidable(batch) && !readOnly;
  const open = new Set(selectable ? undecidedActionIds(batch) : []);
  const status = statusText(batch);
  const chosen = actions.map((a) => a.id).filter((id) => open.has(id) && checked.has(id));

  const change = (id: number, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      on ? next.add(id) : next.delete(id);
      return next;
    });
  const decide = async (d: Decision) => {
    setBusy(true);
    setError(null);
    try {
      await onDecide(d);
    } catch (e) {
      console.error(e);
      setError(frProjectAgent.decideFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label={t.region(batch.seq)}
      className="overflow-hidden rounded-[10px] border border-(--tracking-brand-line) bg-(--tracking-card) text-(--tracking-fg)"
    >
      <header className="grid gap-1 bg-(--tracking-brand-soft) px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] leading-[1.2] font-semibold text-(--tracking-brand-text)">
            {t.region(batch.seq)}
          </h3>
          <span className="text-xs text-(--tracking-mfg)">
            {afterWakeup
              ? `${t.count(batch.actions.length)} · ${t.afterWakeup}`
              : t.count(batch.actions.length)}
          </span>
        </div>
        {status && <p className="text-xs font-medium text-(--tracking-mfg)">{status}</p>}
        {batch.status === "rejected" && batch.comment && (
          <p className="text-xs text-(--tracking-mfg)">{batch.comment}</p>
        )}
      </header>
      {(batch.status === "pending" || batch.results.length > 0) && (
        <ul className="divide-y divide-(--tracking-soft) border-t border-(--tracking-soft)">
          {actions.map((action) => (
            <BatchActionRow
              key={action.id}
              action={action}
              expected={batch.expected.find((e) => e.actionId === action.id)}
              labels={labels}
              selectable={open.has(action.id)}
              checked={checked.has(action.id)}
              result={batch.results.find((r) => r.actionId === action.id)}
              onCheck={(on) => change(action.id, on)}
            />
          ))}
          {retired.map((action) => (
            <RetiredActionRow key={action.id} result={batch.results.find((r) => r.actionId === action.id)} />
          ))}
        </ul>
      )}
      {selectable && rejecting && (
        <RejectForm
          busy={busy}
          onCancel={() => setRejecting(false)}
          onConfirm={(comment) =>
            void decide(comment ? { decision: "reject", comment } : { decision: "reject" })
          }
        />
      )}
      {selectable && !rejecting && (
        <div className="flex items-center gap-2 border-t border-(--tracking-soft) px-3.5 py-3">
          <Button
            className={cn(BUTTON, "bg-(--tracking-brand-btn) text-white hover:bg-(--tracking-brand-btn)/90")}
            disabled={busy || chosen.length === 0}
            onClick={() => void decide({ decision: "apply", actionIds: chosen })}
          >
            {t.apply(chosen.length)}
          </Button>
          <Button variant="outline" className={BUTTON} disabled={busy} onClick={() => setRejecting(true)}>
            {t.reject}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="px-3.5 pb-3 text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
