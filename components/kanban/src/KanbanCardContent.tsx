import type { Question, TicketView } from "@kibo/schema";
import {
  DELIVERY_STEP_CHIP,
  GroupChip,
  type GroupRef,
  stepLabelShort,
  TicketKeyLabel,
  useSdk,
} from "@kibo/sdk";
import { ThreadBadge, useMinuteClock } from "@kibo/sdk/t3";
import type { ReactNode } from "react";
import { PrBadge, SignalBadge } from "./CardBadges";
import { cardProgress, cardSignal } from "./card-signal";
import { fr } from "./fr";

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
  blocked: boolean;
  blocking: Pick<Question, "number" | "importRef"> | null;
};

type Props = CardFacts & { menu: ReactNode; title: ReactNode; launch?: ReactNode };

function CardThread({ thread }: { thread: NonNullable<TicketView["thread"]> }) {
  return <ThreadBadge thread={thread} now={useMinuteClock()} compact />;
}

function StepChip({ delivery }: { delivery: NonNullable<TicketView["delivery"]> }) {
  const step = stepLabelShort(delivery.step);
  return (
    <span data-delivery-step="" title={fr.phaseHint(delivery.step)} className={DELIVERY_STEP_CHIP}>
      <span className="truncate">{delivery.kind === "update" ? fr.retouch(step) : step}</span>
    </span>
  );
}

export function KanbanCardContent(props: Props) {
  const { ticket: t, group, blocked, blocking, menu, title, launch } = props;
  const sdk = useSdk();
  const signal = cardSignal(t, blocked, blocking);
  const progress = cardProgress(t);
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
      {launch}
      {t.blockedReason && (
        <p title={t.blockedReason} className="truncate text-2xs text-muted-foreground">
          {fr.blockedReason(t.blockedReason)}
        </p>
      )}
      {(signal !== null || progress !== null) && (
        <div className="flex flex-wrap items-center gap-[5px]">
          {signal !== null && <SignalBadge signal={signal} />}
          {progress !== null && <PrBadge pr={progress.pr} />}
          {progress?.delivery && <StepChip delivery={progress.delivery} />}
        </div>
      )}
      {t.thread && <CardThread thread={t.thread} />}
    </>
  );
}
