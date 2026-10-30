import type { Actor, Question, TicketRun } from "@kibo/schema";
import { AgentBadge, AgentMention, type MentionTexts, useAgentMention } from "@kibo/sdk";
import { fr } from "./fr";
import { actorName, relativeAge } from "./questions-logic";

const RUN_TEXTS = { queued: () => "", waiting: "", failed: "" };

const MENTION_TEXTS: MentionTexts = {
  history: fr.mention.history,
  reply: fr.mention.reply,
  waiting: fr.mention.waiting,
  step: fr.mention.step,
  state: (state) => fr.mention.states[state],
};

function RunMention({ run }: { run: TicketRun }) {
  const handlers = useAgentMention();
  return (
    <AgentMention
      runId={run.runId}
      label={run.label}
      state={run.state}
      className="text-2xs"
      texts={MENTION_TEXTS}
      {...handlers}
    />
  );
}

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

export function QuestionAuthor({ actor, run = null }: { actor: Actor; run?: TicketRun | null }) {
  if (actor.kind === "agent" && run !== null) return <RunMention run={run} />;
  if (actor.kind === "agent") return <AgentBadge agent={actor.ref} run={null} texts={RUN_TEXTS} />;
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
