import type { FileChange } from "@kibo/schema";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";
import { ConfirmDialog } from "../shell/lazy-dialogs";
import { basename, discardLines } from "./file-menu";

type Props = { file: FileChange; onClose(): void; onConfirm(file: FileChange): Promise<void> };

export function DiscardDialog({ file, onClose, onConfirm }: Props) {
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={fr.changes.discardTitle([basename(file.path)])}
      description={
        <span className="grid gap-1">
          {discardLines(file, fr.changes).map((line) => (
            <span key={line}>{line}</span>
          ))}
          <span>{fr.changes.discardIrreversible}</span>
        </span>
      }
      confirmLabel={fr.changes.discardConfirm}
      cancelLabel={fr.common.cancel}
      onConfirm={() => onConfirm(file)}
      describeError={errorMessage}
    />
  );
}
