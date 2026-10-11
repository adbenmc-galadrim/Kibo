import { cn } from "@kibo/sdk/lib/utils";
import { formatClock } from "../agents/format";
import { frMoments } from "../i18n/fr-moments";

export type FeedExtra = { key: string; at: number; kind: "question" | "human" | "system"; text: string };

export function ExchangeLine({ extra }: { extra: FeedExtra }) {
  const t = frMoments.exchange;
  if (extra.kind === "system") return <p className="text-xs text-muted-foreground italic">{extra.text}</p>;
  return (
    <div
      className={cn(
        "grid gap-1 rounded-md border px-3 py-2 text-sm",
        extra.kind === "human" ? "ml-8 bg-muted/50" : "border-brand/40",
      )}
    >
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{formatClock(extra.at)}</span>
        {t[extra.kind]}
      </span>
      <p className="break-words whitespace-pre-wrap">{extra.text}</p>
    </div>
  );
}
