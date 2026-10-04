import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { KeyRound } from "lucide-react";
import { useId } from "react";

type Props = {
  label: string;
  placeholder: string;
  help: string;
  value: string;
  invalid: boolean;
  onChange(value: string): void;
};

export function SecretInput({ label, placeholder, help, value, invalid, onChange }: Props) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <KeyRound
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={id}
          type="password"
          autoComplete="off"
          spellCheck={false}
          className="pl-9 font-mono"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
        />
      </div>
      <p className="text-xs text-muted-foreground">{help}</p>
    </div>
  );
}
