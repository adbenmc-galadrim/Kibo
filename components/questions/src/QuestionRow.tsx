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
  "@max-xl:relative @max-xl:flex @max-xl:h-auto @max-xl:flex-wrap @max-xl:items-center @max-xl:gap-x-2 @max-xl:gap-y-1.5 @max-xl:px-3.5 @max-xl:pt-3 @max-xl:pb-1.5";

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
      className={`relative scroll-my-4 border-t text-[13px] outline-none @max-xl:rounded-[10px] @max-xl:border @max-xl:bg-card @max-xl:text-[15px] ${expanded ? "bg-muted/50 @max-xl:border-foreground/60 @max-xl:bg-card" : ""}`}
    >
      <div className={`${ROW_GRID} h-10 ${PHONE_ROW}`}>
        <span className="font-mono text-xs text-muted-foreground @max-xl:order-1 @max-xl:text-[14px]">
          {questionLabel(q)}
        </span>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className="min-w-0 cursor-pointer pr-4 text-left after:absolute after:inset-x-0 after:top-0 after:h-10 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset @max-xl:order-5 @max-xl:basis-full @max-xl:pr-0 @max-xl:after:h-full @max-xl:after:rounded-[10px]"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`relative z-[1] block truncate @max-xl:whitespace-normal @max-xl:text-[16px] ${expanded ? "font-semibold" : ""}`}
              >
                {q.title}
              </span>
            </TooltipTrigger>
            <TooltipContent>{q.title}</TooltipContent>
          </Tooltip>
        </button>
        <span className="inline-flex h-4.5 w-fit items-center gap-1 rounded-[4px] border px-1.5 text-[11.5px] text-muted-foreground @max-xl:order-6 @max-xl:h-7 @max-xl:rounded-[6px] @max-xl:px-2 @max-xl:text-[14px]">
          <UserRound aria-hidden className="size-2.75" />
          {recipientName(data.recipients, q.recipient, data.client)}
        </span>
        <span className="@max-xl:order-2">
          <StateMark question={q} />
        </span>
        <button
          type="button"
          aria-label={fr.openTicket(ticket.keyLabel, ticket.title)}
          className="relative z-[1] w-fit cursor-pointer font-mono text-xs text-muted-foreground hover:underline @max-xl:order-7 @max-xl:min-h-11 @max-xl:text-[14px]"
          onClick={() => sdk.openTicket(ticket.id)}
        >
          <TicketKeyLabel ticket={ticket} />
        </button>
        <span className="text-xs text-muted-foreground @max-xl:order-3 @max-xl:ml-auto @max-xl:text-[14px]">
          {shortAge(q.createdAt, now)}
        </span>
        <Chevron
          data-chevron
          aria-hidden
          className="size-3.5 justify-self-center text-muted-foreground @max-xl:order-4 @max-xl:size-4.5"
        />
      </div>
      {expanded && <QuestionRowDetail question={q} ticket={ticket} data={data} now={now} />}
    </article>
  );
}
