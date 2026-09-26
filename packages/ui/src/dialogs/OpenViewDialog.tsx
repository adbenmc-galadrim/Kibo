import { Page } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";

type Props = {
  projectId: string;
  componentRef: string;
  title: string;
  open: boolean;
  onOpenChange(open: boolean): void;
  onCreated(pageId: string): void;
};

export function OpenViewDialog({ projectId, componentRef, title, open, onOpenChange, onCreated }: Props) {
  const o = fr.openView;
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setFailed(false);
    setBusy(true);
    try {
      const created = await client.rpc({
        method: "command",
        projectId,
        command: { method: "addPage", title, kind: "view" },
      });
      const page = Page.parse(created);
      await client.rpc({
        method: "command",
        projectId,
        command: { method: "addInstance", pageId: page.id, component: componentRef },
      });
      onCreated(page.id);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{o.title(title)}</DialogTitle>
          <DialogDescription>{o.help}</DialogDescription>
        </DialogHeader>
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {o.failed}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {fr.common.cancel}
          </Button>
          <Button disabled={busy} onClick={() => void create()}>
            {o.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
