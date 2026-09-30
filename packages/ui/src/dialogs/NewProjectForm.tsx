import { Button } from "@kibo/sdk/ui/button";
import { DialogFooter } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup } from "@kibo/sdk/ui/radio-group";
import { LayoutDashboard, Plus } from "lucide-react";
import { type FormEvent, useId } from "react";
import { fr } from "../i18n/fr";
import { ChoiceCard } from "./ChoiceCard";

export type ProjectFields = { name: string; key: string | null; folder: string };
export type ProjectStart = "suggested" | "empty";

type Props = {
  fields: ProjectFields;
  onFields: (patch: Partial<ProjectFields>) => void;
  effectiveKey: string;
  valid: boolean;
  busy: boolean;
  error: string | null;
  focusFolder: boolean;
  pageTitles: string[];
  start: ProjectStart;
  onStart: (start: ProjectStart) => void;
  onBack: () => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function NewProjectForm(p: Props) {
  const id = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    p.onSubmit();
  };
  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor={`${id}-name`}>{fr.newProject.name}</Label>
        <Input
          id={`${id}-name`}
          value={p.fields.name}
          onChange={(e) => p.onFields({ name: e.target.value })}
          autoFocus={!p.focusFolder}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-key`}>{fr.newProject.key}</Label>
        <Input
          id={`${id}-key`}
          value={p.effectiveKey}
          onChange={(e) => p.onFields({ key: e.target.value.toUpperCase() })}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">{fr.newProject.keyHelp}</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-folder`}>{fr.newProject.folder}</Label>
        <Input
          id={`${id}-folder`}
          value={p.fields.folder}
          onChange={(e) => p.onFields({ folder: e.target.value })}
          autoFocus={p.focusFolder}
          placeholder="/Users/adam/code/kibo"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">{fr.newProject.folderHelp}</p>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{fr.newProject.start}</legend>
        <RadioGroup
          value={p.start}
          onValueChange={(v) => p.onStart(v === "suggested" ? "suggested" : "empty")}
          className="grid gap-2 sm:grid-cols-3"
        >
          <ChoiceCard
            stacked
            value="empty"
            icon={Plus}
            title={fr.newProject.startEmpty}
            description={fr.newProject.startEmptyHelp}
          />
          <ChoiceCard
            stacked
            value="suggested"
            icon={LayoutDashboard}
            title={fr.onboarding.startSuggested}
            description={p.pageTitles.length > 0 ? p.pageTitles.join(", ") : fr.onboarding.noPage}
            disabled={p.pageTitles.length === 0}
          />
        </RadioGroup>
      </fieldset>
      {p.error && <p className="text-sm text-destructive">{p.error}</p>}
      <DialogFooter className="sm:justify-between">
        <Button type="button" variant="ghost" onClick={p.onBack}>
          {fr.onboarding.back}
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="ghost" onClick={p.onCancel}>
            {fr.common.cancel}
          </Button>
          <Button type="submit" disabled={!p.valid || p.busy}>
            {fr.newProject.submit}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
