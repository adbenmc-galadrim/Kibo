import { ProjectKey } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { suggestProjectKey } from "../lib/project-key";
import { navigate } from "../route";

const COLORS = ["#14B8A6", "#6366F1", "#EC4899", "#84CC16", "#D946EF", "#64748B"];

type Props = { open: boolean; onOpenChange: (o: boolean) => void; count: number };

export function NewProjectDialog({ open, onOpenChange, count }: Props) {
  const id = useId();
  const [name, setName] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const [folder, setFolder] = useState("");
  const [error, setError] = useState<string | null>(null);
  const effectiveKey = key ?? suggestProjectKey(name);
  const valid = name.trim().length > 0 && ProjectKey.safeParse(effectiveKey).success;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const p = await client.rpc({
        method: "createProject",
        name: name.trim(),
        key: effectiveKey,
        folder: folder.trim() || null,
        color: COLORS[count % COLORS.length] ?? "#64748B",
      });
      onOpenChange(false);
      navigate(p.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.common.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{fr.newProject.title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-name`}>{fr.newProject.name}</Label>
            <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-key`}>{fr.newProject.key}</Label>
            <Input
              id={`${id}-key`}
              value={effectiveKey}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">{fr.newProject.keyHelp}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-folder`}>{fr.newProject.folder}</Label>
            <Input
              id={`${id}-folder`}
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="/Users/adam/code/kibo"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">{fr.newProject.folderHelp}</p>
          </div>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">{fr.newProject.start}</legend>
            <RadioGroup defaultValue="empty">
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="empty" />
                {fr.newProject.startEmpty}
              </Label>
              <Label className="flex items-center gap-2 font-normal text-muted-foreground">
                <RadioGroupItem value="dev" disabled />
                {fr.newProject.startDev}
              </Label>
              <Label className="flex items-center gap-2 font-normal text-muted-foreground">
                <RadioGroupItem value="copy" disabled />
                {fr.newProject.startCopy}
              </Label>
            </RadioGroup>
          </fieldset>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {fr.common.cancel}
            </Button>
            <Button type="submit" disabled={!valid}>
              {fr.newProject.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
