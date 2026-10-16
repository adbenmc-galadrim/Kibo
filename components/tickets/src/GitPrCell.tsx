import { branchRefOf, type CiTone, type ExternalRef, type GithubPrRef, type TicketView } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import {
  CircleCheck,
  CircleDashed,
  CircleX,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Link,
} from "lucide-react";
import { BranchIcon } from "./BranchIcon";
import { TEXT_12 } from "./columns";
import { fr } from "./fr";

type Props = { ticket: Pick<TicketView, "externalRefs" | "waitingOn">; ci: CiTone | null };

const latestPr = (refs: readonly ExternalRef[]): GithubPrRef | null =>
  refs.filter((r): r is GithubPrRef => r.kind === "github_pr").at(-1) ?? null;

const PR_ICON = {
  open: GitPullRequest,
  draft: GitPullRequest,
  merged: GitMerge,
  closed: GitPullRequestClosed,
};
const PR_COLOR = {
  open: "text-(--tracking-purple)",
  draft: "text-(--tracking-dim)",
  merged: "text-(--tracking-green)",
  closed: "text-(--tracking-red)",
};
const CI_ICON = { ok: CircleCheck, error: CircleX, running: CircleDashed, neutral: CircleDashed };
const CI_COLOR = {
  ok: "text-(--tracking-green)",
  error: "text-(--tracking-red)",
  running: "text-(--tracking-amber)",
  neutral: "text-(--tracking-dim)",
};

const ROW = "flex min-w-0 items-center gap-[5px]";

function PrLine({ pr, ci }: { pr: GithubPrRef; ci: CiTone | null }) {
  const Icon = PR_ICON[pr.state];
  const state = fr.git.prState(pr.state);
  const Mark = ci === null ? null : CI_ICON[ci];
  return (
    <span className={ROW}>
      <Icon
        absoluteStrokeWidth
        size={13}
        aria-hidden
        className={cn("size-[13px] shrink-0", PR_COLOR[pr.state])}
      />
      <span className={cn("font-mono text-(--tracking-fg)", TEXT_12)}>{fr.git.pr(pr.number)}</span>
      {state && <span className={cn("truncate text-(--tracking-dim)", TEXT_12)}>{state}</span>}
      {Mark && ci && (
        <Mark
          absoluteStrokeWidth
          size={12}
          role="img"
          aria-label={fr.git.ci[ci]}
          className={cn("size-3 shrink-0", CI_COLOR[ci])}
        />
      )}
    </span>
  );
}

export function GitPrCell({ ticket, ci }: Props) {
  const pr = latestPr(ticket.externalRefs);
  if (pr) return <PrLine pr={pr} ci={ci} />;
  const branch = branchRefOf(ticket.externalRefs);
  if (branch)
    return (
      <span className={ROW}>
        <BranchIcon
          absoluteStrokeWidth
          size={13}
          aria-hidden
          className="size-[13px] shrink-0 text-(--tracking-blue)"
        />
        <span className={cn("truncate font-mono text-(--tracking-fg)", TEXT_12)}>{branch.branch}</span>
      </span>
    );
  if (ticket.waitingOn.length > 0)
    return (
      <span className={ROW}>
        <Link absoluteStrokeWidth size={12} aria-hidden className="size-3 shrink-0 text-(--tracking-dim)" />
        <span className={cn("truncate text-(--tracking-dim)", TEXT_12)}>
          {fr.git.waiting(ticket.waitingOn)}
        </span>
      </span>
    );
  return <span className={cn("text-(--tracking-dim)", TEXT_12)}>{fr.none}</span>;
}
