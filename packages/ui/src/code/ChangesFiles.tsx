import type { FileChange, Worktree } from "@kibo/schema";
import type { ReactNode } from "react";
import { fr } from "../i18n/fr";
import { FileList, type FileSelection } from "./FileList";
import { WorktreePicker } from "./WorktreePicker";

type Props = {
  worktrees: Worktree[];
  current: Worktree;
  ahead: number;
  files: FileChange[] | null;
  branch?: ReactNode;
  branchHasWork?: boolean;
  selected: FileSelection | null;
  busy: boolean;
  readOnly: boolean;
  onWorktreeChange(path: string): void;
  onSelect(file: FileChange): void;
  onToggle(file: FileChange): void;
  onOpenInTab(file: FileChange): void;
  onOpenExternal(file: FileChange): void;
  onCopyPath(file: FileChange): void;
  onDiscard(file: FileChange): void;
  onStageAll(): void;
  onUnstageAll(): void;
};

const PLACEHOLDER_ROWS = ["w-3/4", "w-2/3", "w-4/5"];

function FilesPlaceholder() {
  return (
    <section aria-label={fr.changes.loading} aria-busy="true" className="grid gap-2 px-2 pt-1">
      {PLACEHOLDER_ROWS.map((width) => (
        <div key={width} className={`h-9 animate-pulse rounded-md bg-muted ${width}`} />
      ))}
    </section>
  );
}

export function ChangesFiles({
  worktrees,
  current,
  ahead,
  files,
  branch,
  branchHasWork,
  onWorktreeChange,
  ...list
}: Props) {
  return (
    <aside className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 lg:border-r">
      <WorktreePicker worktrees={worktrees} current={current} ahead={ahead} onChange={onWorktreeChange} />
      {files === null ? (
        <FilesPlaceholder />
      ) : files.length === 0 ? (
        <p className="px-2 text-sm text-muted-foreground">
          {branchHasWork ? fr.changes.cleanUncommitted : fr.changes.clean}
        </p>
      ) : (
        <FileList files={files} {...list} />
      )}
      {branch}
    </aside>
  );
}
