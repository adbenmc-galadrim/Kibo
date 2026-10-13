import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { frAgentsSkills } from "../i18n/fr-agents-skills";
import { useSkillComplete } from "../skill-complete/use-skill-complete";

type Props = {
  id: string;
  agentRef: string | null;
  projectId: string;
  value: string;
  onChange(value: string): void;
};

const t = frAgentsSkills.assign;

export function AssignBriefField({ id, agentRef, projectId, value, onChange }: Props) {
  const complete = useSkillComplete({
    agentRef,
    projectId,
    value,
    onValueChange: onChange,
    placement: "below",
  });
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{t.brief}</Label>
      <div className="relative">
        <Input id={id} placeholder={t.briefPlaceholder} {...complete.inputProps} />
        {complete.list}
      </div>
    </div>
  );
}
