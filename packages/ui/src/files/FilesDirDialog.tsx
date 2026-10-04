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
import { FolderField } from "../dialogs/FolderField";
import { frFiles } from "../i18n/fr-files";

type Props = { projectId: string; onClose(): void; onSaved(): void };

const t = frFiles.dir;

export function FilesDirDialog({ projectId, onClose, onSaved }: Props) {
  const id = useId();
  const [dir, setDir] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    client.rpc({ method: "getFilesDir", projectId }).then(
      (info) => {
        if (live) setDir(info.dir);
      },
      (e: unknown) => {
        console.error(e);
        if (live) setError(t.failed);
      },
    );
    return () => {
      live = false;
    };
  }, [projectId]);
  const save = async () => {
    setError(null);
    try {
      await client.rpc({ method: "setFilesDir", projectId, dir: dir.trim() || null });
      onSaved();
      onClose();
    } catch (e) {
      if (!(e instanceof KiboError && e.code === "INVALID_INPUT")) console.error(e);
      setError(t.failed);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.help}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={id}>{t.label}</Label>
          <FolderField id={id} value={dir} onChange={setDir} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {frFiles.cancel}
          </Button>
          <Button onClick={() => void save()}>{t.submit}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
