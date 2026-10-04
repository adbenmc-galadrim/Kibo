import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { useId } from "react";

type Props = { label: string; help: string; value: string; invalid: boolean; onChange(value: string): void };

export function UrlInput({ label, help, value, invalid, onChange }: Props) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="url"
        className="font-mono"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
      />
      <p className="text-xs text-muted-foreground">{help}</p>
    </div>
  );
}
