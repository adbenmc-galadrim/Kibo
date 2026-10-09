import {
  type DraftStatus,
  type FinalizeComponentDraftInput,
  grantedOf,
  MAX_DRAFT_REVISIONS,
} from "@kibo/schema";
import { Alert, AlertTitle } from "@kibo/sdk/ui/alert";
import { Skeleton } from "@kibo/sdk/ui/skeleton";
import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { client } from "../api";
import type { Strategy } from "../components-page/PublishSections";
import { useReportApproval } from "../dialogs/approval-scope";
import { TrustDialog } from "../dialogs/TrustDialog";
import { fr } from "../i18n/fr";
import { frCreations } from "../i18n/fr-creations";
import { aiErrorMessage } from "./ai-error";
import { DraftFailedStep } from "./DraftFailedStep";
import { DraftFooter } from "./DraftFooter";
import { DraftHeadline } from "./DraftHeadline";
import { DraftPublishStep } from "./DraftPublishStep";
import { DraftReviewStep } from "./DraftReviewStep";
import { DraftStepper } from "./DraftStepper";
import { draftActions, draftStep } from "./draft-flow";
import { GenerateStep } from "./GenerateStep";
import { useComponentDraft } from "./use-component-draft";

type Props = {
  draftId: string;
  target: FinalizeComponentDraftInput["target"];
  onDone: () => void;
  onStatus?: (status: DraftStatus) => void;
};

export function AiDraftPanel({ draftId, target, onDone, onStatus }: Props) {
  const { details, error, reload } = useComponentDraft(draftId);
  const status = details?.status ?? null;
  const reportStatus = useRef(onStatus);
  reportStatus.current = onStatus;
  useEffect(() => {
    if (status) reportStatus.current?.(status);
  }, [status]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>("update-all");
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    if (status !== "generating") return;
    setRefused(false);
    setReviewed(false);
  }, [status]);
  const revisions = details?.revisions ?? 0;
  const [seenRevisions, setSeenRevisions] = useState(revisions);
  if (seenRevisions !== revisions) {
    setSeenRevisions(revisions);
    setRefused(false);
    setReviewed(false);
  }
  const finished = useRef(false);
  const reviewedButton = useRef<HTMLButtonElement>(null);
  const approval =
    details?.status === "permissions" && details.publish?.hash && details.manifest && !refused
      ? { publish: details.publish, hash: details.publish.hash, manifest: details.manifest }
      : null;
  useReportApproval(approval !== null);

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
  if (!details) return <Skeleton role="status" aria-label={fr.lazy.loading} className="h-48" />;
  const actions = draftActions(details);
  const publish = details.publish;
  const hash = publish?.hash ?? null;
  const review = (version: string, changes: string[]) =>
    act(() => client.rpc({ method: "reviewComponentDraft", draftId, version, changes }));
  const onReviewed = () => {
    if (refused) setRefused(false);
    else if (details.mode === "modify") setReviewed(true);
    else void review(publish?.to ?? "0.1.0", []);
  };

  return (
    <div className="grid gap-4">
      <DraftHeadline details={details} reviewed={reviewed} exhausted={actions.codeFallback} />
      {details.status === "generating" && <GenerateStep draft={details} />}
      {details.revisions > 0 && (details.status === "generating" || details.status === "validating") && (
        <p className="text-xs text-muted-foreground">
          {frCreations.revise.progress(details.revisions, MAX_DRAFT_REVISIONS)}
        </p>
      )}
      {details.status === "validating" && (
        <output aria-label={fr.ai.validating} className="grid gap-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </output>
      )}
      {details.status === "failed" && <DraftFailedStep details={details} exhausted={actions.codeFallback} />}
      {((details.status === "review" && !reviewed) || refused) && (
        <DraftReviewStep
          details={details}
          canRevise={actions.canRevise}
          busy={busy}
          onRevise={async ({ feedback, attachments }) => {
            await client.rpc({ method: "reviseComponentDraft", draftId, feedback, attachments });
            if (!finished.current) reload();
          }}
        />
      )}
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
      {approval && (
        <TrustDialog
          open
          mode={target ? "approveAndAdd" : "approve"}
          target={{
            id: details.componentId,
            title: details.title,
            version: approval.publish.to,
            hash: approval.hash,
            origin: "ai",
            permissions: grantedOf(approval.manifest),
            embeds: approval.manifest.embeds,
          }}
          onOpenChange={(o) => !o && !finished.current && setRefused(true)}
          onCloseAutoFocus={(e) => {
            if (finished.current) return;
            e.preventDefault();
            reviewedButton.current?.focus();
          }}
          approve={async (trust) => {
            const result = await client.rpc({
              method: "finalizeComponentDraft",
              draftId,
              version: approval.publish.to,
              hash: approval.hash,
              trust,
              strategy,
              target,
            });
            return result.version;
          }}
          onApproved={finish}
        />
      )}
      <DraftStepper current={draftStep(details)} mode={details.mode} />
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}
      <DraftFooter
        details={details}
        actions={actions}
        busy={busy}
        reviewing={(details.status === "review" && !reviewed) || refused}
        reviewedRef={reviewedButton}
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
