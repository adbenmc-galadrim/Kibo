import type { OnHold } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { GitBranch, GitMerge, GitPullRequest, type LucideIcon, Pause } from "lucide-react";
import { fr } from "./fr";
import type { GitMark, LaneStep, StepTone } from "./sprint-lanes";

const DOT_BG: Record<Exclude<StepTone, "todo">, string> = {
  done: "bg-(--tracking-green)",
  review: "bg-(--tracking-purple)",
  progress: "bg-(--tracking-blue)",
  blocked: "bg-(--tracking-red)",
  hold: "bg-(--tracking-hold)",
};

export const RING_CLASS = "rounded-full border-[1.5px] border-(--tracking-dim)";

const GIT_ICON: Record<GitMark["kind"], LucideIcon> = {
  merged: GitMerge,
  pr: GitPullRequest,
  branch: GitBranch,
};

const GIT_TEXT: Record<GitMark["tone"], string> = {
  green: "text-(--tracking-green)",
  purple: "text-(--tracking-purple)",
  amber: "text-(--tracking-amber)",
  blue: "text-(--tracking-blue)",
  dim: "text-(--tracking-dim)",
};

function StepDot({ tone }: { tone: StepTone }) {
  return (
    <span
      aria-hidden
      data-tone={tone}
      className={cn("size-[7px] shrink-0", tone === "todo" ? RING_CLASS : cn("rounded-full", DOT_BG[tone]))}
    />
  );
}

function HoldMark({ hold }: { hold: OnHold }) {
  const label =
    hold.source === "own" ? fr.sprints.hold.own(hold.reason) : fr.sprints.hold.dependency(hold.key);
  return (
    <Pause
      size={11}
      absoluteStrokeWidth
      role="img"
      aria-label={label}
      className="shrink-0 text-(--tracking-hold)"
    >
      <title>{label}</title>
    </Pause>
  );
}

type Props = { step: LaneStep; onOpen(id: string): void };

const rowBorder = (step: LaneStep): string => {
  if (step.session) return "border-(--tracking-brand-line)";
  return step.startable ? "border-(--tracking-green)" : "border-(--tracking-border)";
};

export function FrameStepRow({ step, onOpen }: Props) {
  const Icon = step.git === null ? null : GIT_ICON[step.git.kind];
  return (
    <li
      data-session={step.session ? "true" : undefined}
      data-startable={step.startable ? "true" : undefined}
      className={cn(
        "flex h-6 items-center gap-1.5 rounded-[6px] border bg-(--tracking-card) px-2",
        rowBorder(step),
      )}
    >
      <StepDot tone={step.tone} />
      <button
        type="button"
        title={step.key}
        onClick={() => onOpen(step.ticketId)}
        className={cn(
          "min-w-0 flex-1 cursor-pointer truncate text-left text-[11.5px] leading-[14px]",
          step.tone === "done" ? "text-(--tracking-dim)" : "text-(--tracking-fg)",
        )}
      >
        {step.title}
      </button>
      {step.session && (
        <span
          role="img"
          aria-label={fr.sprints.session}
          className="size-1.5 shrink-0 rounded-full bg-(--tracking-brand)"
        />
      )}
      {step.hold !== null && <HoldMark hold={step.hold} />}
      {Icon !== null && step.git !== null && (
        <Icon
          size={11}
          absoluteStrokeWidth
          aria-label={fr.sprints.git[step.git.kind]}
          className={cn("shrink-0", GIT_TEXT[step.git.tone])}
        />
      )}
    </li>
  );
}
