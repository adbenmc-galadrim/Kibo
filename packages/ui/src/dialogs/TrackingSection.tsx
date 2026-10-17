import { DEFAULT_OPEN_LIMIT, openLimitOf, type TrackingSettings } from "@kibo/schema";
import { Label } from "@kibo/sdk/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { useId } from "react";
import { frTracking } from "../i18n/fr-tracking";

const t = frTracking.section;
const LIMITS = Array.from({ length: 10 }, (_, i) => String(i + 1));

type Props = {
  value: TrackingSettings | null;
  onChange(next: TrackingSettings | null): void;
  disabled: boolean;
};

const settingsOf = (limit: number): TrackingSettings | null =>
  limit === DEFAULT_OPEN_LIMIT ? null : { openLimit: limit };

export function TrackingSection({ value, onChange, disabled }: Props) {
  const limitId = useId();
  const helpId = useId();
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{t.title}</legend>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={limitId} className="font-normal">
          {t.openLimit}
        </Label>
        <Select
          value={String(openLimitOf(value))}
          disabled={disabled}
          onValueChange={(v) => onChange(settingsOf(Number(v)))}
        >
          <SelectTrigger id={limitId} aria-describedby={helpId} className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMITS.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p id={helpId} className="text-xs text-muted-foreground">
        {t.openLimitHelp}
      </p>
    </fieldset>
  );
}
