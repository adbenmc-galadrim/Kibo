import type { SprintView } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
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
import { Textarea } from "@kibo/sdk/ui/textarea";
import { type FormEvent, useId, useRef, useState } from "react";
import { createFeature, freshProgress } from "./create-feature";
import { fr } from "./fr";
import { proposedSprint, sprintChoices } from "./proposed-sprint";
import { sprintLabel } from "./sprint-label";

type Props = { sprints: readonly SprintView[]; today: string; onClose(): void };

const t = fr.featureDialog;

export const stepTitles = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function NewFeatureDialog({ sprints, today, onClose }: Props) {
  const sdk = useSdk();
  const id = useId();
  const [name, setName] = useState("");
  const [expected, setExpected] = useState("");
  const [choice, setSprint] = useState<string | null>(null);
  const sprint = choice ?? proposedSprint(sprints, today) ?? "";
  const [steps, setSteps] = useState(t.defaultSteps);
  const [lastRequired, setLastRequired] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const titles = stepTitles(steps);
  const valid = name.trim() !== "" && titles.length > 0;
  const progress = useRef(freshProgress());
  const create = () =>
    createFeature(
      sdk,
      {
        name: name.trim(),
        expected,
        sprintId: sprint === "" ? null : sprint,
        steps: titles,
        lastOptional: !lastRequired,
      },
      progress.current,
    );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    try {
      await create();
      onClose();
    } catch {
      setError(t.failed);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
            <DialogDescription>{t.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-name`}>{t.name}</Label>
            <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-expected`}>{t.expected}</Label>
            <Textarea id={`${id}-expected`} value={expected} onChange={(e) => setExpected(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-sprint`}>{t.sprint}</Label>
            <select
              id={`${id}-sprint`}
              className={SELECT_CLASS}
              value={sprint}
              onChange={(e) => setSprint(e.target.value)}
            >
              <option value="">{t.none}</option>
              {sprintChoices(sprints, today).map(({ sprint: s, over }) => (
                <option key={s.id} value={s.id}>
                  {over ? t.over(sprintLabel(s)) : sprintLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-steps`}>{t.steps}</Label>
            <Textarea id={`${id}-steps`} rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} />
            <div className="flex items-center gap-2">
              <Checkbox
                id={`${id}-optional`}
                checked={lastRequired}
                onCheckedChange={(v) => setLastRequired(v === true)}
              />
              <Label htmlFor={`${id}-optional`}>{t.lastRequired}</Label>
            </div>
          </div>
          {(error || titles.length === 0) && (
            <p role="alert" className="text-destructive text-sm">
              {error ?? t.noStep}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={!valid}>
              {t.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
