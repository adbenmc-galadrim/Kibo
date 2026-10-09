import type { Actor, Question } from "@kibo/schema";
import { AgentBadge } from "@kibo/sdk";
import { Badge } from "@kibo/sdk/ui/badge";
import { fr } from "./fr";
import { AGENT_ACCENT } from "./QuestionAnswerForm";
import { relativeAge } from "./questions-logic";

const RUN_TEXTS = { queued: () => "", waiting: "", failed: "" };

export function QuestionAuthor({ actor }: { actor: Actor }) {
  if (actor.kind === "agent") return <AgentBadge agent={actor.ref} run={null} texts={RUN_TEXTS} />;
  if (actor.kind === "import")
    return <span className="text-2xs text-muted-foreground">{fr.imported(actor.ref)}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
      <span
        aria-hidden
        className="grid size-4 place-items-center rounded-full bg-muted text-3xs font-semibold"
      >
        {actor.ref.slice(0, 2).toUpperCase()}
      </span>
      {actor.ref}
    </span>
  );
}

export const answerValue = (q: Question): string =>
  q.answer === null ? "" : q.answer.kind === "text" ? q.answer.text : (q.answer.option ?? "");

type AnswerProps = { question: Question; now: number; runLabel(runId: string): string };

export function QuestionAnswerLine({ question, now, runLabel }: AnswerProps) {
  const a = question.answer;
  if (a === null) return null;
  return (
    <div className="grid gap-1 rounded-md bg-muted/50 px-2.5 py-2 text-xs">
      <p className="font-medium">{fr.answer(answerValue(question))}</p>
      <p className="flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
        <span>{fr.answeredBy(a.by.ref, relativeAge(a.at, now))}</span>
        {a.deliveredRunId === null ? (
          <Badge variant="outline" className={`text-3xs ${AGENT_ACCENT}`}>
            {fr.toDeliver}
          </Badge>
        ) : (
          <span>{fr.deliveredTo(runLabel(a.deliveredRunId))}</span>
        )}
      </p>
    </div>
  );
}
