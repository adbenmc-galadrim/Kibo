import { isOpenSignal, type Signal, type SignalKind } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Info, type LucideIcon, MessageCircleQuestionMark, Ticket, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { formatClock } from "../../agents/format";
import { Mention } from "../../agents/mention/Mention";
import { frSignals } from "../../i18n/fr-signals";
import { useAgentsState } from "../../state/agents-context";

type Props = {
  signal: Signal;
  outcome: string | null;
  busy: boolean;
  onTicket(key: string): void;
  onIgnore(signal: Signal): void;
};

const t = frSignals.box;

const ICONS: Record<SignalKind, LucideIcon> = {
  ticket: Ticket,
  context: Info,
  blocker: TriangleAlert,
  question: MessageCircleQuestionMark,
};

function KindName({ kind }: { kind: SignalKind }) {
  const Icon = ICONS[kind];
  const red = kind === "blocker";
  return (
    <span className={cn("flex items-center gap-1 font-medium", red && "text-destructive")}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {frSignals.kinds[kind]}
    </span>
  );
}

function Origin({ signal, onTicket }: Pick<Props, "signal" | "onTicket">) {
  const run = useAgentsState()?.runs.find((r) => r.id === signal.runId);
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
      <KindName kind={signal.kind} />
      <span className="text-muted-foreground">{t.from}</span>
      <Mention runId={signal.runId} label={signal.runLabel} state={run?.state} />
      <span className="text-muted-foreground">{t.on}</span>
      <button
        type="button"
        className="font-mono text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        onClick={() => onTicket(signal.ticketKey)}
      >
        {signal.ticketKey}
      </button>
      <span className="ml-auto font-mono text-muted-foreground">{formatClock(signal.createdAt)}</span>
    </p>
  );
}

export function SignalRow({ signal, outcome, busy, onTicket, onIgnore }: Props) {
  const [unfolded, setUnfolded] = useState(false);
  const open = isOpenSignal(signal);
  const title = `« ${signal.title} »`;
  return (
    <li
      className={cn(
        "grid gap-1.5 rounded-md border bg-card p-2.5 text-card-foreground",
        !open && "opacity-60",
      )}
    >
      <Origin signal={signal} onTicket={onTicket} />
      {signal.body ? (
        <button
          type="button"
          className="text-left text-sm leading-snug"
          aria-expanded={unfolded}
          title={unfolded ? t.hideBody : t.showBody}
          onClick={() => setUnfolded((u) => !u)}
        >
          {title}
        </button>
      ) : (
        <p className="text-sm leading-snug">{title}</p>
      )}
      {unfolded && <p className="text-xs whitespace-pre-wrap text-muted-foreground">{signal.body}</p>}
      {outcome && <p className="text-xs text-muted-foreground">{outcome}</p>}
      {open && (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => onTicket(signal.ticketKey)}
          >
            {t.openTicket}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs"
            disabled={busy}
            onClick={() => onIgnore(signal)}
          >
            {t.ignore}
          </Button>
        </div>
      )}
    </li>
  );
}
