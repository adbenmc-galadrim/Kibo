import { type GithubPrRef, type OnHold, type Question, questionLabel } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import {
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Hourglass,
  Lock,
  type LucideIcon,
  Pause,
} from "lucide-react";
import type { CardSignal } from "./card-signal";
import { fr } from "./fr";

const BADGE_CLASS =
  "inline-flex h-[18px] max-w-full items-center gap-1 rounded-[4px] px-1.5 text-[11px] font-medium leading-none";
const OUTLINED = cn(BADGE_CLASS, "border border-(--tracking-border) text-(--tracking-mfg)");

const PR_ICON: Record<GithubPrRef["state"], LucideIcon> = {
  open: GitPullRequest,
  draft: GitPullRequest,
  merged: GitMerge,
  closed: GitPullRequestClosed,
};

export function PrBadge({ pr }: { pr: Pick<GithubPrRef, "number" | "state"> }) {
  const Icon = PR_ICON[pr.state];
  return (
    <span data-pr={pr.state} className={OUTLINED}>
      <Icon absoluteStrokeWidth size={11} aria-hidden className="size-[11px] shrink-0" />
      <span className="font-mono text-(--tracking-fg)">{`#${pr.number}`}</span>
    </span>
  );
}

function ChangesBadge() {
  return (
    <span
      role="note"
      data-card-signal="changes"
      aria-label={fr.changesRequested}
      title={fr.changesRequested}
      className={cn(BADGE_CLASS, "whitespace-nowrap bg-(--tracking-amber-soft) text-(--tracking-amber)")}
    >
      <GitPullRequest absoluteStrokeWidth size={11} aria-hidden className="size-[11px] shrink-0" />
      <span aria-hidden className="@max-[144px]/card:hidden">
        {fr.changesRequested}
      </span>
      <span aria-hidden className="hidden @max-[144px]/card:inline">
        {fr.changesShort}
      </span>
    </span>
  );
}

function BlockedBadge({ question }: { question: Pick<Question, "number" | "importRef"> | null }) {
  return (
    <span
      data-card-signal="blocked"
      className={cn(BADGE_CLASS, "bg-(--tracking-red-soft) text-(--tracking-red)")}
    >
      <Lock absoluteStrokeWidth size={11} aria-hidden className="size-[11px] shrink-0" />
      {question === null ? fr.blocked : fr.blockedBy(questionLabel(question))}
    </span>
  );
}

function HeldBadge({ hold }: { hold: OnHold }) {
  const own = hold.source === "own";
  return (
    <span
      role="note"
      data-card-signal="held"
      aria-label={own ? fr.hold.own(hold.reason) : fr.hold.dependency(hold.key)}
      title={own ? hold.reason : undefined}
      className={cn(BADGE_CLASS, "bg-(--tracking-hold-soft) text-(--tracking-hold)")}
    >
      <Pause absoluteStrokeWidth size={12} aria-hidden className="size-3 shrink-0" />
      <span className="truncate">{own ? fr.hold.short(hold.reason) : fr.hold.by(hold.key)}</span>
    </span>
  );
}

function WaitingBadge({ keys }: { keys: readonly string[] }) {
  const text = fr.waitingOn(keys.join(", "));
  return (
    <span data-card-signal="waiting" title={text} className={OUTLINED}>
      <Hourglass absoluteStrokeWidth size={11} aria-hidden className="size-[11px] shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  );
}

export function SignalBadge({ signal }: { signal: CardSignal }) {
  if (signal.kind === "blocked") return <BlockedBadge question={signal.question} />;
  if (signal.kind === "changes") return <ChangesBadge />;
  if (signal.kind === "held") return <HeldBadge hold={signal.hold} />;
  return <WaitingBadge keys={signal.keys} />;
}
