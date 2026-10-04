import { type ConfigField, type ConfigSchema, type Instance, validateConfig } from "@kibo/schema";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { Switch } from "@kibo/sdk/ui/switch";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { frWidgets as t } from "../i18n/fr-widgets";
import {
  configFields,
  type FieldValue,
  type FormField,
  fieldKind,
  fieldLabel,
  numberBounds,
  parseFieldInput,
  withFieldValue,
} from "../lib/config-form";
import { AssetField } from "./AssetField";

type Props = { projectId: string; instance: Instance; title: string; schema: ConfigSchema; onClose(): void };
type FieldProps = {
  id: string;
  projectId: string;
  field: FormField;
  value: FieldValue;
  disabled: boolean;
  onChange(v: FieldValue): void;
};

const valueWhenFilled = (key: string, field: ConfigField): FieldValue =>
  configFields({ [key]: { ...field, nullable: false } }, {})[0]?.value ?? "";

function FieldInput({ id, projectId, field, value, disabled, onChange }: FieldProps) {
  const kind = fieldKind(field.field);
  const label = fieldLabel(field.key, field.field);
  if (kind === "asset" && field.field.asset)
    return (
      <AssetField
        id={id}
        projectId={projectId}
        kind={field.field.asset}
        value={typeof value === "string" ? value : null}
        nullable={field.field.nullable === true}
        disabled={disabled}
        onChange={onChange}
      />
    );
  if (kind === "enum")
    return (
      <Select
        value={value === null ? "" : String(value)}
        onValueChange={(v) => onChange(parseFieldInput(field.field, v))}
        disabled={disabled}
      >
        <SelectTrigger id={id} aria-label={label} className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(field.field.enum ?? []).map((e) => (
            <SelectItem key={String(e)} value={String(e)}>
              {t.valueLabel(e)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  if (kind === "boolean")
    return (
      <Switch
        id={id}
        aria-label={label}
        checked={value === true}
        disabled={disabled}
        onCheckedChange={(c) => onChange(c)}
      />
    );
  return <TextInput id={id} field={field} value={value} disabled={disabled} onChange={onChange} />;
}

function TextInput({ id, field, value, disabled, onChange }: Omit<FieldProps, "projectId">) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const shown = parseFieldInput(field.field, text) === value ? text : value === null ? "" : String(value);
  const numeric = fieldKind(field.field) === "number";
  return (
    <Input
      id={id}
      aria-label={fieldLabel(field.key, field.field)}
      type={numeric ? "number" : "text"}
      inputMode={numeric ? "decimal" : undefined}
      step={numeric ? "any" : undefined}
      {...(numeric && numberBounds(field.field))}
      value={shown}
      disabled={disabled}
      className="w-56"
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseFieldInput(field.field, e.target.value));
      }}
    />
  );
}

export function InstanceSettingsDialog({ projectId, instance, title, schema, onClose }: Props) {
  const baseId = useId();
  const fields = configFields(schema, instance.config);
  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.value])),
  );
  const [none, setNone] = useState<ReadonlySet<string>>(
    () => new Set(fields.filter((f) => f.value === null && fieldKind(f.field) !== "asset").map((f) => f.key)),
  );
  const [error, setError] = useState<string | null>(null);
  const set = (key: string, value: FieldValue) => setValues((v) => ({ ...v, [key]: value }));
  const toggleNone = (f: FormField, checked: boolean) => {
    setNone((keys) => new Set([...keys].filter((k) => k !== f.key).concat(checked ? [f.key] : [])));
    set(f.key, checked ? null : valueWhenFilled(f.key, f.field));
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errors = validateConfig(schema, values);
    if (errors.length > 0) {
      setError(t.invalid(errors));
      return;
    }
    setError(null);
    const config = fields.reduce(
      (acc, f) => withFieldValue(acc, f.key, values[f.key] ?? null),
      instance.config,
    );
    try {
      await client.rpc({
        method: "command",
        projectId,
        command: { method: "setInstanceConfig", instanceId: instance.id, config },
      });
      onClose();
    } catch {
      setError(t.failed);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.title(title)}</DialogTitle>
            <DialogDescription>{t.help}</DialogDescription>
          </DialogHeader>
          {fields.map((f) => {
            const value = values[f.key] ?? null;
            return (
              <div key={f.key} className="grid gap-2">
                <Label htmlFor={`${baseId}-${f.key}`}>{fieldLabel(f.key, f.field)}</Label>
                <div className="flex items-center gap-3">
                  <FieldInput
                    id={`${baseId}-${f.key}`}
                    projectId={projectId}
                    field={f}
                    value={value}
                    disabled={none.has(f.key)}
                    onChange={(v) => set(f.key, v)}
                  />
                  {f.field.nullable && fieldKind(f.field) !== "asset" && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`${baseId}-${f.key}-none`}
                        aria-label={t.noValue}
                        checked={value === null}
                        onCheckedChange={(c) => toggleNone(f, c === true)}
                      />
                      <Label htmlFor={`${baseId}-${f.key}-none`} className="text-xs text-muted-foreground">
                        {t.noValue}
                      </Label>
                    </div>
                  )}
                </div>
                {f.field.help && <p className="text-xs text-muted-foreground">{f.field.help}</p>}
              </div>
            );
          })}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit">{t.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
