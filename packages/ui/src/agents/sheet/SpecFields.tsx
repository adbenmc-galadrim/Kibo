import { descriptionProblem } from "@kibo/schema";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { useId, useState } from "react";
import { MarkdownPane, type PaneMode } from "../../file-editor/MarkdownPane";
import { frAgentsSkills } from "../../i18n/fr-agents-skills";
import { ClaudeCodeLine, ModelSelect } from "../catalog/AgentFields";
import type { SpecDraft } from "./use-agent-sheet";

type Props = {
  name: string;
  draft: SpecDraft;
  onDraft(patch: Partial<SpecDraft>): void;
  body: string;
  bodyKey: number;
  onBody(body: string): void;
  onSave(): void;
  readOnly: boolean;
};

const t = frAgentsSkills.sheet;

export function SpecFields({ name, draft, onDraft, body, bodyKey, onBody, onSave, readOnly }: Props) {
  const id = useId();
  const [mode, setMode] = useState<PaneMode>("edit");
  const problem = draft.description.trim() === "" ? t.descriptionHelp : descriptionProblem(draft.description);
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="grid content-start gap-1.5">
          <Label htmlFor={`${id}-description`}>{t.description}</Label>
          <Input
            id={`${id}-description`}
            value={draft.description}
            readOnly={readOnly}
            aria-invalid={problem !== null}
            onChange={(e) => onDraft({ description: e.target.value })}
          />
          <p
            className={
              problem ? "text-xs text-amber-700 dark:text-amber-400" : "text-xs text-muted-foreground"
            }
          >
            {problem ?? t.descriptionHelp}
          </p>
        </div>
        <div className="grid content-start gap-1.5">
          <Label htmlFor={`${id}-model`}>{t.model}</Label>
          <ModelSelect
            id={`${id}-model`}
            value={draft.model}
            onChange={(model) => onDraft({ model })}
            disabled={readOnly}
          />
        </div>
      </div>
      <ClaudeCodeLine name={name} description={draft.description} />
      <MarkdownPane
        value={body}
        onChange={onBody}
        mode={mode}
        onMode={setMode}
        label={t.spec}
        readOnly={readOnly}
        docKey={bodyKey}
        path={`${name}.md`}
        onSave={onSave}
        title={
          <p className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{t.spec}</span>
            <span className="text-xs text-muted-foreground">{t.specHelp}</span>
          </p>
        }
      />
    </div>
  );
}
