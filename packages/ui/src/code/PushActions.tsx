import type { PrInfo } from "@kibo/schema";
import { Alert, AlertDescription, AlertTitle } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
import { ArrowUpFromLine, CircleX, ExternalLink, GitPullRequest, LoaderCircle } from "lucide-react";
import { fr } from "../i18n/fr";

type Props = {
  target: string;
  canPush: boolean;
  upToDate: string | null;
  pushing: boolean;
  pushError: string | null;
  busy: boolean;
  pr: PrInfo | null;
  prBlocked: string | null;
  canOpenPr: boolean;
  onPush(): void;
  onOpenPr(): void;
};

export function PushActions(p: Props) {
  if (p.pushing)
    return (
      <div className="mt-auto grid">
        <Button variant="outline" disabled>
          <LoaderCircle aria-hidden className="animate-spin" />
          {fr.commit.pushingTo(p.target)}
        </Button>
      </div>
    );
  return (
    <div className="mt-auto grid gap-3">
      {p.pushError && (
        <Alert variant="destructive">
          <CircleX aria-hidden />
          <AlertTitle>{fr.commit.pushFailed}</AlertTitle>
          <AlertDescription>{p.pushError}</AlertDescription>
        </Alert>
      )}
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
