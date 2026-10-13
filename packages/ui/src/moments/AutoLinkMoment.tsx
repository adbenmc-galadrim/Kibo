import type { AutoLink, MomentData } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Ban, Link, Undo2 } from "lucide-react";
import { formatClock } from "../agents/format";
import { frOverlaps } from "../i18n/fr-overlaps";
import { actorName, momentStamp } from "../overlaps/overlap-labels";

type Data = Extract<MomentData, { kind: "auto_link" }>;

export type AutoLinkMomentProps = {
  data: Data;
  at: number;
  link: AutoLink | null;
  canEdit: boolean;
  now?: number;
  onCancel(id: string): void;
  onOpenTicket?(key: string): void;
};

const t = frOverlaps.moment;
const BOX = "grid gap-1.5 rounded-md border bg-card px-3 py-2 text-xs";

function TicketKey({ value, onOpen }: { value: string; onOpen?(key: string): void }) {
  if (!onOpen) return <span className="font-mono font-semibold">{value}</span>;
  return (
    <button
      type="button"
      className="font-mono font-semibold underline underline-offset-2"
      onClick={() => onOpen(value)}
    >
      {value}
    </button>
  );
}

function Cancelled({ link, now }: { link: AutoLink; now: number }) {
  if (link.status === "removed") return <p className="pl-5 text-muted-foreground">{t.removed}</p>;
  return (
    <p className="flex items-center gap-1.5 pl-5">
      <Undo2 aria-hidden className="size-3.5 text-muted-foreground" />
      <span className="font-medium">
        {t.cancelled(actorName(link.cancelledBy), momentStamp(link.cancelledAt ?? now, now))}
      </span>
      <span className="text-muted-foreground">{`· ${t.cancelledHint}`}</span>
    </p>
  );
}

export function AutoLinkMoment({
  data,
  at,
  link,
  canEdit,
  now = Date.now(),
  onCancel,
  onOpenTicket,
}: AutoLinkMomentProps) {
  const { fromTicketKey: from, toTicketKey: to } = data;
  if (data.failure === "cycle")
    return (
      <p data-auto-link="failed" className={`${BOX} flex items-center gap-2 text-destructive`}>
        <Ban aria-hidden className="size-3.5 shrink-0" />
        {t.failed(from, to)}
      </p>
    );
  const cancellable = canEdit && link?.status === "added" && data.autoLinkId !== null;
  return (
    <div data-auto-link={data.autoLinkId ?? undefined} className={BOX}>
      <p className="flex min-w-0 items-center gap-1.5">
        <Link aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          {`${t.linked} `}
          <TicketKey value={from} onOpen={onOpenTicket} />
          {" → "}
          <TicketKey value={to} onOpen={onOpenTicket} />
          {` ${t.blocks(from, to)}`}
        </span>
        <span className="shrink-0 font-mono text-muted-foreground">{formatClock(at)}</span>
      </p>
      <div className="flex min-w-0 items-center gap-2 pl-5">
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          <code className="font-mono text-foreground">{data.path}</code>
          {` ${t.reason(data.reason, from)} · ${t.mergeFirst(from)}`}
        </span>
        {cancellable && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => link && onCancel(link.id)}
          >
            <Undo2 aria-hidden />
            {t.cancel}
          </Button>
        )}
      </div>
      {link && link.status !== "added" && <Cancelled link={link} now={now} />}
    </div>
  );
}
