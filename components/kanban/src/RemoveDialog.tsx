import type { TicketView } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { fr } from "./fr";

type Props = { ticket: TicketView; childCount: number; onClose(): void };

export function RemoveDialog({ ticket, childCount, onClose }: Props) {
  const sdk = useSdk();
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={fr.removeTitle(ticket.keyLabel)}
      description={fr.removeHelp(childCount)}
      confirmLabel={fr.removeConfirm}
      cancelLabel={fr.cancel}
      onConfirm={async () => {
        await sdk.run({ method: "deleteTicket", ticketId: ticket.id });
      }}
    />
  );
}
