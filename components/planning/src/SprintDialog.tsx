import { KiboError, type SprintView } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
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

type Props = { sprint: SprintView | null; today: string; onClose(): void };

const t = fr.sprintDialog;

export function SprintDialog({ sprint, today, onClose }: Props) {
  const sdk = useSdk();
  const id = useId();
  const [code, setCode] = useState(sprint?.code ?? "");
  const [name, setName] = useState(sprint?.name ?? "");
  const [start, setStart] = useState(sprint?.start ?? today);
  const [end, setEnd] = useState(sprint?.end ?? today);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const reversed = start !== "" && end !== "" && end < start;
  const valid = code.trim() !== "" && name.trim() !== "" && start !== "" && end !== "" && !reversed;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    try {
      const fields = { code: code.trim(), name: name.trim(), start, end };
      if (sprint === null) await sdk.sprints.create(fields);
      else await sdk.sprints.update(sprint.id, fields);
      onClose();
    } catch (e) {
      setError(e instanceof KiboError && e.code === "CONFLICT" ? t.codeTaken : t.failed);
    }
  };
  if (removing && sprint !== null)
    return (
      <ConfirmDialog
        open
        onOpenChange={(open) => !open && onClose()}
        title={t.removeTitle(sprint.code)}
        description={t.removeHelp(sprint.features.length)}
        confirmLabel={t.remove}
        cancelLabel={t.cancel}
        onConfirm={() => sdk.sprints.remove(sprint.id)}
      />
    );
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
          <DialogHeader>
            <DialogTitle>{sprint === null ? t.createTitle : t.editTitle(sprint.code)}</DialogTitle>
            <DialogDescription>{t.description}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[6rem_1fr] gap-3">
            <div className="grid gap-2">
              <Label htmlFor={`${id}-code`}>{t.code}</Label>
              <Input
                id={`${id}-code`}
                value={code}
                maxLength={8}
                placeholder="S42"
                className="font-mono"
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-name`}>{t.name}</Label>
              <Input
                id={`${id}-name`}
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor={`${id}-start`}>{t.start}</Label>
              <Input
                id={`${id}-start`}
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-end`}>{t.end}</Label>
              <Input
                id={`${id}-end`}
                type="date"
                value={end}
                aria-invalid={reversed}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          {(reversed || error) && (
            <p role="alert" className="text-destructive text-sm">
              {reversed ? t.reversed : error}
            </p>
          )}
          <DialogFooter>
            {sprint !== null && (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive"
                onClick={() => setRemoving(true)}
              >
                {t.remove}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={!valid}>
              {sprint === null ? t.create : t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
