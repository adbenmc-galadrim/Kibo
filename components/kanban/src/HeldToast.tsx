import { type Question, questionLabel } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Lock } from "lucide-react";
import { useEffect } from "react";
import { fr } from "./fr";

const VISIBLE_MS = 8_000;

type Props = { ticketKey: string; question: Question; onClose(): void };

export function HeldToast({ ticketKey, question, onClose }: Props) {
  const sdk = useSdk();
  const message = fr.heldBy(ticketKey, questionLabel(question));
  useEffect(() => {
    const timer = setTimeout(onClose, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <section
      aria-label={message}
      className="fixed right-[calc(var(--project-agent-edge,0px)+2.5rem)] bottom-7 z-[60] flex items-center gap-2.5 rounded-lg border bg-card px-3.5 py-3 text-card-foreground shadow-md"
    >
      <Lock aria-hidden className="size-4 text-destructive" />
      <span className="text-sm font-medium">{message}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-6.5 px-2.5 text-xs"
        onClick={() => {
          sdk.openView("questions", { question: question.id });
          onClose();
        }}
      >
        {fr.answer}
      </Button>
    </section>
  );
}
