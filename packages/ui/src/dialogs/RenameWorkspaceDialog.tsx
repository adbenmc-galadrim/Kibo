import { KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { type FormEvent, useId, useState } from "react";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";

type Props = { name: string; onSubmit(name: string): Promise<void>; onClose(): void };

const failure = (e: unknown) =>
  e instanceof KiboError ? `${fr.workspace.renameFailed} ${errorMessage(e)}` : fr.workspace.renameFailed;

export function RenameWorkspaceDialog({ name, onSubmit, onClose }: Props) {
  const id = useId();
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(value.trim());
      onClose();
    } catch (err) {
      setError(failure(err));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{fr.workspace.renameTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={id}>{fr.workspace.name}</Label>
            <Input
              id={id}
              value={value}
              maxLength={40}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {fr.workspace.cancel}
            </Button>
            <Button type="submit" disabled={busy || value.trim().length === 0}>
              {fr.workspace.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
