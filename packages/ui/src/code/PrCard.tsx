import type { PrInfo, ProjectSnapshot, PrState } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { GitPullRequest } from "lucide-react";
import { useId } from "react";
import { fr } from "../i18n/fr";

const STATE_TONE: Record<PrState, string> = {
  open: "text-emerald-600 dark:text-emerald-400",
  draft: "text-muted-foreground",
  merged: "text-violet-600 dark:text-violet-400",
  closed: "text-red-600 dark:text-red-400",
};

type Props = { pr: PrInfo; branch: string; base: string | null; ticketKey: string | null };

export function linkedTicketKey(tickets: ProjectSnapshot["tickets"], pr: PrInfo | null): string | null {
  if (!pr) return null;
  const linked = tickets.find((t) => t.externalRefs.some((r) => r.kind === "github_pr" && r.url === pr.url));
  return linked?.key ?? null;
}

export function PrCard({ pr, branch, base, ticketKey }: Props) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid gap-1.5 rounded-lg border bg-muted/40 p-3">
      <h3 id={id} className="flex items-center gap-2 text-sm font-semibold">
        <GitPullRequest aria-hidden className={cn("size-4 shrink-0", STATE_TONE[pr.state])} />
        {fr.commit.prCard(pr.number, fr.ticket.prState[pr.state])}
      </h3>
      <p className="text-xs text-muted-foreground">{fr.commit.prCardDetail(branch, base, ticketKey)}</p>
    </section>
  );
}
