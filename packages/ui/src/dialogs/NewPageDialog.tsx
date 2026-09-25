import type { Page } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { navigate } from "../route";

type Props = {
  projectId: string;
  parentId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

export function NewPageDialog({ projectId, parentId, open, onOpenChange }: Props) {
  const titleId = useId();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Page["kind"]>("dashboard");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const page = (await client.rpc({
      method: "command",
      projectId,
      command: { method: "addPage", title: title.trim(), kind, parentId },
    })) as Page;
    onOpenChange(false);
    setTitle("");
    navigate(projectId, page.id);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{fr.newPage.title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={titleId}>{fr.newPage.name}</Label>
            <Input id={titleId} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">{fr.newPage.kind}</legend>
            <RadioGroup value={kind} onValueChange={(v) => setKind(v === "view" ? "view" : "dashboard")}>
              <Label className="flex items-start gap-2 font-normal">
                <RadioGroupItem value="dashboard" aria-label={fr.newPage.dashboard} />
                <span>
                  {fr.newPage.dashboard}
                  <span className="block text-xs text-muted-foreground">{fr.newPage.dashboardHelp}</span>
                </span>
              </Label>
              <Label className="flex items-start gap-2 font-normal">
                <RadioGroupItem value="view" aria-label={fr.newPage.view} />
                <span>
                  {fr.newPage.view}
                  <span className="block text-xs text-muted-foreground">{fr.newPage.viewHelp}</span>
                </span>
              </Label>
            </RadioGroup>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {fr.common.cancel}
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {fr.newPage.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
