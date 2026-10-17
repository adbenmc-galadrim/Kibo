import type { MemberInfo, TicketRun, TicketView } from "@kibo/schema";
import { assigneeLabel, QuestionsChip, type QuestionsChipData } from "@kibo/sdk";
import { Badge } from "@kibo/sdk/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@kibo/sdk/ui/hover-card";
import type { ReactNode } from "react";
import { AgentChip } from "./AgentChip";
import { fr } from "./fr";
import { LabelChips } from "./LabelChips";

type Props = {
  ticket: TicketView;
  run: TicketRun | null;
  members: MemberInfo[];
  questions: QuestionsChipData;
  children: ReactNode;
};

export function RowDetails({ ticket: t, run, members, questions, children }: Props) {
  const agent = t.assignee?.kind === "agent" || run !== null;
  const human = t.assignee?.kind === "human" ? t.assignee : null;
  const empty =
    !agent && !human && t.labels.length === 0 && !t.blockedReason && !t.startable && t.openQuestions === 0;
  if (empty) return children;
  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent align="start" className="flex w-72 flex-col gap-2 p-3 text-xs">
        {human && <span>{fr.details.assignee(assigneeLabel(human, members))}</span>}
        {agent && (
          <AgentChip
            agent={t.assignee?.kind === "agent" ? t.assignee.ref : null}
            run={run}
            className="w-fit max-w-full"
          />
        )}
        {t.blockedReason && (
          <span className="text-red-600 dark:text-red-400">{fr.details.blocked(t.blockedReason)}</span>
        )}
        <LabelChips labels={t.labels} />
        {t.openQuestions > 0 && (
          <QuestionsChip
            {...questions}
            ticket={t}
            text={fr.questions(t.openQuestions)}
            label={fr.questionsOpen(t.openQuestions)}
            className="w-fit"
          />
        )}
        {t.startable && (
          <Badge variant="outline" className="w-fit text-2xs font-medium">
            {fr.details.startable}
          </Badge>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
