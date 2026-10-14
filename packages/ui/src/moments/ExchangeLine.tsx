import { cn } from "@kibo/sdk/lib/utils";
import { formatClock } from "../agents/format";
import { frMoments } from "../i18n/fr-moments";
import { AgentText } from "./AgentText";
import { QuestionText } from "./QuestionText";

export type FeedExtra = {
  key: string;
  at: number;
  kind: "question" | "human" | "system";
  text: string;
  questionId?: string;
};

const textOf = (extra: FeedExtra) =>
  extra.questionId ? <QuestionText questionId={extra.questionId} text={extra.text} /> : extra.text;

function Body({ extra }: { extra: FeedExtra }) {
  if (extra.kind === "question" && !extra.questionId) return <AgentText text={extra.text} />;
  return <p className="break-words whitespace-pre-wrap">{textOf(extra)}</p>;
}

export function ExchangeLine({ extra }: { extra: FeedExtra }) {
  const t = frMoments.exchange;
  if (extra.kind === "system") return <p className="text-xs text-muted-foreground italic">{textOf(extra)}</p>;
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
      <Body extra={extra} />
    </div>
  );
}
