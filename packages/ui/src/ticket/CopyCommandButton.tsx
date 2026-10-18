import type { TicketView } from "@kibo/schema";
import { copyCommand, deliveryCommand, deliveryTexts } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";

type Props = { ticket: Pick<TicketView, "key" | "statusId" | "startable" | "waitingOn"> };

const toaster = { toast: (message: string) => void toast(message) };

export function CopyCommandButton({ ticket }: Props) {
  const command = deliveryCommand(ticket);
  if (command === null) return null;
  return (
    <Button variant="outline" size="sm" onClick={() => void copyCommand(toaster, command, ticket)}>
      <Copy />
      {deliveryTexts.copy(command)}
    </Button>
  );
}
