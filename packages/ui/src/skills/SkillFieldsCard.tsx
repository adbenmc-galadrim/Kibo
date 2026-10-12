import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Switch } from "@kibo/sdk/ui/switch";
import { Lock } from "lucide-react";
import { useId } from "react";
import { frSkills } from "../i18n/fr-skills";
import type { SkillFields } from "./skill-file-text";

type Props = {
  fields: SkillFields;
  extra: string;
  readOnly: boolean;
  onChange(patch: Partial<SkillFields>): void;
};

const t = frSkills.editor;

function Flag({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange(value: boolean): void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
      <Label htmlFor={id} className="font-mono text-xs font-normal">
        {label}
      </Label>
    </div>
  );
}

export function SkillFieldsCard({ fields, extra, readOnly, onChange }: Props) {
  const id = useId();
  return (
    <section className="grid gap-3 rounded-lg border bg-card p-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-description`}>{t.description}</Label>
        <Input
          id={`${id}-description`}
          value={fields.description}
          readOnly={readOnly}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>
      <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-tools`} className="font-mono">
            {t.allowedTools}
          </Label>
          <Input
            id={`${id}-tools`}
            className="font-mono"
            placeholder={t.allowedToolsHelp}
            value={fields.allowedTools}
            readOnly={readOnly}
            onChange={(e) => onChange({ allowedTools: e.target.value })}
          />
        </div>
        <div className="grid gap-2 pb-1">
          <Flag
            label={t.disableModelInvocation}
            checked={fields.disableModelInvocation}
            disabled={readOnly}
            onChange={(v) => onChange({ disableModelInvocation: v })}
          />
          <Flag
            label={t.userInvocable}
            checked={fields.userInvocable}
            disabled={readOnly}
            onChange={(v) => onChange({ userInvocable: v })}
          />
        </div>
      </div>
      {extra !== "" && (
        <p className="flex flex-wrap items-start gap-1.5 text-xs text-muted-foreground">
          <Lock aria-hidden className="mt-0.5 size-3" />
          {t.extra}
          <code className="font-mono whitespace-pre-wrap text-foreground">{extra}</code>
        </p>
      )}
    </section>
  );
}
