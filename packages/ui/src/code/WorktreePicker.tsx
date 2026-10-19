import type { Worktree } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Check, ChevronDown, GitBranch } from "lucide-react";
import { frChanges } from "../i18n/fr-changes";

type Props = { worktrees: Worktree[]; current: Worktree; ahead: number; onChange(path: string): void };

const labelOf = (w: Worktree) => frChanges.changes.worktree(w.branch ?? frChanges.changes.detached);

export function WorktreePicker({ worktrees, current, ahead, onChange }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2 font-mono text-sm">
          <GitBranch aria-hidden />
          <span className="truncate">{labelOf(current)}</span>
          <ChevronDown aria-hidden className="size-3.5" />
          {ahead > 0 && <span className="ml-auto text-orange-600 dark:text-orange-400">↑{ahead}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel>{frChanges.changes.worktreePicker}</DropdownMenuLabel>
        {worktrees.map((w) => (
          <DropdownMenuItem key={w.path} onSelect={() => onChange(w.path)}>
            {w.path === current.path ? <Check /> : <span className="size-4" />}
            <span className="flex min-w-0 flex-col">
              <span className="font-mono text-sm">{labelOf(w)}</span>
              <span className="truncate text-xs text-muted-foreground">{w.path}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
