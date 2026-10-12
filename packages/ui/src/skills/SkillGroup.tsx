import type { Skill } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Laptop, Package } from "lucide-react";
import { frSkills } from "../i18n/fr-skills";
import { SkillRow } from "./SkillRow";
import type { SkillGroupView } from "./skill-sections";

type Props = { group: SkillGroupView; now: number; onOpen(skill: Skill): void };

function GroupIcon({ group }: { group: SkillGroupView }) {
  if (group.color)
    return <span aria-hidden className="size-2 rounded-full" style={{ background: group.color }} />;
  const Icon = group.readOnly ? Package : Laptop;
  return <Icon aria-hidden className="size-4 text-muted-foreground" />;
}

export function SkillGroup({ group, now, onOpen }: Props) {
  return (
    <section aria-label={group.title} className="overflow-hidden rounded-lg border bg-card">
      <header className="flex min-w-0 items-center gap-2 border-b bg-muted/40 px-4 py-2">
        <GroupIcon group={group} />
        <h3 className="text-sm font-semibold">{group.title}</h3>
        <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px] font-normal">
          {group.skills.length}
        </Badge>
        {group.hint && <span className="truncate font-mono text-xs text-muted-foreground">{group.hint}</span>}
      </header>
      {group.skills.length === 0 ? (
        <p className="px-4 py-3 text-xs text-muted-foreground">{frSkills.groups.none}</p>
      ) : (
        <ul className="divide-y">
          {group.skills.map((skill) => (
            <SkillRow
              key={`${skill.source}:${skill.projectId ?? ""}:${skill.id}`}
              skill={skill}
              now={now}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
