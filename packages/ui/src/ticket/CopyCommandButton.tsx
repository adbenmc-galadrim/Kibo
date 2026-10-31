import type { TicketView } from "@kibo/schema";
import { copyCommand, deliveryCommand, deliveryTexts } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import type { MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { Copy, Link } from "lucide-react";
import { toast } from "sonner";
import { frTicketTracking as t } from "../i18n/fr-ticket-tracking";
import { targetToHash } from "../tabs/target-hash";

type CopyTarget = Pick<TicketView, "key" | "statusId" | "startable" | "waitingOn">;

const toaster = { toast: (message: string) => void toast(message) };

export function copyDeliveryEntry(ticket: CopyTarget, question: string | null): MenuEntry | null {
  const command = deliveryCommand(ticket);
  if (command === null) return null;
  return {
    label: deliveryTexts.copy(command),
    icon: Copy,
    onSelect: () => void copyCommand(toaster, command, { ...ticket, question }),
  };
}

async function copyText(text: string, done: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch (e) {
    console.warn("[kibo] clipboard write refused", e);
    toast(t.linkFailed);
  }
}

const copyLink = (projectId: string, ticketId: string): Promise<void> =>
  copyText(
    `${location.origin}${location.pathname}${targetToHash({ kind: "ticket", projectId, ticketId })}`,
    t.linkCopied,
  );

export function CopyBranchCommandButton({
  ticketKey,
  secondary = false,
}: {
  ticketKey: string;
  secondary?: boolean;
}) {
  const command = t.branchCommand(ticketKey);
  return (
    <Button
      variant={secondary ? "link" : "outline"}
      size="sm"
      className={secondary ? "h-[25px] w-fit px-0 text-xs text-muted-foreground" : "h-[25px] w-fit text-xs"}
      onClick={() => void copyText(command, deliveryTexts.copied([]))}
    >
      <Copy />
      {t.copyBranchCommand(command)}
    </Button>
  );
}

export function CopyLinkButton({ projectId, ticketId }: { projectId: string; ticketId: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="-mx-[6.5px] size-7 text-muted-foreground"
      aria-label={t.copyLink}
      title={t.copyLink}
      onClick={() => void copyLink(projectId, ticketId)}
    >
      <Link />
    </Button>
  );
}
