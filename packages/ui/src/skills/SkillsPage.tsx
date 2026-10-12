import type { ProjectSummary, Skill, SkillId, SkillReview } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Package, Search } from "lucide-react";
import { useState } from "react";
import { frSkills } from "../i18n/fr-skills";
import { SkillEditor } from "./SkillEditor";
import { SkillGroup } from "./SkillGroup";
import { groupSkills, sameSkill } from "./skill-sections";
import { useSkills } from "./use-skills";

type Props = { projects: ProjectSummary[]; initialSkill?: SkillId };
type Opened = { key: Pick<Skill, "id" | "source" | "projectId">; carried: SkillReview | null };

const t = frSkills.page;

function initialOf(skills: readonly Skill[], id: SkillId | undefined): Skill | null {
  if (!id) return null;
  const matches = skills.filter((s) => s.id === id);
  return matches.find((s) => s.shadowedBy === null) ?? matches[0] ?? null;
}

function SkillList({
  skills,
  projects,
  partialWatch,
  onOpen,
}: {
  skills: Skill[];
  projects: ProjectSummary[];
  partialWatch: boolean;
  onOpen(skill: Skill): void;
}) {
  const now = Date.now();
  const [query, setQuery] = useState("");
  const groups = groupSkills(skills, projects, query);
  const firstPlugin = groups.find((g) => g.readOnly)?.key;
  const open = skills.reduce((n, s) => n + s.reviews.open, 0);
  return (
    <div className="grid content-start gap-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search aria-hidden className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            type="search"
            aria-label={t.search}
            placeholder={t.search}
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="flex-1" />
        {open > 0 && <span className="text-sm font-medium text-brand-strong">{t.openNotes(open)}</span>}
      </div>
      {partialWatch && <p className="text-xs text-muted-foreground">{t.partialWatch}</p>}
      {groups.length === 0 && <p className="text-sm text-muted-foreground">{t.empty}</p>}
      {groups.map((group) => (
        <div key={group.key} className="grid gap-2">
          {group.key === firstPlugin && (
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Package aria-hidden className="size-4 text-muted-foreground" />
              {frSkills.groups.plugins}
              <span className="font-mono text-xs font-normal text-muted-foreground">
                {frSkills.groups.pluginsHint}
              </span>
            </h2>
          )}
          <SkillGroup group={group} now={now} onOpen={onOpen} />
        </div>
      ))}
    </div>
  );
}

export function SkillsPage({ projects, initialSkill }: Props) {
  const list = useSkills(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [fromTarget, setFromTarget] = useState(initialSkill !== undefined);
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
          setOpened(null);
          setFromTarget(false);
        }}
        onOpenSkill={open}
      />
    );
  return <SkillList skills={skills} projects={projects} partialWatch={list.partialWatch} onOpen={open} />;
}
