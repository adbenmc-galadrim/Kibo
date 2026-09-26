import type { RunState, StatusId } from "@kibo/schema";
import { cn } from "./lib/utils";

const DOT: Record<StatusId, string> = {
  backlog: "border-[1.5px] border-zinc-500 bg-transparent dark:border-zinc-400",
  todo: "bg-zinc-500 dark:bg-zinc-400",
  in_progress: "bg-blue-600 dark:bg-blue-500",
  in_review: "bg-purple-600 dark:bg-purple-500",
  blocked: "bg-red-600 dark:bg-red-500",
  done: "bg-green-600 dark:bg-green-500",
};

export const statusDotClass = (statusId: StatusId): string => DOT[statusId];

export function StatusDot({ statusId, className }: { statusId: StatusId; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2 shrink-0 rounded-full", statusDotClass(statusId), className)}
    />
  );
}

const RUN_DOT: Record<RunState, string> = {
  queued: "bg-cyan-500",
  starting: "bg-blue-500",
  running: "bg-blue-500",
  waiting_input: "bg-amber-500",
  done: "bg-green-600 dark:bg-green-500",
  failed: "bg-red-600 dark:bg-red-500",
  cancelled: "bg-zinc-400 dark:bg-zinc-500",
};

export const RUN_TEXT: Record<RunState, string> = {
  queued: "text-cyan-700 dark:text-cyan-400",
  starting: "text-blue-600 dark:text-blue-400",
  running: "text-blue-600 dark:text-blue-400",
  waiting_input: "text-amber-700 dark:text-amber-400",
  done: "text-green-700 dark:text-green-400",
  failed: "text-red-600 dark:text-red-400",
  cancelled: "text-muted-foreground",
};

export function RunDot({ state, className }: { state: RunState; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-state={state}
      className={cn("inline-block size-2 shrink-0 rounded-full", RUN_DOT[state], className)}
    />
  );
}
