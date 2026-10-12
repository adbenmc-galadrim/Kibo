import type { Agent, ProjectSummary } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Bot, ChevronRight, Eye, FileText, History, PenLine, Trash2 } from "lucide-react";
import { frAgentsSkills } from "../../i18n/fr-agents-skills";
import { scopeText } from "../catalog/agent-labels";

export type SheetDialog = "preview" | "history" | "rename" | "delete" | "file";

type Props = {
  agent: Agent;
  projects: readonly ProjectSummary[];
  dirty: boolean;
  canSave: boolean;
  onBack(): void;
  onSave(): void;
  onDialog(dialog: SheetDialog): void;
};

const t = frAgentsSkills.sheet;

export function AgentHeader({ agent, projects, dirty, canSave, onBack, onSave, onDialog }: Props) {
  const system = agent.scope === "system";
  return (
    <>
      <nav aria-label={t.breadcrumb} className="flex items-center gap-1 text-sm text-muted-foreground">
        <button type="button" className="hover:text-foreground hover:underline" onClick={onBack}>
          {t.back}
        </button>
        <ChevronRight aria-hidden className="size-3.5" />
        <span aria-current="page" className="font-mono text-foreground">
          {agent.name}
        </span>
      </nav>
      <header className="flex flex-wrap items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/15">
          <Bot aria-hidden className="size-5 text-brand-strong dark:text-brand" />
        </span>
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="truncate font-mono text-xl font-semibold">{agent.name}</h2>
            <Badge variant="outline" className="text-[10px] font-normal">
              {scopeText(agent, projects)}
            </Badge>
            {dirty && (
              <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                <span aria-hidden className="size-1.5 rounded-full bg-brand" />
                {t.dirty}
              </Badge>
            )}
          </div>
          <button
            type="button"
            aria-label={t.openFile(agent.path)}
            onClick={() => onDialog("file")}
            className="flex w-fit min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            <FileText aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{agent.path}</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onDialog("preview")}>
            <Eye />
            {t.preview}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDialog("history")}>
            <History />
            {t.history}
          </Button>
          {!system && (
            <Button variant="outline" size="sm" onClick={() => onDialog("rename")}>
              <PenLine />
              {t.rename}
            </Button>
          )}
          {!system && (
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label={t.delete}
              onClick={() => onDialog("delete")}
            >
              <Trash2 />
            </Button>
          )}
          <Button size="sm" disabled={!canSave} onClick={onSave}>
            {t.save}
          </Button>
        </div>
      </header>
    </>
  );
}
