import { KiboError } from "@kibo/schema";
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
import { useEffect, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { FolderField } from "./FolderField";

type Props = { projectId: string; open: boolean; onOpenChange(open: boolean): void };

export function NotesDirDialog({ projectId, open, onOpenChange }: Props) {
  const n = fr.notesDir;
  const id = useId();
  const [dir, setDir] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    client.rpc({ method: "getNotesDir", projectId }).then(
      (info) => {
        if (live) setDir(info.dir);
      },
      (e: unknown) => {
        console.error(e);
        if (live) setError(fr.common.error);
      },
    );
    return () => {
      live = false;
    };
  }, [open, projectId]);
  const save = async () => {
    setError(null);
    try {
      await client.rpc({ method: "setNotesDir", projectId, dir: dir.trim() });
      onOpenChange(false);
    } catch (e) {
      if (!(e instanceof KiboError && e.code === "INVALID_INPUT")) console.error(e);
      setError(n.failed);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{n.title}</DialogTitle>
          <DialogDescription>{n.help}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={id}>{n.label}</Label>
          <FolderField id={id} value={dir} onChange={setDir} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {fr.common.cancel}
          </Button>
          <Button disabled={!dir.trim()} onClick={() => void save()}>
            {n.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
