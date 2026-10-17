import type { TicketView } from "@kibo/schema";
import { deliveryCommand, deliveryTexts } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Copy } from "lucide-react";
import { useState } from "react";
import { frFeature } from "../i18n/fr-group";

type Props = { ticket: Pick<TicketView, "key" | "statusId"> };

export function CopyDeliveryButton({ ticket }: Props) {
  const [copy, setCopy] = useState<"idle" | "copied" | "refused">("idle");
  const command = deliveryCommand(ticket);
  if (command === null) return null;
  const run = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopy("copied");
    } catch (e) {
      console.warn("[kibo] clipboard write refused", e);
      setCopy("refused");
    }
  };
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => void run()}>
        <Copy />
        {deliveryTexts.copy(command)}
      </Button>
      <output className="sr-only">{copy === "copied" ? frFeature.copied : ""}</output>
      {copy === "refused" && (
        <p role="alert" className="basis-full text-xs text-destructive">
          {frFeature.copyRefused}
        </p>
      )}
    </>
  );
}
