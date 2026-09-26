import type { CommitInfo } from "@kibo/schema";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@kibo/sdk/ui/alert-dialog";
import { Button } from "@kibo/sdk/ui/button";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";

type Props = { commit: CommitInfo; newer: number; onClose(): void; onConfirm(): Promise<void> };

export function UndoCommitDialog({ commit, newer, onClose, onConfirm }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = () => {
    setBusy(true);
    onConfirm().then(onClose, (e: unknown) => {
      setError(errorMessage(e));
      setBusy(false);
    });
  };
  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{fr.commit.undoTitle}</AlertDialogTitle>
          <AlertDialogDescription>{fr.commit.undoHelp(commit.shortSha, newer)}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{fr.common.cancel}</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={confirm}>
            {fr.commit.undoSubmit}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
