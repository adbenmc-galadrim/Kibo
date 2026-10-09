import { type Batch, isDecidable } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { useId, useState } from "react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { BatchActionRow } from "./BatchActionRow";
import { type BatchGroup, groupActions, type StatusLabel } from "./batch-groups";

export type Decision = { decision: "apply"; actionIds: number[] } | { decision: "reject"; comment?: string };

type Props = {
  batch: Batch;
  statusLabel: StatusLabel;
  readOnly: boolean;
  onDecide(d: Decision): Promise<void>;
};

const t = frProjectAgent.batch;

function statusText(batch: Batch): string | null {
  if (batch.status === "pending") return null;
  if (batch.status === "partial" && batch.results.length === 0) return t.applying;
  return t.status(batch.status);
}

type GroupProps = {
  group: BatchGroup;
  batch: Batch;
  statusLabel: StatusLabel;
  selectable: boolean;
  checked: ReadonlySet<number>;
  onChange(ids: number[], on: boolean): void;
};

function Group({ group, batch, statusLabel, selectable, checked, onChange }: GroupProps) {
  const ids = group.actions.map((a) => a.id);
  const all = ids.every((id) => checked.has(id));
  const name = t.group(group.group);
  return (
    <fieldset aria-label={name} className="grid gap-0.5">
      <div className="flex items-center justify-between gap-2">
        <legend className="text-xs font-medium text-muted-foreground uppercase">{name}</legend>
        {selectable && (
          <Button variant="link" size="sm" className="h-6 px-0 text-xs" onClick={() => onChange(ids, !all)}>
            {all ? t.uncheckAll : t.checkAll}
          </Button>
        )}
      </div>
      <ul className="divide-y">
        {group.actions.map((action) => (
          <BatchActionRow
            key={action.id}
            action={action}
            expected={batch.expected.find((e) => e.actionId === action.id)}
            statusLabel={statusLabel}
            selectable={selectable}
            checked={checked.has(action.id)}
            result={batch.results.find((r) => r.actionId === action.id)}
            onCheck={(on) => onChange([action.id], on)}
          />
        ))}
      </ul>
    </fieldset>
  );
}

type RejectProps = { busy: boolean; onCancel(): void; onConfirm(comment: string): void };

function RejectForm({ busy, onCancel, onConfirm }: RejectProps) {
  const id = useId();
  const [comment, setComment] = useState("");
  return (
    <div className="grid gap-2">
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

export function BatchCard({ batch, statusLabel, readOnly, onDecide }: Props) {
  const [checked, setChecked] = useState<ReadonlySet<number>>(() => new Set(batch.actions.map((a) => a.id)));
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectable = isDecidable(batch) && !readOnly;
  const status = statusText(batch);
  const groups = groupActions(batch.actions);
  const chosen = batch.actions.map((a) => a.id).filter((id) => checked.has(id));

  const change = (ids: number[], on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      for (const id of ids) on ? next.add(id) : next.delete(id);
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
      className="grid gap-3 rounded-lg border border-brand/40 bg-card p-3 text-card-foreground"
    >
      <header className="grid gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t.region(batch.seq)}</h3>
          <span className="text-xs text-muted-foreground">{t.count(batch.actions.length)}</span>
        </div>
        <p className="text-sm">{batch.summary}</p>
        {status && <p className="text-xs font-medium text-muted-foreground">{status}</p>}
        {batch.status === "rejected" && batch.comment && (
          <p className="text-xs text-muted-foreground">{batch.comment}</p>
        )}
      </header>
      {(batch.status === "pending" || batch.results.length > 0) &&
        groups.map((group) => (
          <Group
            key={group.group}
            group={group}
            batch={batch}
            statusLabel={statusLabel}
            selectable={selectable}
            checked={checked}
            onChange={change}
          />
        ))}
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
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setRejecting(true)}>
            {t.reject}
          </Button>
          <Button
            size="sm"
            className="bg-brand-strong text-white hover:bg-brand-strong/90"
            disabled={busy || chosen.length === 0}
            onClick={() => void decide({ decision: "apply", actionIds: chosen })}
          >
            {t.apply(chosen.length)}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
