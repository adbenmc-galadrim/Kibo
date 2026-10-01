import type { ComponentFormat } from "@kibo/schema";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { frCreations } from "../i18n/fr-creations";

const SEGMENT =
  "h-7 rounded-md px-3 text-xs text-muted-foreground hover:bg-transparent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm";

export type FormatPickerProps = {
  formats: readonly ComponentFormat[];
  value: ComponentFormat;
  onChange(next: ComponentFormat): void;
};

export function FormatPicker({ formats, value, onChange }: FormatPickerProps) {
  return (
    <ToggleGroup
      type="single"
      spacing={1}
      aria-label={frCreations.preview.format}
      className="rounded-lg bg-muted p-[3px]"
      value={value}
      onValueChange={(v) => {
        const next = formats.find((f) => f === v);
        if (next) onChange(next);
      }}
    >
      {formats.map((f) => (
        <ToggleGroupItem key={f} value={f} className={SEGMENT}>
          {frCreations.formats.labels[f]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
