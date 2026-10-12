import { DEFAULT_DUPLICATION_SETTINGS, type DuplicationSettings } from "@kibo/schema";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Switch } from "@kibo/sdk/ui/switch";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { Copy } from "lucide-react";
import { useId, useState } from "react";
import { frOverlapsSettings } from "../i18n/fr-overlaps-settings";
import { GenericExportsField } from "./GenericExportsField";
import { IgnoredOverlaps } from "./IgnoredOverlaps";

type Props = {
  value: DuplicationSettings | null;
  onChange(next: DuplicationSettings | null): void;
  projectId: string;
  disabled: boolean;
};

const t = frOverlapsSettings.settings;
const MAX_GLOBS = 50;
const MAX_GLOB_CHARS = 200;

export const sameDuplication = (a: DuplicationSettings | null, b: DuplicationSettings | null): boolean =>
  JSON.stringify(a ?? DEFAULT_DUPLICATION_SETTINGS) === JSON.stringify(b ?? DEFAULT_DUPLICATION_SETTINGS);

const stored = (next: DuplicationSettings): DuplicationSettings | null =>
  sameDuplication(next, null) ? null : next;

function parseMinLines(text: string): number | null {
  const n = Number(text);
  return Number.isInteger(n) && n >= 4 && n <= 50 ? n : null;
}

function parseGlobs(text: string): { globs: string[]; problem: string | null } {
  const globs = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (globs.length > MAX_GLOBS) return { globs, problem: t.ignoreTooMany };
  if (globs.some((g) => g.length > MAX_GLOB_CHARS)) return { globs, problem: t.ignoreTooLong };
  return { globs, problem: null };
}

export function DuplicationFields({ value, onChange, projectId, disabled }: Props) {
  const ids = {
    legend: useId(),
    minLines: useId(),
    minLinesHelp: useId(),
    tests: useId(),
    testsHelp: useId(),
    ignore: useId(),
    ignoreHelp: useId(),
    exports: useId(),
    exportsHelp: useId(),
    ignored: useId(),
    ignoredHelp: useId(),
  };
  const current = value ?? DEFAULT_DUPLICATION_SETTINGS;
  const [minLines, setMinLines] = useState(String(current.minLines));
  const [globs, setGlobs] = useState(current.ignore.join("\n"));
  const [globsProblem, setGlobsProblem] = useState<string | null>(null);
  const minLinesInvalid = parseMinLines(minLines) === null;
  const emit = (patch: Partial<DuplicationSettings>) => onChange(stored({ ...current, ...patch }));

  const changeMinLines = (text: string) => {
    setMinLines(text);
    const n = parseMinLines(text);
    if (n !== null) emit({ minLines: n });
  };
  const changeGlobs = (text: string) => {
    setGlobs(text);
    const parsed = parseGlobs(text);
    setGlobsProblem(parsed.problem);
    if (parsed.problem === null) emit({ ignore: parsed.globs });
  };

  return (
    <fieldset aria-labelledby={ids.legend} className="grid gap-3 border-t pt-4" disabled={disabled}>
      <legend id={ids.legend} className="float-left flex items-center gap-2 text-sm font-medium">
        <Copy aria-hidden className="size-4" />
        {t.legend}
      </legend>
      <p className="clear-left text-xs text-muted-foreground">{t.help}</p>
      {disabled && <p className="text-xs text-muted-foreground">{t.localOnly}</p>}
      <div className="flex items-center gap-2">
        <Switch
          id={`${ids.legend}-enabled`}
          checked={current.enabled}
          disabled={disabled}
          onCheckedChange={(enabled) => emit({ enabled })}
        />
        <Label htmlFor={`${ids.legend}-enabled`} className="text-sm font-normal">
          {t.enabled}
        </Label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid content-start gap-1.5">
          <Label htmlFor={ids.minLines}>{t.minLines}</Label>
          <Input
            id={ids.minLines}
            type="number"
            min={4}
            max={50}
            value={minLines}
            disabled={disabled}
            className="w-24"
            aria-describedby={ids.minLinesHelp}
            aria-invalid={minLinesInvalid}
            onChange={(e) => changeMinLines(e.target.value)}
          />
          <p id={ids.minLinesHelp} className="text-xs text-muted-foreground">
            {t.minLinesHelp}
          </p>
          {minLinesInvalid && <p className="text-xs text-destructive">{t.minLinesError}</p>}
        </div>
        <div className="grid content-start gap-1.5 sm:pt-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id={ids.tests}
              checked={current.compareTests}
              disabled={disabled}
              aria-describedby={ids.testsHelp}
              onCheckedChange={(checked) => emit({ compareTests: checked === true })}
            />
            <Label htmlFor={ids.tests} className="font-normal">
              {t.compareTests}
            </Label>
          </div>
          <p id={ids.testsHelp} className="text-xs text-muted-foreground">
            {t.compareTestsHelp}
          </p>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={ids.ignore}>{t.ignore}</Label>
        <Textarea
          id={ids.ignore}
          value={globs}
          rows={2}
          disabled={disabled}
          spellCheck={false}
          className="font-mono text-xs"
          aria-describedby={ids.ignoreHelp}
          aria-invalid={globsProblem !== null}
          onChange={(e) => changeGlobs(e.target.value)}
        />
        <p id={ids.ignoreHelp} className="text-xs text-muted-foreground">
          {t.ignoreHelp}
        </p>
        {globsProblem !== null && <p className="text-xs text-destructive">{globsProblem}</p>}
      </div>
      <div className="grid gap-1.5">
        <span id={ids.exports} className="text-sm font-medium">
          {t.genericExports}
        </span>
        <GenericExportsField
          names={current.genericExports}
          onChange={(genericExports) => emit({ genericExports })}
          disabled={disabled}
          labelledBy={ids.exports}
          describedBy={ids.exportsHelp}
        />
        <p id={ids.exportsHelp} className="text-xs text-muted-foreground">
          {t.genericExportsHelp}
        </p>
      </div>
      <div className="grid gap-1.5">
        <span id={ids.ignored} className="text-sm font-medium">
          {t.ignored}
        </span>
        <IgnoredOverlaps
          projectId={projectId}
          disabled={disabled}
          labelledBy={ids.ignored}
          describedBy={ids.ignoredHelp}
        />
        <p id={ids.ignoredHelp} className="text-xs text-muted-foreground">
          {t.ignoredHelp}
        </p>
      </div>
    </fieldset>
  );
}
