import type { Skill } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { ChevronRight, Laptop, MessageSquareText, Package } from "lucide-react";
import { frSkills } from "../i18n/fr-skills";
import { SkillRow } from "./SkillRow";
import { groupNotes, type SkillGroupView } from "./skill-sections";

type Props = {
  group: SkillGroupView;
  now: number;
  open: boolean;
  onOpenChange(open: boolean): void;
  onOpen(skill: Skill): void;
};

function GroupIcon({ group }: { group: SkillGroupView }) {
  if (group.color)
    return <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: group.color }} />;
  const Icon = group.readOnly ? Package : Laptop;
  return <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />;
}

function GroupBody({ group, now, onOpen }: Pick<Props, "group" | "now" | "onOpen">) {
  if (group.skills.length === 0)
    return <p className="px-4 py-3 text-xs text-muted-foreground">{frSkills.groups.none}</p>;
  return (
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
  );
}

export function SkillGroup({ group, now, open, onOpenChange, onOpen }: Props) {
  const notes = groupNotes(group);
  return (
    <Collapsible asChild open={open} onOpenChange={onOpenChange}>
      <section aria-label={group.title} className="overflow-hidden rounded-lg border bg-card">
        <h3 className="text-sm">
          <CollapsibleTrigger
            aria-label={group.title}
            className="group flex w-full min-w-0 items-center gap-2 bg-muted/40 px-4 py-2 text-left hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset data-[state=open]:border-b"
          >
            <ChevronRight
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90"
            />
            <GroupIcon group={group} />
            <span className="font-semibold">{group.title}</span>
            <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px] font-normal">
              {group.skills.length}
            </Badge>
            {notes > 0 && (
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand-strong">
                <MessageSquareText aria-hidden className="size-3.5" />
                {frSkills.row.notes(notes)}
              </span>
            )}
            {group.hint && (
              <span className="truncate font-mono text-xs text-muted-foreground">{group.hint}</span>
            )}
          </CollapsibleTrigger>
        </h3>
        <CollapsibleContent>
          <GroupBody group={group} now={now} onOpen={onOpen} />
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
