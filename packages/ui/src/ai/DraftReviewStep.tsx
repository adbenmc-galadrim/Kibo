import { type ComponentDraftDetails, KiboError, MAX_DRAFT_REVISIONS } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kibo/sdk/ui/tabs";
import { MessageSquarePlus } from "lucide-react";
import { useRef, useState } from "react";
import { fr } from "../i18n/fr";
import { frCreations } from "../i18n/fr-creations";
import { isRemoteView } from "../lib/remote-view";
import { aiErrorMessage } from "./ai-error";
import { DraftDiffReview } from "./DraftDiffReview";
import { DraftPreview } from "./DraftPreview";
import { ReviseForm, type ReviseInput } from "./ReviseForm";
import { useAiAvailability } from "./use-ai-availability";

const t = frCreations.revise;
const reviseRefusals: Partial<Record<string, string>> = t.errors;

function reviseError(e: unknown): string {
  const known = e instanceof KiboError ? reviseRefusals[e.code] : undefined;
  return known ?? aiErrorMessage(e);
}

type Props = {
  details: ComponentDraftDetails;
  canRevise: boolean;
  busy: boolean;
  onRevise(input: ReviseInput): Promise<unknown>;
};

function ReviewTabs({ details }: { details: ComponentDraftDetails }) {
  const p = frCreations.preview;
  const manifest = details.manifest;
  if (!manifest || isRemoteView()) return <DraftDiffReview diff={details.diff} />;
  return (
    <Tabs defaultValue="diff">
      <TabsList aria-label={p.tabs}>
        <TabsTrigger value="diff">{p.diff}</TabsTrigger>
        <TabsTrigger value="preview">{p.preview}</TabsTrigger>
      </TabsList>
      <TabsContent value="diff">
        <DraftDiffReview diff={details.diff} />
      </TabsContent>
      <TabsContent value="preview">
        <DraftPreview draftId={details.id} manifest={manifest} />
      </TabsContent>
    </Tabs>
  );
}

export function DraftReviewStep({ details, canRevise, busy, onRevise }: Props) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { ready, block } = useAiAvailability("generateur");
  const submit = async (input: ReviseInput) => {
    setSending(true);
    setError(null);
    try {
      await onRevise(input);
    } catch (e) {
      setError(reviseError(e));
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="grid gap-3">
      <ReviewTabs details={details} />
      {canRevise && (
        <Collapsible open={open} onOpenChange={setOpen} className="grid gap-3">
          <CollapsibleTrigger asChild>
            <Button ref={trigger} variant="outline" className="justify-self-start" disabled={busy}>
              <MessageSquarePlus aria-hidden className="size-4" />
              {t.open}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="grid gap-2">
            <ReviseForm
              busy={busy || sending || !ready || block !== null}
              remaining={MAX_DRAFT_REVISIONS - details.revisions}
              onSubmit={(input) => void submit(input)}
              onCancel={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            />
            {block && <p className="text-xs text-amber-600 dark:text-amber-400">{fr.ai.blocked[block]}</p>}
          </CollapsibleContent>
        </Collapsible>
      )}
      {!canRevise && details.revisions >= MAX_DRAFT_REVISIONS && (
        <p className="text-xs text-muted-foreground">{t.exhausted}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
