import type { ChangeArea, FileChange, FileDiff } from "@kibo/schema";
import { useState } from "react";
import { useWrap } from "../files/wrap-pref";
import { fr } from "../i18n/fr";
import { DiffEditorPane } from "./DiffEditorPane";
import { DiffToolbar } from "./DiffToolbar";
import { type DiffMode, DiffView } from "./DiffView";

type Props = {
  projectId: string;
  worktree: string;
  file: (Pick<FileChange, "path" | "kind"> & { area: ChangeArea | null }) | null;
  diff: FileDiff | null;
  mode: DiffMode;
  onModeChange(mode: DiffMode): void;
  busy: boolean;
  readOnly: boolean;
  onHunk(index: number, header: string): void;
  onOpenFile(line: number | null): void;
  onOpenExternal(line: number | null): void;
  onSaved(): void;
};

export function DiffColumn({ file, diff, ...p }: Props) {
  const [editing, setEditing] = useState(false);
  const [wrap, setWrap] = useWrap();
  if (!file || !diff) return <p className="p-8 text-sm text-muted-foreground">{fr.changes.noSelection}</p>;
  const canEdit = !p.readOnly && file.area === "unstaged" && file.kind !== "deleted" && !diff.binary;
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
        readOnly={p.readOnly}
        onOpenFile={() => p.onOpenFile(line)}
        onOpenExternal={() => p.onOpenExternal(line)}
        wrap={wrap}
        onWrapChange={setWrap}
      />
      {editing && canEdit ? (
        <DiffEditorPane
          projectId={p.projectId}
          worktree={p.worktree}
          path={file.path}
          layout={p.mode}
          wrap={wrap}
          onSaved={p.onSaved}
        />
      ) : (
        <DiffView
          diff={diff}
          area={file.area}
          mode={p.mode}
          busy={p.busy}
          wrap={wrap}
          onHunk={p.readOnly || file.area === null ? undefined : p.onHunk}
        />
      )}
    </>
  );
}
