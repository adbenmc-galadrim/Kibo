import {
  KiboError,
  renderTemplate,
  resolveWorktreePath,
  singleQuotedVariable,
  WorktreeSettings as WorktreeSchema,
  type WorktreeSettings,
  type WorktreeVars,
} from "@kibo/schema";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { useId } from "react";
import { frProject } from "../i18n/fr-project";

type Props = {
  value: WorktreeSettings | null;
  onChange(next: WorktreeSettings | null): void;
  disabled: boolean;
};
type Field = "baseRef" | "pathTemplate" | "setup";

const t = frProject.edit;
const SAMPLE: WorktreeVars = { branch: "feat/x", slug: "feat-x", key: "key-1", path: "/repo-feat-x" };
const EMPTY: WorktreeSettings = { baseRef: "", pathTemplate: "", setup: null };
const FIELD_ERRORS: Record<Field, string> = {
  baseRef: t.worktreeErrors.base,
  pathTemplate: t.worktreeErrors.path,
  setup: t.worktreeErrors.setup,
};

const isField = (key: unknown): key is Field =>
  key === "baseRef" || key === "pathTemplate" || key === "setup";
const refuses = (check: () => unknown): boolean => {
  try {
    check();
    return false;
  } catch (e) {
    if (e instanceof KiboError) return true;
    throw e;
  }
};

export function worktreeProblem(value: WorktreeSettings): string | null {
  const parsed = WorktreeSchema.safeParse(value);
  if (!parsed.success) {
    const key = parsed.error.issues[0]?.path[0];
    return isField(key) ? FIELD_ERRORS[key] : t.worktreeErrors.base;
  }
  if (refuses(() => resolveWorktreePath("/repo", parsed.data.pathTemplate, SAMPLE)))
    return t.worktreeErrors.path;
  const setup = parsed.data.setup;
  if (setup !== null && refuses(() => renderTemplate(setup, SAMPLE))) return t.worktreeErrors.setupVariables;
  if (setup !== null && singleQuotedVariable(setup) !== null) return t.worktreeErrors.setupQuoted;
  return null;
}

function nextValue(current: WorktreeSettings | null, field: Field, raw: string): WorktreeSettings | null {
  const next = { ...(current ?? EMPTY), [field]: field === "setup" && raw === "" ? null : raw };
  return next.baseRef === "" && next.pathTemplate === "" && next.setup === null ? null : next;
}

export function WorktreeFields({ value, onChange, disabled }: Props) {
  const ids = { base: useId(), path: useId(), setup: useId(), help: useId(), title: useId() };
  const problem = value === null ? null : worktreeProblem(value);
  const set = (field: Field) => (e: { target: { value: string } }) =>
    onChange(nextValue(value, field, e.target.value));
  const fields = [
    { id: ids.base, label: t.worktreeBase, field: "baseRef", text: value?.baseRef ?? "" },
    { id: ids.path, label: t.worktreePath, field: "pathTemplate", text: value?.pathTemplate ?? "" },
    { id: ids.setup, label: t.worktreeSetup, field: "setup", text: value?.setup ?? "" },
  ] as const;
  return (
    <fieldset aria-labelledby={ids.title} className="grid gap-2">
      <legend id={ids.title} className="text-sm font-medium">
        {t.worktree}
      </legend>
      {fields.map((f) => (
        <div key={f.field} className="grid grid-cols-[8rem_1fr] items-center gap-2">
          <Label htmlFor={f.id} className="text-xs text-muted-foreground">
            {f.label}
          </Label>
          <Input
            id={f.id}
            value={f.text}
            disabled={disabled}
            spellCheck={false}
            className="font-mono text-xs"
            aria-describedby={ids.help}
            aria-invalid={problem !== null}
            onChange={set(f.field)}
          />
        </div>
      ))}
      <div id={ids.help} className="grid gap-0.5 text-xs text-muted-foreground">
        <p>{t.worktreeHelp}</p>
        <p className="font-mono">{t.worktreeExample}</p>
      </div>
      {problem !== null && <p className="text-xs text-destructive">{problem}</p>}
    </fieldset>
  );
}
