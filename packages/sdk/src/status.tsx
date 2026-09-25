import type { StatusId } from "@kibo/schema";
import { cn } from "./lib/utils";

const DOT: Record<StatusId, string> = {
  backlog: "border-[1.5px] border-zinc-500 bg-transparent dark:border-zinc-400",
  todo: "bg-zinc-500 dark:bg-zinc-400",
  in_progress: "bg-blue-600 dark:bg-blue-500",
  in_review: "bg-purple-600 dark:bg-purple-500",
  blocked: "bg-red-600 dark:bg-red-500",
  done: "bg-green-600 dark:bg-green-500",
};

export function StatusDot({ statusId, className }: { statusId: StatusId; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2 shrink-0 rounded-full", DOT[statusId], className)}
    />
  );
}
