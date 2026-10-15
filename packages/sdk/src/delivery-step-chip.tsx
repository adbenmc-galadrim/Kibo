import { deliveryStepLabel, FINAL_STATUSES, type TicketView } from "@kibo/schema";
import { cn } from "./lib/utils";

type Props = { ticket: Pick<TicketView, "statusId" | "delivery">; className?: string };

export const DELIVERY_STEP_CHIP =
  "inline-flex max-w-full items-center rounded-full border border-zinc-300 px-1.5 py-0.5 font-mono text-3xs text-zinc-700 dark:border-zinc-600 dark:text-zinc-300";

export function DeliveryStepChip({ ticket, className }: Props) {
  if (ticket.delivery === null || FINAL_STATUSES.includes(ticket.statusId)) return null;
  return (
    <span data-delivery-step="" className={cn(DELIVERY_STEP_CHIP, className)}>
      <span className="truncate">{deliveryStepLabel(ticket.delivery.step)}</span>
    </span>
  );
}
