import { type ExternalRef, type GithubPrRef, githubIssueState, type TicketView } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { CircleCheck, CircleDot, GitBranch, GitPullRequest, Unlink } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "../../i18n/fr";
import { frRefs } from "./fr-refs";

const t = fr.integrations.sheet;

function chip(href: string, title: string, icon: ReactNode, label: string) {
  return (
    <Badge key={href} variant="outline" className="font-mono" asChild>
      <a href={href} target="_blank" rel="noreferrer noopener" title={title}>
        {icon}
        <span>{label}</span>
      </a>
    </Badge>
  );
}

const isBroken = (ref: ExternalRef) =>
  ref.kind === "github_issue" &&
  ref.number !== null &&
  (githubIssueState(ref) === "broken" || ref.url === null);

const prTitle = (ref: GithubPrRef) =>
  ref.state === "merged" && ref.base !== null ? frRefs.mergedInto(ref.base) : fr.ticket.prState[ref.state];

function branchChip(branch: string, base: string | null) {
  return (
    <Badge
      key={`branch:${branch}`}
      variant="outline"
      className="font-mono"
      title={base ? frRefs.base(base) : frRefs.branch(branch)}
    >
      <GitBranch aria-hidden />
      <span>{branch}</span>
    </Badge>
  );
}

function refChip(ref: ExternalRef, done: boolean): ReactNode {
  if (ref.kind === "github_pr")
    return chip(ref.url, prTitle(ref), <GitPullRequest aria-hidden />, `#${ref.number}`);
  if (ref.kind === "git_branch") return branchChip(ref.branch, ref.base);
  if (ref.kind !== "github_issue" || ref.number === null) return null;
  if (isBroken(ref) || ref.url === null) {
    return (
      <Badge
        key={ref.bindingId}
        variant="outline"
        className="border-amber-500/50 text-amber-700 dark:text-amber-400"
        title={t.brokenHelp}
      >
        <Unlink aria-hidden />
        {t.broken}
      </Badge>
    );
  }
  const Icon = done ? CircleCheck : CircleDot;
  return chip(ref.url, t.openOnGithub, <Icon aria-hidden />, t.issue(ref.number));
}

const ORDER: Partial<Record<ExternalRef["kind"], number>> = { github_issue: 0, github_pr: 1, git_branch: 2 };
const order = (ref: ExternalRef) => ORDER[ref.kind] ?? 3;

export function GithubRefs({ ticket }: { ticket: TicketView }) {
  const chips = [...ticket.externalRefs]
    .sort((a, b) => order(a) - order(b))
    .map((ref) => refChip(ref, ticket.statusId === "done"))
    .filter((c) => c !== null);
  if (chips.length === 0) return null;
  return <span className="flex flex-wrap gap-1">{chips}</span>;
}

export function GithubLinkNote({ ticket }: { ticket: TicketView }) {
  if (!ticket.externalRefs.some(isBroken)) return null;
  return <p className="text-xs text-muted-foreground">{t.brokenHelp}</p>;
}
