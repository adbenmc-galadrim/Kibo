import type { DeliveryItem } from "@kibo/schema";
import { useState } from "react";
import { deliveryTexts } from "./fr-delivery";
import { cn } from "./lib/utils";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

const t = deliveryTexts.children;

export type DeliverChildrenProps = {
  parent: { keyLabel: string; title: string };
  items: readonly DeliveryItem[];
  onDeliver(ticketId: string): Promise<unknown>;
  describeError(error: unknown): string;
  onClose(): void;
};

export function deliveryItemState(item: DeliveryItem): string {
  if (item.ready || item.reason === null) return t.states.ready;
  if (item.reason === "blocked") return t.states.blocked(item.blockedBy);
  return t.states[item.reason];
}

const stateTone = (item: DeliveryItem): string => {
  if (item.ready) return "text-emerald-600 dark:text-emerald-400";
  return item.reason === "blocked" ? "text-red-600 dark:text-red-400" : "text-muted-foreground";
};

function ItemRow({
  item,
  checked,
  onChecked,
}: {
  item: DeliveryItem;
  checked: boolean;
  onChecked(checked: boolean): void;
}) {
  const id = `deliver-${item.ticketId}`;
  return (
    <li data-key={item.key} className="flex items-start gap-2.5 py-2">
      <Checkbox
        id={id}
        className="mt-0.5"
        checked={checked}
        disabled={!item.ready}
        aria-label={`${item.key} ${item.title}`}
        onCheckedChange={(value) => onChecked(value === true)}
      />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <label htmlFor={id} className="flex min-w-0 items-baseline gap-2 text-sm">
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{item.key}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
          <span
            data-delivery-state=""
            className={cn("flex shrink-0 items-center gap-1 text-xs", stateTone(item))}
          >
            {deliveryItemState(item)}
          </span>
        </label>
        {item.blockedBy.length > 0 && (
          <span className="text-2xs text-muted-foreground">{t.after(item.blockedBy)}</span>
        )}
      </span>
    </li>
  );
}

export function DeliverChildren({ parent, items, onDeliver, describeError, onClose }: DeliverChildrenProps) {
  const [checked, setChecked] = useState(() => new Set(items.filter((i) => i.ready).map((i) => i.ticketId)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = items.filter((i) => checked.has(i.ticketId));
  const first = items[0];
  const nothing = !items.some((i) => i.ready) && first !== undefined;
  const toggle = (ticketId: string, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(ticketId);
      else next.delete(ticketId);
      return next;
    });
  const submit = async () => {
    setBusy(true);
    setError(null);
    for (const item of chosen) {
      try {
        await onDeliver(item.ticketId);
        toggle(item.ticketId, false);
      } catch (e) {
        setError(deliveryTexts.failed(item.key, describeError(e)));
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{t.title(parent.keyLabel)}</DialogTitle>
          <DialogDescription>{t.description(parent.title, items.length)}</DialogDescription>
        </DialogHeader>
        <ul aria-label={t.list} className="grid divide-y rounded-md border px-3">
          {items.map((item) => (
            <ItemRow
              key={item.ticketId}
              item={item}
              checked={checked.has(item.ticketId)}
              onChecked={(on) => toggle(item.ticketId, on)}
            />
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          {nothing ? t.nothing(first.key, deliveryItemState(first)) : t.help}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button
            type="button"
            disabled={busy || chosen.length === 0}
            className="bg-brand-strong text-white hover:bg-brand-strong/90"
            onClick={() => void submit()}
          >
            {t.submit(chosen.length)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
