import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { useId, useState } from "react";
import { frOverlaps } from "../i18n/fr-overlaps";
import { parseGlobs } from "./glob-lines";

type Props = { value: readonly string[]; disabled: boolean; onChange(next: string[]): void };

const t = frOverlaps.settings;

export function SharedFilesField({ value, disabled, onChange }: Props) {
  const id = useId();
  const [text, setText] = useState(value.join("\n"));
  const [problem, setProblem] = useState<string | null>(null);
  const change = (next: string) => {
    setText(next);
    const parsed = parseGlobs(next);
    setProblem(parsed.problem);
    if (parsed.problem === null) onChange(parsed.globs);
  };
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{t.shared}</Label>
      <Textarea
        id={id}
        value={text}
        rows={4}
        disabled={disabled}
        spellCheck={false}
        className="max-h-48 font-mono text-xs"
        aria-describedby={`${id}-help`}
        aria-invalid={problem !== null}
        onChange={(e) => change(e.target.value)}
      />
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        {t.sharedHelp}
      </p>
      {problem !== null && <p className="text-xs text-destructive">{problem}</p>}
    </div>
  );
}
