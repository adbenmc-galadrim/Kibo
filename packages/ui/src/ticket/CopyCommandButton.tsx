import type { TicketView } from "@kibo/schema";
import { copyCommand, deliveryCommand, deliveryTexts } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Copy, Link } from "lucide-react";
import { toast } from "sonner";
import { frTicketTracking as t } from "../i18n/fr-ticket-tracking";
import { targetToHash } from "../tabs/target-hash";

type Props = { ticket: Pick<TicketView, "key" | "statusId" | "startable" | "waitingOn"> };

const toaster = { toast: (message: string) => void toast(message) };

export function CopyCommandButton({ ticket }: Props) {
  const command = deliveryCommand(ticket);
  if (command === null) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-[25px] text-xs"
      onClick={() => void copyCommand(toaster, command, ticket)}
    >
      <Copy />
      {deliveryTexts.copy(command)}
    </Button>
  );
}

async function copyLink(projectId: string, ticketId: string): Promise<void> {
  const url = `${location.origin}${location.pathname}${targetToHash({ kind: "ticket", projectId, ticketId })}`;
  try {
    await navigator.clipboard.writeText(url);
    toast(t.linkCopied);
  } catch (e) {
    console.warn("[kibo] clipboard write refused", e);
    toast(t.linkFailed);
  }
}

export function CopyLinkButton({ projectId, ticketId }: { projectId: string; ticketId: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground"
      aria-label={t.copyLink}
      title={t.copyLink}
      onClick={() => void copyLink(projectId, ticketId)}
    >
      <Link />
    </Button>
  );
}
