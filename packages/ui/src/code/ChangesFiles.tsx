import type { FileChange, Worktree } from "@kibo/schema";
import { fr } from "../i18n/fr";
import { FileList, type FileSelection } from "./FileList";
import { WorktreePicker } from "./WorktreePicker";

type Props = {
  worktrees: Worktree[];
  current: Worktree;
  ahead: number;
  files: FileChange[] | null;
  selected: FileSelection | null;
  busy: boolean;
  onWorktreeChange(path: string): void;
  onSelect(file: FileChange): void;
  onToggle(file: FileChange): void;
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

export function ChangesFiles(p: Props) {
  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-auto border-r p-3">
      <WorktreePicker
        worktrees={p.worktrees}
        current={p.current}
        ahead={p.ahead}
        onChange={p.onWorktreeChange}
      />
      {p.files === null ? (
        <FilesPlaceholder />
      ) : p.files.length === 0 ? (
        <p className="px-2 text-sm text-muted-foreground">{fr.changes.clean}</p>
      ) : (
        <FileList
          files={p.files}
          selected={p.selected}
          busy={p.busy}
          onSelect={p.onSelect}
          onToggle={p.onToggle}
        />
      )}
    </aside>
  );
}
