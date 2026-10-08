import { KiboError, type RunQuestions, type RunView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { MessageCircleQuestion } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { frRunChat } from "../i18n/fr-run-chat";
import { useOpenQuestions } from "./open-questions";

type Props = { run: RunView; questions: RunQuestions | null };

const failureText = (e: unknown) =>
  e instanceof KiboError && e.code === "INVALID_TRANSITION" ? frRunChat.noSession : frRunChat.deliverFailed;

export function RunQuestionsBar({ run, questions }: Props) {
  const openQuestions = useOpenQuestions();
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const open = questions?.open ?? 0;
  const undelivered = questions?.undelivered ?? 0;
  const { projectId, ticketId } = run;
  if (open === 0 && undelivered === 0) return null;
  const deliver = async () => {
    if (!projectId || !ticketId) return;
    setFailure(null);
    setSending(true);
    try {
      await client.rpc({ method: "deliverAnswers", projectId, ticketId });
    } catch (e) {
      setFailure(failureText(e));
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="grid gap-1 text-xs">
      {open > 0 && (
        <p className="flex items-center gap-2">
          <MessageCircleQuestion aria-hidden className="size-3.5 text-orange-600 dark:text-orange-400" />
          <span className="text-orange-600 dark:text-orange-400">{frRunChat.openQuestions(open)}</span>
          {openQuestions && projectId && (
            <Button size="sm" variant="link" className="h-6 px-0" onClick={() => openQuestions(projectId)}>
              {frRunChat.openQuestionsLink}
            </Button>
          )}
        </p>
      )}
      {undelivered > 0 && projectId && ticketId && (
        <p className="flex items-center gap-2">
          <span className="text-muted-foreground">{frRunChat.undelivered(undelivered)}</span>
          <Button
            size="sm"
            className="h-6 bg-brand-strong text-white hover:bg-brand-strong/90"
            disabled={sending}
            onClick={deliver}
          >
            {frRunChat.deliver}
          </Button>
        </p>
      )}
      {failure && (
        <p role="alert" className="text-destructive">
          {failure}
        </p>
      )}
    </div>
  );
}
