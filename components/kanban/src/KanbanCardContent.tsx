import type { CiRun, MemberInfo, Question, TicketRun, TicketView } from "@kibo/schema";
import { deliveryStepLabel } from "@kibo/schema";
import {
  assigneeLabel,
  DELIVERY_STEP_CHIP,
  DeliveryStepChip,
  GroupChip,
  type GroupRef,
  QuestionsChip,
  type QuestionsChipData,
  TicketKeyLabel,
  useSdk,
} from "@kibo/sdk";
import { Badge } from "@kibo/sdk/ui/badge";
import { Bot } from "lucide-react";
import type { ReactNode } from "react";
import { AgentChip } from "./AgentChip";
import { BlockedBadge, CardBadges, OptionalBadge } from "./CardBadges";
import { fr } from "./fr";
import { LabelChips } from "./LabelChips";

export const STARTABLE_BADGE =
  "border-zinc-400 bg-background text-2xs font-medium text-zinc-700 dark:border-zinc-500 dark:text-zinc-200";

export const CARD_TITLE_CLASS = "w-fit max-w-full text-left text-[13px] font-medium wrap-anywhere";

export const CARD_CLASS =
  "relative grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type CardGroup = GroupRef & Pick<TicketView, "shortKey">;

const featureChipRef = (group: CardGroup): GroupRef => ({
  ...group,
  keyLabel: group.shortKey ?? group.keyLabel,
});

export type CardFacts = {
  ticket: TicketView;
  group: CardGroup | null;
  run: TicketRun | null;
  ciRuns: CiRun[];
  blocked: boolean;
  blocking: Question | null;
  members: MemberInfo[];
  remote: { label: string; state: string }[];
  questions: QuestionsChipData;
};

type Props = CardFacts & { menu: ReactNode; title: ReactNode };

function StepChip({ ticket }: { ticket: TicketView }) {
  if (ticket.delivery?.kind !== "update") return <DeliveryStepChip ticket={ticket} />;
  return (
    <span data-delivery-step="" className={DELIVERY_STEP_CHIP}>
      <span className="truncate">{fr.retouch(deliveryStepLabel(ticket.delivery.step))}</span>
    </span>
  );
}

export function KanbanCardContent(props: Props) {
  const { ticket: t, group, run, ciRuns, blocked, blocking, members, remote, questions, menu, title } = props;
  const otherQuestions = t.openQuestions - (blocking === null ? 0 : 1);
  const sdk = useSdk();
  return (
    <>
      <div className="flex h-3.5 items-center gap-2">
        <TicketKeyLabel ticket={t} className="min-w-0 truncate font-mono text-2xs text-muted-foreground" />
        {group && <GroupChip group={featureChipRef(group)} onOpen={(id) => sdk.openTicket(id)} />}
        {t.session && (
          <span
            role="img"
            aria-label={fr.session(t.session.tool)}
            className="size-[7px] shrink-0 rounded-full bg-brand"
          />
        )}
        <span className="flex-1" />
        {menu}
      </div>
      {title}
      <LabelChips labels={t.labels} />
      {t.blockedReason && (
        <p className="text-2xs text-red-600 wrap-anywhere dark:text-red-400">
          {fr.blockedReason(t.blockedReason)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-[5px]">
        {t.optional && <OptionalBadge />}
        {blocked && <BlockedBadge question={blocking} />}
        {t.waitingOn.map((k) => (
          <Badge key={k} variant="outline" className="max-w-full text-3xs">
            <span className="truncate">{fr.waitingOn(k)}</span>
          </Badge>
        ))}
        <CardBadges ticket={t} ciRuns={ciRuns} />
        {t.startable && (
          <Badge variant="outline" className={STARTABLE_BADGE}>
            {fr.startable}
          </Badge>
        )}
        <AgentChip
          agent={t.assignee?.kind === "agent" ? t.assignee.ref : null}
          run={run}
          className="max-w-full"
        />
        <StepChip ticket={t} />
        {remote.map((r) => (
          <span
            key={r.label}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand/10 px-1.5 py-0.5 text-3xs text-brand-strong dark:text-brand"
          >
            <Bot absoluteStrokeWidth size={12} aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{r.label}</span>
          </span>
        ))}
        {t.assignee?.kind === "human" && members.length > 0 && (
          <Badge variant="outline" className="max-w-full text-3xs font-normal">
            <span className="truncate">{assigneeLabel(t.assignee, members)}</span>
          </Badge>
        )}
        {otherQuestions > 0 && (
          <QuestionsChip
            {...questions}
            ticket={t}
            text={fr.questions(t.openQuestions)}
            label={fr.questionsOpen(t.openQuestions)}
          />
        )}
      </div>
    </>
  );
}
