import type { FileChange, FileDiff } from "@kibo/schema";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { DiffEditorPane } from "./DiffEditorPane";
import { DiffToolbar } from "./DiffToolbar";
import { type DiffMode, DiffView } from "./DiffView";

type Props = {
  projectId: string;
  worktree: string;
  file: FileChange | null;
  diff: FileDiff | null;
  mode: DiffMode;
  onModeChange(mode: DiffMode): void;
  busy: boolean;
  onHunk(index: number, header: string): void;
  onOpenFile(line: number | null): void;
  onOpenExternal(line: number | null): void;
  onSaved(): void;
};

export function DiffColumn({ file, diff, ...p }: Props) {
  const [editing, setEditing] = useState(false);
  if (!file || !diff) return <p className="p-8 text-sm text-muted-foreground">{fr.changes.noSelection}</p>;
  const canEdit = file.area === "unstaged" && file.kind !== "deleted" && !diff.binary;
  const line = diff.hunks[0]?.newStart ?? null;
  return (
    <>
      <DiffToolbar
        path={file.path}
        additions={diff.additions}
        deletions={diff.deletions}
        mode={p.mode}
        onModeChange={p.onModeChange}
        editing={editing && canEdit}
        onEditingChange={setEditing}
        canEdit={canEdit}
        onOpenFile={() => p.onOpenFile(line)}
        onOpenExternal={() => p.onOpenExternal(line)}
      />
      {editing && canEdit ? (
        <DiffEditorPane
          projectId={p.projectId}
          worktree={p.worktree}
          path={file.path}
          layout={p.mode}
          onSaved={p.onSaved}
        />
      ) : (
        <DiffView diff={diff} area={file.area} mode={p.mode} busy={p.busy} onHunk={p.onHunk} />
      )}
    </>
  );
}
