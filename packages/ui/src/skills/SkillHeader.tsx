import type { ProjectSummary, Skill } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import {
  BookOpen,
  ChevronRight,
  Copy,
  Folder,
  History,
  Lock,
  MessageSquareText,
  Package,
  Trash2,
} from "lucide-react";
import { projectName } from "../agents/catalog/agent-labels";
import { frSkills } from "../i18n/fr-skills";

export type SkillDialog = "history" | "delete" | "copy";

type Props = {
  skill: Skill;
  projects: readonly ProjectSummary[];
  dirty: boolean;
  canSave: boolean;
  openReviews: number;
  notesOpen: boolean;
  onBack(): void;
  onSave(): void;
  onNotes(): void;
  onDialog(dialog: SkillDialog): void;
};

const t = frSkills.editor;

export function sourceText(skill: Skill, projects: readonly ProjectSummary[]): string {
  if (skill.plugin) return t.sources.plugin(skill.plugin.name, skill.plugin.version);
  if (skill.source === "project") return t.sources.project(projectName(skill.projectId, projects));
  return t.sources.user;
}

export function SkillHeader(p: Props) {
  const { skill } = p;
  const SourceIcon = skill.plugin ? Package : Folder;
  return (
    <>
      <nav aria-label={t.breadcrumb} className="flex items-center gap-1 text-sm text-muted-foreground">
        <button type="button" className="hover:text-foreground hover:underline" onClick={p.onBack}>
          {t.back}
        </button>
        <ChevronRight aria-hidden className="size-3.5" />
        <span aria-current="page" className="font-mono text-foreground">
          {skill.id}
        </span>
      </nav>
      <header className="flex flex-wrap items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg border">
          <BookOpen aria-hidden className="size-5" />
        </span>
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="truncate font-mono text-xl font-semibold">{skill.id}</h2>
            <Badge variant="outline" className="gap-1 text-[10px] font-normal">
              <SourceIcon aria-hidden className="size-3" />
              {sourceText(skill, p.projects)}
            </Badge>
            {skill.readOnly && (
              <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                <Lock aria-hidden className="size-3" />
                {frSkills.row.readOnly}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{t.runs30d(skill.usage.runs30d)}</span>
            {p.dirty && (
              <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                <span aria-hidden className="size-1.5 rounded-full bg-brand" />
                {t.dirty}
              </Badge>
            )}
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">{skill.path}/SKILL.md</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {skill.readOnly && (
            <Button size="sm" onClick={() => p.onDialog("copy")}>
              <Copy />
              {t.copyToEdit}
            </Button>
          )}
          <Button variant="outline" size="sm" aria-pressed={p.notesOpen} onClick={p.onNotes}>
            <MessageSquareText />
            {t.notes(p.openReviews)}
          </Button>
          {!skill.readOnly && (
            <>
              <Button variant="outline" size="sm" onClick={() => p.onDialog("history")}>
                <History />
                {t.history}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                aria-label={t.delete}
                onClick={() => p.onDialog("delete")}
              >
                <Trash2 />
              </Button>
              <Button size="sm" disabled={!p.canSave} onClick={p.onSave}>
                {t.save}
              </Button>
            </>
          )}
        </div>
      </header>
    </>
  );
}
