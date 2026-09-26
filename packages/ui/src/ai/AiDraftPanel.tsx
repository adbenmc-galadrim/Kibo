import { type FinalizeComponentDraftInput, grantedOf } from "@kibo/schema";
import { Alert, AlertTitle } from "@kibo/sdk/ui/alert";
import { Skeleton } from "@kibo/sdk/ui/skeleton";
import { Info } from "lucide-react";
import { useRef, useState } from "react";
import { client } from "../api";
import type { Strategy } from "../components-page/PublishSections";
import { TrustDialog } from "../dialogs/TrustDialog";
import { fr } from "../i18n/fr";
import { aiErrorMessage } from "./ai-error";
import { DraftDiffReview } from "./DraftDiffReview";
import { DraftFailedStep } from "./DraftFailedStep";
import { DraftFooter } from "./DraftFooter";
import { DraftHeadline } from "./DraftHeadline";
import { DraftPublishStep } from "./DraftPublishStep";
import { DraftStepper } from "./DraftStepper";
import { draftActions, draftStep } from "./draft-flow";
import { GenerateStep } from "./GenerateStep";
import { useComponentDraft } from "./use-component-draft";

type Props = {
  draftId: string;
  target: FinalizeComponentDraftInput["target"];
  onDone: () => void;
};

export function AiDraftPanel({ draftId, target, onDone }: Props) {
  const { details, error, reload } = useComponentDraft(draftId);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>("update-all");
  const finished = useRef(false);

  const act = async (run: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await run();
      if (!finished.current) reload();
    } catch (e) {
      setActionError(aiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  if (!details) return <Skeleton className="h-48" />;
  const actions = draftActions(details);
  const publish = details.publish;
  const hash = publish?.hash ?? null;
  const review = (version: string, changes: string[]) =>
    act(() => client.rpc({ method: "reviewComponentDraft", draftId, version, changes }));
  const onReviewed = () => {
    if (details.mode === "modify") setReviewed(true);
    else void review(publish?.to ?? "0.1.0", []);
  };

  return (
    <div className="grid gap-4">
      <DraftHeadline details={details} reviewed={reviewed} exhausted={actions.codeFallback} />
      {details.status === "generating" && <GenerateStep draft={details} />}
      {details.status === "validating" && (
        <div className="grid gap-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      )}
      {details.status === "failed" && <DraftFailedStep details={details} exhausted={actions.codeFallback} />}
      {details.status === "review" && !reviewed && <DraftDiffReview diff={details.diff} />}
      {details.status === "review" && reviewed && (
        <DraftPublishStep
          details={details}
          busy={busy}
          onSubmit={({ version, changes, strategy: s }) => {
            setStrategy(s);
            void review(version, changes);
          }}
        />
      )}
      {details.status === "permissions" && !(hash && details.manifest) && (
        <Alert className="bg-muted/40">
          <Info aria-hidden />
          <AlertTitle>{fr.ai.permissionsUnavailable}</AlertTitle>
        </Alert>
      )}
      {details.status === "permissions" && publish && hash && details.manifest && (
        <TrustDialog
          open
          mode={target ? "approveAndAdd" : "approve"}
          target={{
            id: details.componentId,
            title: details.title,
            version: publish.to,
            hash,
            origin: "ai",
            permissions: grantedOf(details.manifest),
          }}
          onOpenChange={(o) => !o && finish()}
          approve={async (trust) => {
            const result = await client.rpc({
              method: "finalizeComponentDraft",
              draftId,
              version: publish.to,
              hash,
              trust,
              strategy,
              target,
            });
            return result.version;
          }}
          onApproved={finish}
        />
      )}
      <DraftStepper current={draftStep(details)} />
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}
      <DraftFooter
        details={details}
        actions={actions}
        busy={busy}
        reviewing={details.status === "review" && !reviewed}
        onAct={(method) => void act(() => client.rpc({ method, draftId }))}
        onReviewed={onReviewed}
        onAbandon={() =>
          void act(async () => {
            await client.rpc({ method: "abandonComponentDraft", draftId });
            finish();
          })
        }
      />
    </div>
  );
}
