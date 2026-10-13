import { Badge } from "@kibo/sdk/ui/badge";
import { Input } from "@kibo/sdk/ui/input";
import { X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { frOverlaps } from "../i18n/fr-overlaps";

type Props = {
  names: readonly string[];
  onChange(next: string[]): void;
  disabled: boolean;
  labelledBy: string;
  describedBy: string;
};

const t = frOverlaps.settings;
const MAX_NAMES = 100;
const MAX_CHARS = 64;

function addProblem(names: readonly string[], name: string): string | null {
  if (name.length > MAX_CHARS) return t.exportTooLong;
  if (!names.includes(name) && names.length >= MAX_NAMES) return t.exportsTooMany;
  return null;
}

export function GenericExportsField({ names, onChange, disabled, labelledBy, describedBy }: Props) {
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const add = () => {
    const name = draft.trim();
    if (name === "") return;
    const refused = addProblem(names, name);
    setProblem(refused);
    if (refused !== null) return;
    setDraft("");
    if (!names.includes(name)) onChange([...names, name]);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    add();
  };
  return (
    <div className="grid gap-1.5">
      <ul aria-labelledby={labelledBy} className="flex flex-wrap items-center gap-1.5">
        {names.map((name) => (
          <li key={name}>
            <Badge variant="secondary" className="gap-1 pr-1 font-mono text-2xs">
              {name}
              <button
                type="button"
                disabled={disabled}
                aria-label={t.removeExport(name)}
                className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
                onClick={() => onChange(names.filter((n) => n !== name))}
              >
                <X aria-hidden className="size-3" />
              </button>
            </Badge>
          </li>
        ))}
      </ul>
      <Input
        value={draft}
        disabled={disabled}
        spellCheck={false}
        placeholder={t.addExport}
        aria-label={t.addExportLabel}
        aria-describedby={describedBy}
        aria-invalid={problem !== null}
        className="h-8 w-40 font-mono text-xs"
        onChange={(e) => {
          setDraft(e.target.value);
          setProblem(null);
        }}
        onKeyDown={onKeyDown}
      />
      {problem !== null && <p className="text-xs text-destructive">{problem}</p>}
    </div>
  );
}
