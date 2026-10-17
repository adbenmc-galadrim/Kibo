import { PROJECT_DESCRIPTION_MAX } from "@kibo/schema";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { useId } from "react";
import { frProject } from "../i18n/fr-project";

type Props = { value: string; onChange(value: string): void; disabled?: boolean };

export function DescriptionField({ value, onChange, disabled = false }: Props) {
  const id = useId();
  const helpId = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{frProject.edit.description}</Label>
      <Input
        id={id}
        value={value}
        maxLength={PROJECT_DESCRIPTION_MAX}
        aria-describedby={helpId}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <p id={helpId} className="text-xs text-muted-foreground">
        {frProject.edit.descriptionHelp}
      </p>
    </div>
  );
}
