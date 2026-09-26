import type { ComponentDraft } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Bot, ExternalLink, RefreshCw } from "lucide-react";
import { fr } from "../i18n/fr";
import type { draftActions } from "./draft-flow";
import { useAiAvailability } from "./use-ai-availability";

type DraftMethod = "retryComponentDraft" | "revalidateComponentDraft" | "openComponentDraftFolder";

type Props = {
  details: ComponentDraft;
  actions: ReturnType<typeof draftActions>;
  busy: boolean;
  reviewing: boolean;
  onAct: (method: DraftMethod) => void;
  onReviewed: () => void;
  onAbandon: () => void;
};

export function DraftFooter({ details, actions, busy, reviewing, onAct, onReviewed, onAbandon }: Props) {
  const failed = details.status === "failed";
  const { ready, block } = useAiAvailability("generateur");
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {actions.canAbandon && (
        <Button variant="outline" disabled={busy} onClick={onAbandon}>
          {fr.ai.abandon}
        </Button>
      )}
      {failed && actions.codeFallback && (
        <>
          <Button variant="outline" disabled={busy} onClick={() => onAct("openComponentDraftFolder")}>
            <ExternalLink aria-hidden className="size-4" />
            {fr.ai.openFolder}
          </Button>
          <Button disabled={busy} onClick={() => onAct("revalidateComponentDraft")}>
            <RefreshCw aria-hidden className="size-4" />
            {fr.ai.revalidate}
          </Button>
        </>
      )}
      {failed && !actions.codeFallback && (
        <span className="text-xs text-muted-foreground">{fr.ai.attempt(details.attempts + 1)}</span>
      )}
      {failed && block && (
        <span className="text-xs text-amber-600 dark:text-amber-400">{fr.ai.blocked[block]}</span>
      )}
      {failed && (
        <Button
          variant="agent"
          disabled={busy || !actions.canRetry || !ready || block !== null}
          onClick={() => onAct("retryComponentDraft")}
        >
          <Bot aria-hidden className="size-4" />
          {fr.ai.retry}
        </Button>
      )}
      {reviewing && (
        <Button disabled={busy} onClick={onReviewed}>
          {fr.ai.reviewed}
        </Button>
      )}
    </div>
  );
}
