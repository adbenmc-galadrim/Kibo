import {
  branchRefOf,
  type CiRun,
  type CiTone,
  type GithubPrRef,
  liveReview,
  type OnHold,
  prCiTone,
  type Question,
  questionLabel,
  type TicketView,
  worstCiTone,
} from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import {
  CircleCheck,
  CircleX,
  GitBranch,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Lock,
  type LucideIcon,
  Pause,
} from "lucide-react";
import { fr } from "./fr";
import { ticketPr } from "./ticket-pr";

export const BADGE_CLASS =
  "inline-flex h-[18px] max-w-full items-center gap-1 rounded-[4px] px-1.5 text-[11px] font-medium leading-none";
const OUTLINED = cn(BADGE_CLASS, "border border-(--tracking-border) text-(--tracking-mfg)");

const PR_ICON: Record<GithubPrRef["state"], { icon: LucideIcon; tone: string }> = {
  open: { icon: GitPullRequest, tone: "text-(--tracking-purple)" },
  draft: { icon: GitPullRequest, tone: "text-(--tracking-dim)" },
  merged: { icon: GitMerge, tone: "text-(--tracking-green)" },
  closed: { icon: GitPullRequestClosed, tone: "text-(--tracking-red)" },
};

function PrBadge({ number, state }: { number: number; state: GithubPrRef["state"] }) {
  const { icon: Icon, tone } = PR_ICON[state];
  return (
    <span data-pr={state} className={OUTLINED}>
      <Icon absoluteStrokeWidth size={11} aria-hidden className={cn("size-[11px] shrink-0", tone)} />
      <span className="font-mono text-(--tracking-fg)">{`#${number}`}</span>
    </span>
  );
}

function CiMark({ tone }: { tone: CiTone }) {
  const mark = "size-[11px] shrink-0";
  if (tone === "error")
    return <CircleX role="img" aria-label={fr.ci.error} absoluteStrokeWidth size={11} className={mark} />;
  if (tone === "ok")
    return (
      <CircleCheck
        role="img"
        aria-label={fr.ci.ok}
        absoluteStrokeWidth
        size={11}
        className={cn(mark, "text-(--tracking-green)")}
      />
    );
  return (
    <span
      role="img"
      aria-label={fr.ci[tone]}
      className={cn(
        "size-[9px] shrink-0 rounded-full border-2",
        tone === "running" ? "border-(--tracking-amber)" : "border-(--tracking-dim)",
      )}
    />
  );
}

function CiBadge({ tone }: { tone: CiTone }) {
  const broken = tone === "error";
  return (
    <span
      data-ci={tone}
      className={cn(broken ? cn(BADGE_CLASS, "bg-(--tracking-red-soft) text-(--tracking-red)") : OUTLINED)}
    >
      <CiMark tone={tone} />
      {fr.ciShort[tone]}
    </span>
  );
}

function ChangesBadge() {
  return (
    <span
      role="note"
      aria-label={fr.changesRequested}
      title={fr.changesRequested}
      className={cn(BADGE_CLASS, "whitespace-nowrap bg-(--tracking-amber-soft) text-(--tracking-amber)")}
    >
      <span aria-hidden className="@max-[144px]/card:hidden">
        {fr.changesRequested}
      </span>
      <span aria-hidden className="hidden @max-[144px]/card:inline">
        {fr.changesShort}
      </span>
    </span>
  );
}

function BranchBadge({ name }: { name: string }) {
  return (
    <span role="note" aria-label={fr.branch(name)} title={name} className={OUTLINED}>
      <GitBranch absoluteStrokeWidth size={11} aria-hidden className="size-[11px] shrink-0" />
      <span className="truncate font-mono text-(--tracking-fg)">{name}</span>
    </span>
  );
}

type Props = { ticket: Pick<TicketView, "externalRefs">; ciRuns: readonly CiRun[] };

export function CardBadges({ ticket, ciRuns }: Props) {
  const pr = ticketPr(ticket);
  const tone = (pr === null ? null : prCiTone(pr, ciRuns)) ?? worstCiTone(ciRuns);
  const latestRun = [...ciRuns].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const number = pr?.number ?? latestRun?.prNumber ?? null;
  const changes = pr !== null && liveReview(pr) === "changes_requested";
  const branch = branchRefOf(ticket.externalRefs);
  return (
    <>
      {number !== null && <PrBadge number={number} state={pr?.state ?? "open"} />}
      {changes && <ChangesBadge />}
      {pr === null && branch !== null && <BranchBadge name={branch.branch} />}
      {tone !== null && <CiBadge tone={tone} />}
    </>
  );
}

export function BlockedBadge({ question }: { question: Pick<Question, "number" | "importRef"> | null }) {
  return (
    <span className={cn(BADGE_CLASS, "bg-(--tracking-red-soft) text-(--tracking-red)")}>
      <Lock absoluteStrokeWidth size={11} aria-hidden className="size-[11px] shrink-0" />
      {question === null ? fr.blocked : fr.blockedBy(questionLabel(question))}
    </span>
  );
}

export function OptionalBadge() {
  return (
    <span
      className={cn(BADGE_CLASS, "border border-dashed border-(--tracking-border) text-(--tracking-mfg)")}
    >
      {fr.optional}
    </span>
  );
}

export function HeldBadge({ hold }: { hold: OnHold }) {
  const own = hold.source === "own";
  return (
    <span
      role="note"
      aria-label={own ? fr.hold.own(hold.reason) : fr.hold.dependency(hold.key)}
      title={own ? hold.reason : undefined}
      className={cn(BADGE_CLASS, "border border-dashed border-(--tracking-border) text-(--tracking-mfg)")}
    >
      <Pause absoluteStrokeWidth size={12} aria-hidden className="size-3 shrink-0" />
      <span className="truncate">{own ? fr.hold.short(hold.reason) : fr.hold.by(hold.key)}</span>
    </span>
  );
}
