import type { Page } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";

type Props = { projectId: string; page: Page; onClose(): void };

export function RenamePageDialog({ projectId, page, onClose }: Props) {
  const id = useId();
  const [title, setTitle] = useState(page.title);
  const [failed, setFailed] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFailed(false);
    try {
      await client.rpc({
        method: "command",
        projectId,
        command: { method: "renamePage", pageId: page.id, title: title.trim() },
      });
      onClose();
    } catch {
      setFailed(true);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{fr.nav.renameTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={id}>{fr.nav.renameName}</Label>
            <Input id={id} value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
          </div>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {fr.nav.renameFailed}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {fr.common.cancel}
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {fr.common.rename}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
