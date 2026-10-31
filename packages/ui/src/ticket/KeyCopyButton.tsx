import type { TicketView } from "@kibo/schema";
import { TicketKeyLabel } from "@kibo/sdk";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@kibo/sdk/ui/tooltip";
import { Check, Ticket } from "lucide-react";
import { toast } from "sonner";
import { frTicketEdit as t } from "../i18n/fr-ticket-edit";
import { useFlash } from "../lib/use-flash";

const COPIED_MS = 2_000;

type Props = { ticket: Pick<TicketView, "key" | "keyLabel"> };

export function KeyCopyButton({ ticket }: Props) {
  const { message, flash } = useFlash(COPIED_MS);
  const copy = () => {
    navigator.clipboard.writeText(ticket.keyLabel).then(
      () => flash(t.keyCopied),
      () => toast(t.copyFailed),
    );
  };
  return (
    <span aria-live="polite" className="inline-flex items-center">
      {message ? (
        <span className="inline-flex h-[21px] items-center gap-[5px] rounded-[6px] bg-(--tracking-green-soft) px-2 text-[12.5px] font-medium text-(--tracking-green)">
          <Check aria-hidden className="size-[13px]" />
          {message}
        </span>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t.copyKeyOf(ticket.keyLabel)}
                className="inline-flex items-center gap-2 rounded-[4px] text-muted-foreground hover:text-foreground"
                onClick={copy}
              >
                <Ticket aria-hidden className="size-3.5 shrink-0" />
                <TicketKeyLabel ticket={ticket} className="font-mono text-[12.5px] whitespace-nowrap" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t.copyKeyOf(ticket.keyLabel)}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </span>
  );
}
