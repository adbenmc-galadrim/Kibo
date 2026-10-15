import { ADD_DIRS_MAX, isSafeAddDir } from "@kibo/schema";
import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { useId, useState } from "react";
import { frDeliverySettings } from "../../i18n/fr-delivery-settings";
import { expandHome, tildify } from "../../lib/expand-home";

type Props = {
  value: readonly string[];
  home: string | null;
  onChange(dirs: string[]): void;
  onProblem?(problem: string | null): void;
  disabled: boolean;
};

const t = frDeliverySettings.addDirs;

export const dirsOf = (lines: readonly string[], home: string): string[] => [
  ...new Set(lines.map((line) => expandHome(line, home)).filter((path) => path.length > 0)),
];

export function addDirsProblem(lines: readonly string[], home: string): string | null {
  const dirs = dirsOf(lines, home);
  if (dirs.some((dir) => !isSafeAddDir(dir, home))) return t.unsafe;
  return dirs.length > ADD_DIRS_MAX ? t.tooMany : null;
}

export function AddDirsField({ value, home, onChange, onProblem, disabled }: Props) {
  const id = useId();
  const [text, setText] = useState(() => value.map((dir) => tildify(dir, home)).join("\n"));
  const [problem, setProblem] = useState<string | null>(null);
  const edit = (next: string) => {
    setText(next);
    if (home === null) return;
    const lines = next.split("\n");
    const found = addDirsProblem(lines, home);
    setProblem(found);
    onProblem?.(found);
    if (found === null) onChange(dirsOf(lines, home));
  };
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{t.label}</Label>
      <Textarea
        id={id}
        value={text}
        disabled={disabled || home === null}
        spellCheck={false}
        rows={2}
        placeholder="~/.claude/skills"
        aria-invalid={problem !== null ? true : undefined}
        aria-describedby={`${id}-help`}
        className="font-mono text-xs md:text-xs"
        onChange={(e) => edit(e.target.value)}
      />
      <p id={`${id}-help`} className={problem ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
        {problem ?? t.help}
      </p>
    </div>
  );
}
