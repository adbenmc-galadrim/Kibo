import { isAnswered, isArchived, type Question, questionLabel, type TicketView } from "@kibo/schema";
import { TicketKeyLabel, useSdk } from "@kibo/sdk";
import { Tooltip, TooltipContent, TooltipTrigger } from "@kibo/sdk/ui/tooltip";
import { ChevronDown, ChevronUp, Lock, UserRound } from "lucide-react";
import { fr } from "./fr";
import { QuestionRowDetail } from "./QuestionRowDetail";
import { isOpenBlocking, recipientName, shortAge } from "./questions-logic";
import type { QuestionsData } from "./use-questions";
import { useSpotlightCard } from "./use-spotlight-card";

const PHONE_ROW =
  "@max-lg:relative @max-lg:flex @max-lg:h-auto @max-lg:flex-wrap @max-lg:items-center @max-lg:gap-x-2 @max-lg:gap-y-1.5 @max-lg:px-3.5 @max-lg:pt-3 @max-lg:pb-1.5";

export const ROW_GRID =
  "grid grid-cols-[68px_minmax(0,1fr)_132px_122px_102px_56px_28px] items-center px-[15px]";

type Props = {
  question: Question;
  ticket: TicketView;
  data: QuestionsData;
  now: number;
  expanded: boolean;
  onToggle(): void;
  onExpand(): void;
};

function StateMark({ question: q }: { question: Question }) {
  if (isOpenBlocking(q))
    return (
      <span className="inline-flex h-4.5 w-fit items-center gap-1 rounded-[4px] bg-destructive/12 px-1.5 text-[11.5px] leading-none text-destructive">
        <Lock aria-hidden className="size-3" />
        {fr.blocking}
      </span>
    );
  if (isArchived(q)) return <span className="text-xs text-muted-foreground">{fr.state.archived}</span>;
  if (isAnswered(q)) return <span className="text-xs text-muted-foreground">{fr.state.answered}</span>;
  return null;
}

export function QuestionRow(props: Props) {
  const { question: q, ticket, data, now, expanded, onToggle, onExpand } = props;
  const sdk = useSdk();
  const spotlight = useSpotlightCard(q.id, onExpand);
  const Chevron = expanded ? ChevronUp : ChevronDown;
  return (
    <article
      ref={spotlight.ref}
      tabIndex={-1}
      data-spotlight={spotlight.spotlit ?? undefined}
      aria-label={q.title}
      className={`relative scroll-my-4 border-t text-[13px] outline-none @max-lg:rounded-[10px] @max-lg:border @max-lg:bg-card @max-lg:text-[15px] ${expanded ? "bg-muted/50 @max-lg:border-foreground/60 @max-lg:bg-card" : ""}`}
    >
      <div className={`${ROW_GRID} h-10 ${PHONE_ROW}`}>
        <span className="font-mono text-xs text-muted-foreground @max-lg:order-1 @max-lg:text-[14px]">
          {questionLabel(q)}
        </span>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className="min-w-0 cursor-pointer pr-4 text-left after:absolute after:inset-x-0 after:top-0 after:h-10 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset @max-lg:order-5 @max-lg:basis-full @max-lg:pr-0 @max-lg:after:h-full @max-lg:after:rounded-[10px]"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`relative z-[1] block truncate @max-lg:whitespace-normal @max-lg:text-[16px] ${expanded ? "font-semibold" : ""}`}
              >
                {q.title}
              </span>
            </TooltipTrigger>
            <TooltipContent>{q.title}</TooltipContent>
          </Tooltip>
        </button>
        <span className="inline-flex h-4.5 w-fit items-center gap-1 rounded-[4px] border px-1.5 text-[11.5px] text-muted-foreground @max-lg:order-6 @max-lg:h-7 @max-lg:rounded-[6px] @max-lg:px-2 @max-lg:text-[14px]">
          <UserRound aria-hidden className="size-2.75" />
          {recipientName(data.recipients, q.recipient, data.client)}
        </span>
        <span className="@max-lg:order-2">
          <StateMark question={q} />
        </span>
        <button
          type="button"
          aria-label={fr.openTicket(ticket.keyLabel, ticket.title)}
          className="relative z-[1] w-fit cursor-pointer font-mono text-xs text-muted-foreground hover:underline @max-lg:order-7 @max-lg:min-h-11 @max-lg:text-[14px]"
          onClick={() => sdk.openTicket(ticket.id)}
        >
          <TicketKeyLabel ticket={ticket} />
        </button>
        <span className="text-xs text-muted-foreground @max-lg:order-3 @max-lg:ml-auto @max-lg:text-[14px]">
          {shortAge(q.createdAt, now)}
        </span>
        <Chevron
          data-chevron
          aria-hidden
          className="size-3.5 justify-self-center text-muted-foreground @max-lg:order-4 @max-lg:size-4.5"
        />
      </div>
      {expanded && <QuestionRowDetail question={q} ticket={ticket} data={data} now={now} />}
    </article>
  );
}
