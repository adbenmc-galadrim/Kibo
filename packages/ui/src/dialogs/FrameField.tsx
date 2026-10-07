import { designUrlProblem, parseDesignUrl } from "@kibo/schema";
import { Input } from "@kibo/sdk/ui/input";
import { frDesign } from "../i18n/fr-design";

type Props = {
  id: string;
  label: string;
  value: string | null;
  disabled: boolean;
  hint: boolean;
  onChange(raw: string): void;
};

export const isBadFrame = (value: unknown): boolean =>
  typeof value === "string" && value.trim() !== "" && parseDesignUrl(value) === null;

export function FrameField({ id, label, value, disabled, hint, onChange }: Props) {
  const text = value ?? "";
  const problem = text.trim() === "" ? null : designUrlProblem(text);
  const bad = problem !== null;
  return (
    <div className="grid min-w-0 flex-1 gap-1">
      <Input
        id={id}
        aria-label={label}
        type="url"
        spellCheck={false}
        placeholder={frDesign.field.placeholder}
        value={text}
        disabled={disabled}
        aria-invalid={bad}
        aria-describedby={bad && hint ? `${id}-invalid` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {problem && hint && (
        <p id={`${id}-invalid`} className="text-xs text-destructive">
          {frDesign.urlProblems[problem]}
        </p>
      )}
    </div>
  );
}
