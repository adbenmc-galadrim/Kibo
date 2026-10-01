import { COMPONENT_FORMATS, type ComponentFormat, type DraftKind, formatIssue } from "@kibo/schema";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { useId } from "react";
import { frCreations } from "../i18n/fr-creations";

export type FormatsFieldProps = {
  kind: DraftKind;
  value: ComponentFormat[];
  onChange(next: ComponentFormat[]): void;
};

export type FormatProblem = "none" | "viewNeedsFull" | "widgetNeedsSmaller";

const t = frCreations.formats;

export function formatProblem(kind: DraftKind, formats: readonly ComponentFormat[]): FormatProblem | null {
  if (formats.length === 0) return "none";
  if (formatIssue({ kind, formats: [...formats] }) === null) return null;
  return kind === "view" ? "viewNeedsFull" : "widgetNeedsSmaller";
}

export function FormatsField({ kind, value, onChange }: FormatsFieldProps) {
  const id = useId();
  const problem = formatProblem(kind, value);
  const toggle = (format: ComponentFormat, on: boolean) =>
    onChange(COMPONENT_FORMATS.filter((f) => (f === format ? on : value.includes(f))));
  return (
    <fieldset className="grid gap-1.5" aria-describedby={`${id}-help`}>
      <legend className="mb-1.5 text-xs font-medium">{t.label}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {COMPONENT_FORMATS.map((format) => (
          <label key={format} htmlFor={`${id}-${format}`} className="flex items-center gap-2 text-xs">
            <Checkbox
              id={`${id}-${format}`}
              checked={value.includes(format)}
              aria-invalid={problem !== null}
              onCheckedChange={(on) => toggle(format, on === true)}
            />
            {t.labels[format]}
          </label>
        ))}
      </div>
      <p id={`${id}-help`} className={problem ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
        {problem ? t[problem] : t.help}
      </p>
    </fieldset>
  );
}
