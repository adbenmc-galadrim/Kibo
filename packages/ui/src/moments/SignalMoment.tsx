import type { MomentData } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Send } from "lucide-react";
import { formatClock } from "../agents/format";
import { frSignals } from "../i18n/fr-signals";

type Props = { data: Extract<MomentData, { kind: "signal" }>; at: number; onOpen?(signalId: string): void };

const LINE = "flex min-w-0 items-center gap-2 text-left text-xs";

export function SignalMoment({ data, at, onOpen }: Props) {
  const body = (
    <>
      <Send aria-hidden className="size-3.5 shrink-0 text-brand-strong dark:text-brand" />
      <span className={cn("min-w-0", data.signalKind === "blocker" && "text-destructive")}>
        {frSignals.moment(frSignals.kinds[data.signalKind], data.title)}
      </span>
      <span className="shrink-0 font-mono text-muted-foreground">{`· ${formatClock(at)}`}</span>
    </>
  );
  if (!onOpen) return <p className={LINE}>{body}</p>;
  return (
    <button
      type="button"
      className={cn(LINE, "rounded-sm hover:underline")}
      onClick={() => onOpen(data.signalId)}
    >
      {body}
    </button>
  );
}
