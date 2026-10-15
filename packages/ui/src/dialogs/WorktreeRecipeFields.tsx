import type { WorktreeRecipe } from "@kibo/schema";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { useId, useState } from "react";
import { frDeliverySettings } from "../i18n/fr-delivery-settings";
import { draftOf, type RecipeDraft, recipeOf } from "./recipe-draft";

type Props = {
  value: WorktreeRecipe | null;
  onChange(next: WorktreeRecipe | null): void;
  onProblem(problem: string | null): void;
  disabled: boolean;
};
type Key = keyof RecipeDraft;

const t = frDeliverySettings.recipe;
const MONO = "font-mono text-xs md:text-xs";

export function WorktreeRecipeFields({ value, onChange, onProblem, disabled }: Props) {
  const id = useId();
  const [draft, setDraft] = useState(() => draftOf(value));
  const [problem, setProblem] = useState<string | null>(null);
  const set = (key: Key) => (e: { target: { value: string } }) => {
    const next = { ...draft, [key]: e.target.value };
    setDraft(next);
    const result = recipeOf(next, value);
    setProblem(result.problem);
    onProblem(result.problem);
    if (result.problem === null) onChange(result.value);
  };
  const area = (key: Key, label: string, help?: string) => (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={`${id}-${key}`} className="text-xs">
        {label}
      </Label>
      <Textarea
        id={`${id}-${key}`}
        value={draft[key]}
        rows={2}
        disabled={disabled}
        spellCheck={false}
        className={MONO}
        onChange={set(key)}
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
  const number = (key: Key, label: string) => (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={`${id}-${key}`} className="text-xs">
        {label}
      </Label>
      <Input
        id={`${id}-${key}`}
        type="number"
        value={draft[key]}
        disabled={disabled}
        className="w-24"
        onChange={set(key)}
      />
    </div>
  );
  return (
    <fieldset aria-labelledby={`${id}-title`} className="grid gap-3 rounded-md border p-3">
      <legend className="float-left flex flex-wrap items-baseline gap-2">
        <span id={`${id}-title`} className="text-sm font-medium">
          {t.title}
        </span>
        <span className="text-xs text-muted-foreground">{t.help}</span>
      </legend>
      <div className="clear-left grid gap-3 sm:grid-cols-2">
        {area("copy", t.copy, t.copyHelp)}
        {area("copyFrom", t.copyFrom, t.copyFromHelp)}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-envFile`} className="text-xs">
          {t.envFile}
        </Label>
        <Input
          id={`${id}-envFile`}
          value={draft.envFile}
          disabled={disabled}
          spellCheck={false}
          placeholder=".env"
          className={`w-48 ${MONO}`}
          onChange={set("envFile")}
        />
      </div>
      {area("ports", t.ports, t.portsHelp)}
      <div className="flex flex-wrap gap-3">
        {number("from", t.from)}
        {number("step", t.step)}
        {number("count", t.count)}
      </div>
      <p className="text-xs text-muted-foreground">{t.portsRule}</p>
      {area("after", t.after, t.afterHelp)}
      {problem !== null && <p className="text-xs text-destructive">{problem}</p>}
    </fieldset>
  );
}
