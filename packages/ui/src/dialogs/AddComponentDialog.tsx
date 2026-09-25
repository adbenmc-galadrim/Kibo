import type { Layout, Page } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { nextLayout } from "../lib/next-layout";
import { BUILTIN_COMPONENTS, componentRef } from "../registry";

type Props = {
  projectId: string;
  page: Page;
  taken: Layout[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

export function AddComponentDialog({ projectId, page, taken, open, onOpenChange }: Props) {
  const [ref, setRef] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const selected = BUILTIN_COMPONENTS.find((c) => componentRef(c.manifest) === ref);
  const add = async () => {
    if (!ref) return;
    setFailed(false);
    try {
      await client.rpc({
        method: "command",
        projectId,
        command: {
          method: "addInstance",
          pageId: page.id,
          component: ref,
          ...(page.kind === "dashboard" && { layout: nextLayout(taken) }),
        },
      });
    } catch {
      setFailed(true);
      return;
    }
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{fr.addComponent.title}</DialogTitle>
        </DialogHeader>
        <p className="text-xs font-medium uppercase text-muted-foreground">{fr.addComponent.builtin}</p>
        <RadioGroup value={ref ?? ""} onValueChange={setRef} className="grid gap-2">
          {BUILTIN_COMPONENTS.map((c) => (
            <Label key={c.manifest.id} className="flex items-center gap-3 rounded-md border p-3 font-normal">
              <RadioGroupItem value={componentRef(c.manifest)} aria-label={c.manifest.title} />
              <span className="flex-1">{c.manifest.title}</span>
              <span className="font-mono text-xs text-muted-foreground">v{c.manifest.version}</span>
            </Label>
          ))}
        </RadioGroup>
        {selected && (
          <div className="grid gap-1 text-sm">
            <p className="font-medium">{fr.addComponent.permissions}</p>
            <p className="text-muted-foreground">
              {fr.addComponent.reads} : {selected.manifest.reads.join(", ") || "-"}
            </p>
            <p className="text-muted-foreground">
              {fr.addComponent.writes} : {selected.manifest.writes.join(", ") || "-"}
            </p>
            <p className="text-muted-foreground">{fr.addComponent.local}</p>
          </div>
        )}
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {fr.addComponent.failed}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {fr.common.cancel}
          </Button>
          <Button disabled={!ref} onClick={() => void add()}>
            {fr.addComponent.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
