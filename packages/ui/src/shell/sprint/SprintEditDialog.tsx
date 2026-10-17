import { KiboError, type ProjectCommand, type SprintView } from "@kibo/schema";
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
import { type ComponentProps, type FormEvent, useId, useState } from "react";
import { frSprint } from "../../i18n/fr-sprint";

type Props = {
  sprint: SprintView;
  features: number;
  command(command: ProjectCommand): Promise<unknown>;
  onClose(): void;
};

const t = frSprint.dialog;

function Field({ id, label, ...input }: { id: string; label: string } & ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...input} />
    </div>
  );
}

export function SprintEditDialog({ sprint, features, command, onClose }: Props) {
  const id = useId();
  const [code, setCode] = useState(sprint.code);
  const [name, setName] = useState(sprint.name);
  const [start, setStart] = useState(sprint.start);
  const [end, setEnd] = useState(sprint.end);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const reversed = start !== "" && end !== "" && end < start;
  const valid = code.trim() !== "" && name.trim() !== "" && start !== "" && end !== "" && !reversed;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    try {
      const patch = { code: code.trim(), name: name.trim(), start, end };
      await command({ method: "updateSprint", sprintId: sprint.id, patch });
      onClose();
    } catch (e) {
      setError(e instanceof KiboError && e.code === "CONFLICT" ? t.codeTaken : t.failed);
    }
  };
  if (removing)
    return (
      <ConfirmDialog
        open
        onOpenChange={(open) => !open && onClose()}
        title={t.removeTitle(sprint.code)}
        description={t.removeHelp(features)}
        confirmLabel={t.remove}
        cancelLabel={t.cancel}
        onConfirm={async () => {
          await command({ method: "deleteSprint", sprintId: sprint.id });
        }}
      />
    );
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
          <DialogHeader>
            <DialogTitle>{t.title(sprint.code)}</DialogTitle>
            <DialogDescription>{t.description}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[6rem_1fr] gap-3">
            <Field
              id={`${id}-code`}
              label={t.code}
              value={code}
              maxLength={8}
              className="font-mono"
              onChange={(e) => setCode(e.target.value)}
            />
            <Field
              id={`${id}-name`}
              label={t.name}
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              id={`${id}-start`}
              label={t.start}
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <Field
              id={`${id}-end`}
              label={t.end}
              type="date"
              value={end}
              aria-invalid={reversed}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
          {(reversed || error) && (
            <p role="alert" className="text-destructive text-sm">
              {reversed ? t.reversed : error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={() => setRemoving(true)}
            >
              {t.remove}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={!valid}>
              {t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
