import type { Question, QuestionRecipient } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { ChevronDown, UserRound } from "lucide-react";
import { useState } from "react";
import { fr } from "./fr";
import { recipientName } from "./questions-logic";

type Props = { question: Question; recipients: readonly QuestionRecipient[]; readOnly: boolean };

export function RecipientMenu({ question, recipients, readOnly }: Props) {
  const sdk = useSdk();
  const [failed, setFailed] = useState(false);
  const name = recipientName(recipients, question.recipient);
  if (readOnly)
    return (
      <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
        <UserRound aria-hidden className="size-3" />
        {fr.recipients.shown(name)}
      </span>
    );
  const choose = async (recipient: string) => {
    if (recipient === question.recipient) return;
    setFailed(false);
    try {
      await sdk.run({
        method: "updateQuestion",
        questionId: question.id,
        recipient,
        by: { kind: "human", ref: sdk.viewer },
      });
    } catch (e) {
      console.error(e);
      setFailed(true);
    }
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={fr.recipients.menu(name)}
            className="h-6 gap-1 rounded-full px-2 text-2xs font-normal"
          >
            <UserRound aria-hidden className="size-3" />
            {fr.recipients.shown(name)}
            <ChevronDown aria-hidden className="size-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuRadioGroup value={question.recipient} onValueChange={(v) => void choose(v)}>
            {recipients.map((r) => (
              <DropdownMenuRadioItem key={r.id} value={r.id} className="text-xs">
                {r.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {failed && (
        <span role="alert" className="text-2xs text-destructive">
          {fr.recipients.changeFailed}
        </span>
      )}
    </>
  );
}
