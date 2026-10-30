import type { Actor, Question } from "@kibo/schema";
import { AgentBadge } from "@kibo/sdk";
import { fr } from "./fr";
import { actorName, relativeAge } from "./questions-logic";

function HumanAuthor({ actor }: { actor: Actor }) {
  const name = actorName(actor);
  return (
    <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
      <span
        aria-hidden
        className="grid size-4 place-items-center rounded-full bg-muted text-3xs font-semibold"
      >
        {name.slice(0, 2).toUpperCase()}
      </span>
      {name}
    </span>
  );
}

export function QuestionAuthor({ actor }: { actor: Actor }) {
  if (actor.kind === "agent") return <AgentBadge agent={actor.ref} />;
  if (actor.kind === "import")
    return <span className="text-2xs text-muted-foreground">{fr.imported(actor.ref)}</span>;
  return <HumanAuthor actor={actor} />;
}

export const answerValue = (q: Question): string =>
  q.answer === null ? "" : q.answer.kind === "text" ? q.answer.text : (q.answer.option ?? "");

export function QuestionAnswerLine({ question, now }: { question: Question; now: number }) {
  const a = question.answer;
  if (a === null) return null;
  return (
    <div className="grid gap-1 rounded-md bg-muted/50 px-2.5 py-2 text-xs">
      <p className="font-medium">{fr.answer(answerValue(question))}</p>
      <p className="text-2xs text-muted-foreground">
        {fr.answeredBy(actorName(a.by), relativeAge(a.at, now))}
      </p>
    </div>
  );
}
