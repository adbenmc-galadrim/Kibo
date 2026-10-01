import { KiboError, type NoteMeta } from "@kibo/schema";
import { fr } from "./fr";
import { NoteTitleDialog } from "./NoteTitleDialog";
import { renamedPath } from "./note-name";

type Props = { note: NoteMeta; onRename(from: string, to: string): Promise<unknown>; onClose(): void };

export const describeRenameError = (e: unknown): string =>
  e instanceof KiboError && e.code === "CONFLICT" ? fr.renameConflict : fr.renameFailed;

export function RenameNoteDialog({ note, onRename, onClose }: Props) {
  return (
    <NoteTitleDialog
      title={fr.renameTitle}
      initial={note.title}
      confirmLabel={fr.renameConfirm}
      pathFor={(title) => renamedPath(note.path, title)}
      unchanged={note.path}
      submit={(to) => onRename(note.path, to)}
      describeError={describeRenameError}
      onClose={onClose}
    />
  );
}
