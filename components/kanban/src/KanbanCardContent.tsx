import type { CiRun, Question, TicketView } from "@kibo/schema";
import { FINAL_STATUSES } from "@kibo/schema";
import {
  DELIVERY_STEP_CHIP,
  GroupChip,
  type GroupRef,
  QuestionsChip,
  type QuestionsChipData,
  stepLabelShort,
  TicketKeyLabel,
  useSdk,
} from "@kibo/sdk";
import { Badge } from "@kibo/sdk/ui/badge";
import type { ReactNode } from "react";
import { BlockedBadge, CardBadges, HeldBadge, OptionalBadge } from "./CardBadges";
import { fr } from "./fr";
import { LabelChips } from "./LabelChips";
import { startReasonText } from "./start-reason";

export const CARD_TITLE_CLASS = "w-fit max-w-full text-left text-[13px] font-medium wrap-anywhere";

export const CARD_CLASS =
  "@container/card relative grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type CardGroup = GroupRef & Pick<TicketView, "shortKey">;

const FEATURE_TEXT =
  "max-w-none rounded-none border-0 bg-transparent px-0 text-2xs text-muted-foreground before:mr-1.5 before:content-['·'] hover:bg-transparent hover:underline dark:hover:bg-transparent";

const featureChipRef = (group: CardGroup): GroupRef => ({
  ...group,
  keyLabel: group.shortKey ?? group.keyLabel,
});

export type CardFacts = {
  ticket: TicketView;
  group: CardGroup | null;
  ciRuns: CiRun[];
  blocked: boolean;
  blocking: Question | null;
  questions: QuestionsChipData;
};

type Props = CardFacts & { menu: ReactNode; title: ReactNode };

function StepChip({ ticket }: { ticket: TicketView }) {
  const delivery = ticket.delivery;
  if (delivery === null) return null;
  const update = delivery.kind === "update";
  if (!update && FINAL_STATUSES.includes(ticket.statusId)) return null;
  const phase = stepLabelShort(delivery.step);
  return (
    <span data-delivery-step="" title={fr.phaseHint(delivery.step)} className={DELIVERY_STEP_CHIP}>
      <span className="truncate">{update ? fr.retouch(phase) : phase}</span>
    </span>
  );
}

export function KanbanCardContent(props: Props) {
  const { ticket: t, group, ciRuns, blocked, blocking, questions, menu, title } = props;
  const otherQuestions = t.openQuestions - (blocking === null ? 0 : 1);
  const sdk = useSdk();
  const reason = startReasonText(t.startReason, t.waitingOn);
  return (
    <>
      <div className="flex h-3.5 items-center gap-1.5">
        <TicketKeyLabel ticket={t} className="min-w-0 truncate font-mono text-2xs text-muted-foreground" />
        {group && (
          <GroupChip
            group={featureChipRef(group)}
            onOpen={(id) => sdk.openTicket(id)}
            className={FEATURE_TEXT}
          />
        )}
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
        {t.onHold !== null && <HeldBadge hold={t.onHold} />}
        {(t.onHold === null ? t.waitingOn : []).map((k) => (
          <Badge key={k} variant="outline" className="max-w-full text-3xs">
            <span className="truncate">{fr.waitingOn(k)}</span>
          </Badge>
        ))}
        <CardBadges ticket={t} ciRuns={ciRuns} />
        {reason !== null && (
          <Badge variant="outline" className="max-w-full text-3xs">
            <span className="truncate">{reason}</span>
          </Badge>
        )}
        <StepChip ticket={t} />
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
