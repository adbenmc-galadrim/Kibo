import { ALLOW_MAX, isSafeAllowRule } from "@kibo/schema";
import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { useId, useState } from "react";
import { frAgentsPage } from "../i18n/fr-agents-page";

type Props = {
  value: string[];
  onChange(next: string[]): void;
  onProblem(problem: string | null): void;
  disabled: boolean;
};

const t = frAgentsPage.profile;

const rulesOf = (lines: readonly string[]): string[] =>
  lines.map((line) => line.trim()).filter((line) => line.length > 0);

export const allowRulesProblem = (lines: readonly string[]): string | null => {
  const rules = rulesOf(lines);
  const refused = rules.find((rule) => !isSafeAllowRule(rule));
  if (refused !== undefined) return refused === "Bash" ? t.allowBash : t.allowInvalid(refused);
  return rules.length > ALLOW_MAX ? t.allowTooMany : null;
};

export function AllowRulesField({ value, onChange, onProblem, disabled }: Props) {
  const id = useId();
  const [text, setText] = useState(value.join("\n"));
  const [problem, setProblem] = useState<string | null>(null);

  const edit = (next: string) => {
    setText(next);
    const lines = next.split("\n");
    const found = allowRulesProblem(lines);
    setProblem(found);
    onProblem(found);
    if (found === null) onChange(rulesOf(lines));
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor={`${id}-allow`}>{t.allow}</Label>
      <Textarea
        id={`${id}-allow`}
        value={text}
        disabled={disabled}
        spellCheck={false}
        rows={3}
        placeholder="Bash(pnpm *)"
        aria-invalid={problem !== null ? true : undefined}
        aria-describedby={`${id}-allow-help`}
        className="font-mono text-xs md:text-xs"
        onChange={(e) => edit(e.target.value)}
      />
      <p
        id={`${id}-allow-help`}
        className={problem ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
      >
        {problem ?? t.allowHelp}
      </p>
    </div>
  );
}
