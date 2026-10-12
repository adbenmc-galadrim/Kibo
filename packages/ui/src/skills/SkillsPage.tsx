import type { ProjectSummary, Skill, SkillId, SkillReview } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { useState } from "react";
import { frSkills } from "../i18n/fr-skills";
import { SkillEditor } from "./SkillEditor";
import { SkillList } from "./SkillList";
import { groupKeyOf, sameSkill } from "./skill-sections";
import { useSkills } from "./use-skills";

type Props = { projects: ProjectSummary[]; initialSkill?: SkillId };
type Opened = { key: Pick<Skill, "id" | "source" | "projectId">; carried: SkillReview | null };

const t = frSkills.page;

function initialOf(skills: readonly Skill[], id: SkillId | undefined): Skill | null {
  if (!id) return null;
  const matches = skills.filter((s) => s.id === id);
  return matches.find((s) => s.shadowedBy === null) ?? matches[0] ?? null;
}

export function SkillsPage({ projects, initialSkill }: Props) {
  const list = useSkills(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [fromTarget, setFromTarget] = useState(initialSkill !== undefined);
  const [reveal, setReveal] = useState<string | null>(null);
  if (list.skills === null)
    return list.error ? (
      <div className="grid content-start gap-3 p-6">
        <p role="alert" className="text-sm text-destructive">
          {t.failed}
        </p>
        <Button variant="outline" size="sm" className="w-fit" onClick={list.reload}>
          {t.retry}
        </Button>
      </div>
    ) : (
      <p className="p-6 text-sm text-muted-foreground">{t.loading}</p>
    );
  const skills = list.skills;
  const current = opened
    ? (skills.find((s) => sameSkill(s, opened.key)) ?? null)
    : fromTarget
      ? initialOf(skills, initialSkill)
      : null;
  const open = (skill: Skill, carried: SkillReview | null = null) => {
    setOpened({ key: { id: skill.id, source: skill.source, projectId: skill.projectId }, carried });
    if (!skills.some((s) => sameSkill(s, skill))) list.reload();
  };
  if (opened && !current)
    return <p className="p-6 text-sm text-muted-foreground">{frSkills.editor.loading}</p>;
  if (current)
    return (
      <SkillEditor
        key={`${current.source}:${current.projectId ?? ""}:${current.id}`}
        skill={current}
        projects={projects}
        carried={opened?.carried ?? null}
        onBack={() => {
          setReveal(groupKeyOf(current));
          setOpened(null);
          setFromTarget(false);
        }}
        onOpenSkill={open}
      />
    );
  return (
    <SkillList
      skills={skills}
      projects={projects}
      partialWatch={list.partialWatch}
      reveal={reveal}
      onOpen={open}
    />
  );
}
