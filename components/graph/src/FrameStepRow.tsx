import { isActiveT3Status, type OnHold, type ProjectInfo, type T3Thread } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { LaunchInT3Button, ThreadPill, useMinuteClock } from "@kibo/sdk/t3";
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
      className={cn("size-2.5 shrink-0", tone === "todo" ? RING_CLASS : cn("rounded-full", DOT_BG[tone]))}
    />
  );
}

function HoldMark({ hold }: { hold: OnHold }) {
  const label =
    hold.source === "own" ? fr.sprints.hold.own(hold.reason) : fr.sprints.hold.dependency(hold.key);
  return (
    <Pause
      size={15}
      absoluteStrokeWidth
      role="img"
      aria-label={label}
      className="shrink-0 text-(--tracking-hold)"
    >
      <title>{label}</title>
    </Pause>
  );
}

export type LaunchProject = Pick<ProjectInfo, "id" | "hasFolder">;

type Props = { step: LaneStep; onOpen(id: string): void; project?: LaunchProject | null };

const REVEAL_CLASS =
  "pointer-events-none absolute inset-y-0 right-1 flex items-center opacity-0 group-hover/step:pointer-events-auto group-hover/step:opacity-100 group-focus-within/step:pointer-events-auto group-focus-within/step:opacity-100";

const TITLE_ROOM_CLASS = "group-hover/step:pr-[120px] group-focus-within/step:pr-[120px]";

const activeThread = (step: LaneStep): T3Thread | null =>
  step.thread !== null && isActiveT3Status(step.thread.status) ? step.thread : null;

function StepThreadPill({ thread }: { thread: T3Thread }) {
  return <ThreadPill thread={thread} now={useMinuteClock()} />;
}

const rowBorder = (step: LaneStep): string => {
  const thread = activeThread(step);
  if (thread !== null)
    return thread.status === "waiting" ? "border-(--tracking-amber)" : "border-(--tracking-brand-line)";
  if (step.session) return "border-(--tracking-brand-line)";
  return step.startable ? "border-(--tracking-green)" : "border-(--tracking-border)";
};

export function FrameStepRow({ step, onOpen, project = null }: Props) {
  const thread = activeThread(step);
  const launchable = step.startable && thread === null && project !== null;
  const Icon = step.git === null || thread !== null ? null : GIT_ICON[step.git.kind];
  return (
    <li
      data-session={step.session ? "true" : undefined}
      data-startable={step.startable ? "true" : undefined}
      className={cn("group/step relative h-7 rounded-[6px] border bg-(--tracking-card)", rowBorder(step))}
    >
      <button
        type="button"
        title={step.key}
        onClick={() => onOpen(step.ticketId)}
        className={cn(
          "flex size-full cursor-pointer items-center gap-1.5 rounded-[5px] px-[7px] text-left",
          launchable && TITLE_ROOM_CLASS,
        )}
      >
        <StepDot tone={step.tone} />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[11.5px] leading-[14px]",
            step.tone === "done" ? "text-(--tracking-dim)" : "text-(--tracking-fg)",
          )}
        >
          {step.title}
        </span>
        {step.session && thread === null && (
          <span
            role="img"
            aria-label={fr.sprints.session}
            className="size-1.5 shrink-0 rounded-full bg-(--tracking-brand)"
          />
        )}
        {step.hold !== null && thread === null && <HoldMark hold={step.hold} />}
        {thread !== null && <StepThreadPill thread={thread} />}
        {Icon !== null && step.git !== null && (
          <Icon
            size={15}
            absoluteStrokeWidth
            aria-label={fr.sprints.git[step.git.kind]}
            className={cn("shrink-0", GIT_TEXT[step.git.tone])}
          />
        )}
      </button>
      {launchable && (
        <span className={REVEAL_CLASS}>
          <LaunchInT3Button
            projectId={project.id}
            ticketKey={step.key}
            done={false}
            thread={null}
            folderMissing={!project.hasFolder}
            size="2xs"
          />
        </span>
      )}
    </li>
  );
}
