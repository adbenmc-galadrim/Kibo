import type { OnHold, TicketView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Pause } from "lucide-react";
import { frHold, holdDay } from "../i18n/fr-hold";
import { useHold } from "./use-hold";

type Props = {
  projectId: string;
  ticket: Pick<TicketView, "id" | "onHold">;
  tickets: readonly Pick<TicketView, "id" | "keyLabel">[];
  editable: boolean;
  onOpenTicket(ticketId: string): void;
};

const t = frHold.banner;
const ACTION =
  "h-[25px] shrink-0 gap-[6px] rounded-[6px] px-[10px] py-[5px] text-[12px] leading-[15px] font-medium shadow-none";

const textOf = (hold: OnHold): string =>
  hold.source === "own" ? t.own(hold.reason, holdDay(hold.since)) : t.dependency(hold.key);

export function HoldBanner({ projectId, ticket, tickets, editable, onOpenTicket }: Props) {
  const command = useHold(projectId, ticket.id);
  const hold = ticket.onHold;
  if (hold === null) return null;
  const source = tickets.find((x) => x.keyLabel === hold.key);
  return (
    <output
      aria-label={t.label}
      className="grid gap-[6px] rounded-[8px] border border-(--tracking-border) bg-(--tracking-panel) px-[12px] py-[10px]"
    >
      <div className="flex items-center gap-[10px]">
        <Pause
          absoluteStrokeWidth
          size={14}
          aria-hidden
          className="size-[14px] shrink-0 text-(--tracking-mfg)"
        />
        <p className="min-w-0 flex-1 text-[13px] leading-[1.4] font-medium text-(--tracking-fg)">
          {textOf(hold)}
        </p>
        {hold.source === "own" && editable && (
          <Button
            variant="outline"
            className={ACTION}
            disabled={command.busy}
            onClick={() => void command.resume()}
          >
            {t.resume}
          </Button>
        )}
        {hold.source === "dependency" && source && (
          <Button variant="outline" className={ACTION} onClick={() => onOpenTicket(source.id)}>
            {t.open(hold.key)}
          </Button>
        )}
      </div>
      {command.error && (
        <p role="alert" className="text-[12px] text-(--tracking-red)">
          {command.error}
        </p>
      )}
    </output>
  );
}
