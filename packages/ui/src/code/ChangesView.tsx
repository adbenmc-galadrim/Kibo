import type { FileRef, ProjectSnapshot } from "@kibo/schema";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";
import { isRemoteView } from "../lib/remote-view";
import { ChangesBody } from "./ChangesBody";
import { type ChangesSlotsHook, useNoSlots } from "./changes-slots";
import { resolveWorktree, useWorktrees } from "./use-worktrees";

type Props = {
  project: ProjectSnapshot;
  worktree: string | null;
  onWorktreeChange(path: string): void;
  onOpenFile(ref: FileRef): void;
  onOpenInTab(ref: FileRef): void;
  useSlots?: ChangesSlotsHook;
  remote?: boolean;
};

export function ChangesView({
  project,
  worktree,
  onWorktreeChange,
  onOpenFile,
  onOpenInTab,
  useSlots,
  remote = isRemoteView(),
}: Props) {
  const { worktrees, error } = useWorktrees(project.meta.id);
  const current = resolveWorktree(worktrees, worktree) ?? resolveWorktree(worktrees, null);
  if (error?.code === "NOT_A_REPO")
    return <p className="p-8 text-sm text-muted-foreground">{fr.changes.notRepo}</p>;
  if (error)
    return (
      <p role="alert" className="p-8 text-sm text-destructive">
        {errorMessage(error)}
      </p>
    );
  if (!worktrees || !current) return null;
  return (
    <ChangesBody
      key={current.path}
      project={project}
      worktrees={worktrees}
      current={current}
      onWorktreeChange={onWorktreeChange}
      onOpenFile={onOpenFile}
      onOpenInTab={onOpenInTab}
      useSlots={useSlots ?? useNoSlots}
      readOnly={remote}
    />
  );
}
