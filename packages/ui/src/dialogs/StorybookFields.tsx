import { PortEnvName, StorybookOriginUrl, type StorybookSettings } from "@kibo/schema";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { useId } from "react";
import { frProject } from "../i18n/fr-project";

type Props = {
  value: StorybookSettings | null;
  onChange(next: StorybookSettings | null): void;
  withPortEnv: boolean;
  disabled: boolean;
};
type Field = keyof StorybookSettings;

const t = frProject.edit;
const EMPTY: StorybookSettings = { origin: "", portEnv: "" };

export function storybookProblem(value: StorybookSettings): string | null {
  if (!StorybookOriginUrl.safeParse(value.origin).success) return t.storybookErrors.origin;
  if (!PortEnvName.safeParse(value.portEnv).success) return t.storybookErrors.portEnv;
  return null;
}

function nextValue(
  current: StorybookSettings | null,
  field: Field,
  raw: string,
  withPortEnv: boolean,
): StorybookSettings | null {
  const next = { ...(current ?? EMPTY), [field]: raw };
  return next.origin === "" && (next.portEnv === "" || !withPortEnv) ? null : next;
}

export function StorybookFields({ value, onChange, withPortEnv, disabled }: Props) {
  const ids = { origin: useId(), portEnv: useId(), help: useId(), title: useId() };
  const problem = value === null ? null : storybookProblem(value);
  const set = (field: Field) => (e: { target: { value: string } }) =>
    onChange(nextValue(value, field, e.target.value, withPortEnv));
  const fields = [
    { id: ids.origin, label: t.storybookOrigin, field: "origin", text: value?.origin ?? "", shown: true },
    {
      id: ids.portEnv,
      label: t.storybookPortEnv,
      field: "portEnv",
      text: value?.portEnv ?? "",
      shown: withPortEnv,
    },
  ] as const;
  return (
    <fieldset aria-labelledby={ids.title} className="grid gap-2">
      <legend id={ids.title} className="text-sm font-medium">
        {t.storybook}
      </legend>
      {fields
        .filter((f) => f.shown)
        .map((f) => (
          <div key={f.field} className="grid grid-cols-[8rem_1fr] items-center gap-2">
            <Label htmlFor={f.id} className="text-xs text-muted-foreground">
              {f.label}
            </Label>
            <Input
              id={f.id}
              value={f.text}
              disabled={disabled}
              spellCheck={false}
              className="font-mono text-xs"
              aria-describedby={ids.help}
              aria-invalid={problem !== null}
              onChange={set(f.field)}
            />
          </div>
        ))}
      <div id={ids.help} className="grid gap-0.5 text-xs text-muted-foreground">
        <p>{t.storybookOriginHelp}</p>
        {withPortEnv && <p>{t.storybookPortEnvHelp}</p>}
      </div>
      {problem !== null && <p className="text-xs text-destructive">{problem}</p>}
    </fieldset>
  );
}
