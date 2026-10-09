import { KiboError } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Send } from "lucide-react";
import { useState } from "react";
import { fr } from "./fr";
import { AGENT_ACCENT } from "./QuestionAnswerForm";

export type DeliveryNotice = { text: string; failed: boolean };

type Props = {
  ticketId: string;
  label: string;
  runLabel(runId: string): string;
  onNotice(notice: DeliveryNotice): void;
};

function failure(e: unknown): DeliveryNotice {
  if (e instanceof KiboError && e.code === "INVALID_TRANSITION") return { text: fr.noSession, failed: true };
  console.error(e);
  return { text: fr.deliverFailed, failed: true };
}

export function DeliverButton({ ticketId, label, runLabel, onNotice }: Props) {
  const sdk = useSdk();
  const [busy, setBusy] = useState(false);
  const deliver = async () => {
    setBusy(true);
    try {
      const result = await sdk.questions.deliver(ticketId);
      onNotice({
        text: result.runId === null ? fr.nothingToDeliver : fr.delivered(runLabel(result.runId)),
        failed: false,
      });
    } catch (e) {
      onNotice(failure(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      variant="outline"
      size="sm"
      className={`h-7 text-xs ${AGENT_ACCENT}`}
      disabled={busy}
      onClick={() => void deliver()}
    >
      <Send aria-hidden />
      {label}
    </Button>
  );
}

export function DeliveryMessage({ notice }: { notice: DeliveryNotice | null }) {
  return (
    <output
      className={notice?.failed ? "block text-xs text-destructive" : "block text-xs text-muted-foreground"}
    >
      {notice?.text}
    </output>
  );
}
