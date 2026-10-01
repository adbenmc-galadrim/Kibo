import { type ComponentFormat, type DraftKind, formatsOf } from "@kibo/schema";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { fr } from "../i18n/fr";
import { FormatsField } from "./FormatsField";

export type DescribeEdits = {
  title: string | null;
  componentId: string | null;
  kind: DraftKind;
  withServer: boolean;
  formats: ComponentFormat[];
};

export const initialEdits = (): DescribeEdits => ({
  title: null,
  componentId: null,
  kind: "widget",
  withServer: false,
  formats: formatsOf({ kind: "widget" }),
});

type Props = {
  id: string;
  described: boolean;
  edits: DescribeEdits;
  title: string;
  componentId: string;
  idValid: boolean;
  onChange(patch: Partial<DescribeEdits>): void;
};

const KINDS = ["widget", "view", "both"] as const;
const kindOf = (v: string): DraftKind => (v === "view" || v === "both" ? v : "widget");

export function DescribeFields({ id, described, edits, title, componentId, idValid, onChange }: Props) {
  const t = fr.ai.create;
  return (
    <div className="grid grid-cols-2 items-end gap-2">
      {described && (
        <>
          <div className="col-span-2 grid gap-1">
            <Label htmlFor={`${id}-title`} className="text-xs">
              {t.titleLabel}
            </Label>
            <Input
              id={`${id}-title`}
              maxLength={60}
              value={title}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </div>
          <div className="col-span-2 grid gap-1">
            <Label htmlFor={`${id}-id`} className="text-xs">
              {t.idLabel}
            </Label>
            <Input
              id={`${id}-id`}
              className="font-mono"
              maxLength={40}
              aria-invalid={!idValid}
              aria-describedby={idValid ? undefined : `${id}-id-help`}
              value={componentId}
              onChange={(e) => onChange({ componentId: e.target.value.toLowerCase() })}
            />
            {!idValid && (
              <p id={`${id}-id-help`} className="text-xs text-destructive">
                {t.idInvalid}
              </p>
            )}
          </div>
        </>
      )}
      <div className="grid gap-1">
        <Label htmlFor={`${id}-kind`} className="text-xs">
          {t.kindLabel}
        </Label>
        <Select
          value={edits.kind}
          onValueChange={(v) => {
            const kind = kindOf(v);
            onChange({ kind, formats: formatsOf({ kind }) });
          }}
        >
          <SelectTrigger id={`${id}-kind`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {t.kinds[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <label htmlFor={`${id}-server`} className="flex h-9 items-center gap-2 text-xs">
        <Checkbox
          id={`${id}-server`}
          checked={edits.withServer}
          onCheckedChange={(v) => onChange({ withServer: v === true })}
        />
        {t.withServer}
      </label>
      <div className="col-span-2 pt-1">
        <FormatsField kind={edits.kind} value={edits.formats} onChange={(formats) => onChange({ formats })} />
      </div>
    </div>
  );
}
