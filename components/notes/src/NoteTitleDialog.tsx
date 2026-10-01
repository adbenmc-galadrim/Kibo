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

type Props = {
  title: string;
  initial: string;
  confirmLabel: string;
  pathFor(title: string): string | null;
  unchanged: string | null;
  submit(path: string, title: string): Promise<unknown>;
  describeError(error: unknown): string;
  onClose(): void;
};

const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

export function NoteTitleDialog(p: Props) {
  const id = useId();
  const [title, setTitle] = useState(p.initial);
  const [error, setError] = useState<string | null>(null);
  const target = p.pathFor(title);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (target === null || target === p.unchanged) return;
    setError(null);
    try {
      await p.submit(target, title.trim());
      p.onClose();
    } catch (err) {
      setError(p.describeError(err));
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && p.onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{p.title}</DialogTitle>
            <DialogDescription>
              {target ? fr.renameFile(fileName(target)) : fr.renameNoSlug}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={id}>{fr.titleField}</Label>
            <Input id={id} value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={p.onClose}>
              {fr.cancel}
            </Button>
            <Button type="submit" disabled={target === null || target === p.unchanged}>
              {p.confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
