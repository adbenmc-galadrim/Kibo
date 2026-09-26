import type { CommitInfo, PrInfo } from "@kibo/schema";
import { Alert, AlertDescription, AlertTitle } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
import { ArrowUpFromLine, CircleX, ExternalLink, GitPullRequest, LoaderCircle } from "lucide-react";
import { fr } from "../i18n/fr";
import { PrCard } from "./PrCard";
import { PushProgress } from "./PushProgress";
import type { PushFailure } from "./use-push";

type Props = {
  target: string;
  remote: string;
  branch: string | null;
  base: string | null;
  pending: CommitInfo[];
  canPush: boolean;
  upToDate: string | null;
  pushing: boolean;
  pushError: PushFailure | null;
  busy: boolean;
  pr: PrInfo | null;
  prTicketKey: string | null;
  prBlocked: string | null;
  canOpenPr: boolean;
  onPush(): void;
  onOpenPr(): void;
};

function PushFailed({ failure }: { failure: PushFailure }) {
  return (
    <>
      <Alert variant="destructive">
        <CircleX aria-hidden />
        <AlertTitle>{fr.commit.pushFailed}</AlertTitle>
        <AlertDescription>{failure.output ? fr.commit.pushFailedHelp : failure.message}</AlertDescription>
      </Alert>
      {failure.output && (
        <section aria-label={fr.commit.gitOutput}>
          <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs break-words whitespace-pre-wrap text-red-700 dark:text-red-400">
            {failure.output}
          </pre>
        </section>
      )}
    </>
  );
}

export function PushActions(p: Props) {
  if (p.pushing)
    return (
      <div className="mt-auto grid gap-3">
        <PushProgress command={fr.commit.pushCommand(p.remote, p.branch ?? "HEAD")} pending={p.pending} />
        <Button variant="outline" disabled>
          <LoaderCircle aria-hidden className="animate-spin" />
          {fr.commit.pushingTo(p.target)}
        </Button>
      </div>
    );
  return (
    <div className="mt-auto grid gap-3">
      {p.pr && p.branch && <PrCard pr={p.pr} branch={p.branch} base={p.base} ticketKey={p.prTicketKey} />}
      {p.pushError && <PushFailed failure={p.pushError} />}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Button variant="outline" disabled={p.busy || !p.canPush || p.upToDate !== null} onClick={p.onPush}>
          <ArrowUpFromLine aria-hidden />
          {p.pushError ? fr.commit.retry : fr.commit.push}
        </Button>
        {p.pr ? (
          <Button asChild>
            <a href={p.pr.url} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden />
              {fr.commit.viewPr(p.pr.number)}
            </a>
          </Button>
        ) : (
          <span title={p.prBlocked ?? undefined} className="grid">
            <Button disabled={p.busy || p.prBlocked !== null || !p.canOpenPr} onClick={p.onOpenPr}>
              <GitPullRequest aria-hidden />
              {fr.commit.pushAndPr}
            </Button>
          </span>
        )}
      </div>
      {p.upToDate && <p className="text-xs text-muted-foreground">{fr.commit.nothingToPush(p.upToDate)}</p>}
    </div>
  );
}
