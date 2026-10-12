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
import { useId, useState } from "react";
import { fr } from "../i18n/fr";
import { frSkills } from "../i18n/fr-skills";
import { errorMessage } from "../lib/error-message";

type Props = {
  valid(path: string): boolean;
  exists(path: string): boolean;
  onClose(): void;
  onAdd(path: string): Promise<void>;
};

const t = frSkills.assets;

export function AddAssetDialog({ valid, exists, onClose, onAdd }: Props) {
  const id = useId();
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = path.trim();
  const problem = trimmed === "" ? null : exists(trimmed) ? t.exists : valid(trimmed) ? null : t.pathProblem;
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onAdd(trimmed);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.addTitle}</DialogTitle>
          <DialogDescription>{t.pathHelp}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (problem === null && trimmed !== "") void submit();
          }}
        >
          <Label htmlFor={id}>{t.path}</Label>
          <Input
            id={id}
            className="font-mono"
            value={path}
            aria-invalid={problem !== null}
            onChange={(e) => setPath(e.target.value)}
          />
          {(problem ?? error) && (
            <p role="alert" className="text-xs text-destructive">
              {problem ?? error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {fr.common.cancel}
            </Button>
            <Button type="submit" disabled={busy || trimmed === "" || problem !== null}>
              {t.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
