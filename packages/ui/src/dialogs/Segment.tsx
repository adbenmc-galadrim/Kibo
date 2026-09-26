import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { useId } from "react";

type Option = { value: string; label: string; disabled?: boolean; hint?: string };

export function Segment({ options, value }: { options: Option[]; value: string }) {
  const base = useId();
  return (
    <RadioGroup value={value} className="grid grid-flow-col auto-cols-fr gap-1 rounded-md bg-muted p-1">
      {options.map((o) => (
        <label
          key={o.value}
          htmlFor={`${base}-${o.value}`}
          title={o.hint}
          className={`relative flex items-center justify-center rounded-sm px-2 py-1.5 text-sm whitespace-nowrap has-[[data-state=checked]]:bg-background has-[[data-state=checked]]:shadow-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
            o.disabled ? "cursor-not-allowed text-muted-foreground" : ""
          }`}
        >
          <RadioGroupItem
            id={`${base}-${o.value}`}
            value={o.value}
            aria-label={o.label}
            disabled={o.disabled}
            className="absolute inset-0 z-10 aspect-auto size-auto rounded-sm border-0 opacity-0 shadow-none disabled:cursor-not-allowed"
          />
          {o.label}
        </label>
      ))}
    </RadioGroup>
  );
}
