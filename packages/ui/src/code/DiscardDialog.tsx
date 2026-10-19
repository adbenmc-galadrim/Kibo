import type { FileChange } from "@kibo/schema";
import { fr } from "../i18n/fr";
import { frChanges } from "../i18n/fr-changes";
import { errorMessage } from "../lib/error-message";
import { ConfirmDialog } from "../shell/lazy-dialogs";
import { basename, discardLines } from "./file-menu";

type Props = { file: FileChange; onClose(): void; onConfirm(file: FileChange): Promise<void> };

export function DiscardDialog({ file, onClose, onConfirm }: Props) {
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={frChanges.changes.discardTitle([basename(file.path)])}
      description={
        <span className="grid gap-1">
          {discardLines(file, frChanges.changes).map((line) => (
            <span key={line}>{line}</span>
          ))}
          <span>{frChanges.changes.discardIrreversible}</span>
        </span>
      }
      confirmLabel={frChanges.changes.discardConfirm}
      cancelLabel={fr.common.cancel}
      onConfirm={() => onConfirm(file)}
      describeError={errorMessage}
    />
  );
}
