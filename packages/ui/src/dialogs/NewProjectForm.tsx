import { PROJECT_CLIENT_MAX } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { DialogFooter } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { type FormEvent, useId } from "react";
import { frNewProject as t } from "../i18n/fr-new-project";
import { FolderField } from "./FolderField";
import { effectiveKey, type KeyProblem, type NewProjectFields, type Validation } from "./new-project-model";
import { SprintSetupFields } from "./SprintSetupFields";

type Props = {
  fields: NewProjectFields;
  onFields: (patch: Partial<NewProjectFields>) => void;
  validation: Validation;
  busy: boolean;
  error: string | null;
  focusFolder: boolean;
  onCancel: () => void;
  onSubmit: () => void;
};

const LABEL = "text-[13px] leading-4 font-medium";
const FIELD = "grid content-start gap-[6px]";
const HELP = "text-xs leading-[17px] text-muted-foreground";

function keyMessage(problem: KeyProblem | null, key: string): string | null {
  if (problem === "taken") return t.keyTaken;
  if (problem === "reserved") return t.keyReserved(key);
  return null;
}

export function NewProjectForm(p: Props) {
  const id = useId();
  const key = effectiveKey(p.fields);
  const keyAlert = keyMessage(p.validation.key, key);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (p.validation.ok) p.onSubmit();
  };
  return (
    <form onSubmit={submit} className="grid gap-[18px]">
      <div className={FIELD}>
        <Label htmlFor={`${id}-name`} className={LABEL}>
          {t.name}
        </Label>
        <Input
          id={`${id}-name`}
          value={p.fields.name}
          onChange={(e) => p.onFields({ name: e.target.value })}
          autoFocus={!p.focusFolder}
        />
      </div>
      <div className="flex gap-3">
        <div className={`${FIELD} w-[190px]`}>
          <Label htmlFor={`${id}-key`} className={LABEL}>
            {t.key}
          </Label>
          <Input
            id={`${id}-key`}
            value={key}
            onChange={(e) => p.onFields({ key: e.target.value.toUpperCase() })}
            aria-invalid={keyAlert !== null || p.validation.key === "invalid"}
            aria-describedby={`${id}-key-help`}
            className="font-mono"
          />
          {keyAlert ? (
            <p id={`${id}-key-help`} role="alert" className="text-xs leading-[17px] text-destructive">
              {keyAlert}
            </p>
          ) : (
            <p id={`${id}-key-help`} className={HELP}>
              {t.keyHelp}
            </p>
          )}
        </div>
        <div className={`${FIELD} flex-1`}>
          <Label htmlFor={`${id}-client`} className={LABEL}>
            {t.client}
          </Label>
          <Input
            id={`${id}-client`}
            value={p.fields.client}
            maxLength={PROJECT_CLIENT_MAX}
            onChange={(e) => p.onFields({ client: e.target.value })}
            aria-describedby={`${id}-client-help`}
          />
          <p id={`${id}-client-help`} className={HELP}>
            {t.clientHelp}
          </p>
        </div>
      </div>
      <SprintSetupFields fields={p.fields} onFields={p.onFields} problems={p.validation} />
      <div className={FIELD}>
        <Label htmlFor={`${id}-folder`} className={LABEL}>
          {t.folder}
        </Label>
        <FolderField
          id={`${id}-folder`}
          value={p.fields.folder}
          onChange={(folder) => p.onFields({ folder })}
          autoFocus={p.focusFolder}
          placeholder={t.noFolder}
          describedBy={`${id}-folder-help`}
        />
        <p id={`${id}-folder-help`} className={HELP}>
          {t.folderHelp}
        </p>
      </div>
      {p.error && (
        <p role="alert" className="text-sm text-destructive">
          {p.error}
        </p>
      )}
      <DialogFooter className="pt-1">
        <Button type="button" variant="outline" onClick={p.onCancel}>
          {t.cancel}
        </Button>
        <Button type="submit" disabled={!p.validation.ok || p.busy}>
          {t.submit}
        </Button>
      </DialogFooter>
    </form>
  );
}
