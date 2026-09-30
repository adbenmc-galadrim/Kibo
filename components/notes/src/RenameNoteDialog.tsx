import { KiboError, type NoteMeta } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { type FormEvent, useId, useState } from "react";
import { fr } from "./fr";
import { renamedPath } from "./note-name";

type Props = { note: NoteMeta; onRename(from: string, to: string): Promise<unknown>; onClose(): void };

export function RenameNoteDialog({ note, onRename, onClose }: Props) {
  const id = useId();
  const [title, setTitle] = useState(note.title);
  const [error, setError] = useState<string | null>(null);
  const target = renamedPath(note.path, title);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (target === null) return;
    setError(null);
    try {
      await onRename(note.path, target);
      onClose();
    } catch (err) {
      setError(err instanceof KiboError && err.code === "CONFLICT" ? fr.renameConflict : fr.renameFailed);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{fr.renameTitle}</DialogTitle>
            <DialogDescription>
              {target ? fr.renameFile(target.slice(target.lastIndexOf("/") + 1)) : fr.renameNoSlug}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={id}>{fr.renameField}</Label>
            <Input id={id} value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {fr.cancel}
            </Button>
            <Button type="submit" disabled={target === null || target === note.path}>
              {fr.renameConfirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
