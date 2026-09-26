import type { CommitInfo } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { useId, useState } from "react";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";

type Props = { commit: CommitInfo; onClose(): void; onSubmit(message: string): Promise<void> };

export function RewordDialog({ commit, onClose, onSubmit }: Props) {
  const id = useId();
  const [message, setMessage] = useState(
    commit.body ? `${commit.subject}\n\n${commit.body}` : commit.subject,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = () => {
    setBusy(true);
    onSubmit(message).then(onClose, (e: unknown) => {
      setError(errorMessage(e));
      setBusy(false);
    });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fr.commit.rewordTitle}</DialogTitle>
          <DialogDescription>{fr.commit.rewordHelp(commit.shortSha)}</DialogDescription>
        </DialogHeader>
        <Label htmlFor={id}>{fr.commit.message}</Label>
        <Textarea
          id={id}
          className="min-h-32 font-mono text-sm"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {fr.common.cancel}
          </Button>
          <Button disabled={busy || message.trim().length === 0} onClick={submit}>
            {fr.commit.rewordSubmit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
