import type { ProjectSummary, TabTarget, WorkspaceConfig } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { FileText, Folder } from "lucide-react";
import { frProject } from "../i18n/fr-project";

type Props = {
  project: ProjectSummary;
  config: Pick<WorkspaceConfig, "domains" | "guidelines">;
  go(target: TabTarget): void;
};

const t = frProject.edit.guidelines;

export function GuidelinesField({ project, config, go }: Props) {
  const files = config.guidelines.filter(
    (g) => (g.owner.scope === "project" || g.owner.scope === "domain") && g.owner.projectId === project.id,
  ).length;
  const domains = config.domains.filter(
    (d) => d.owner.scope === "project" && d.owner.projectId === project.id,
  ).length;
  return (
    <section className="grid gap-1.5 border-t pt-4">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <FileText aria-hidden className="size-4" />
        {t.title}
      </h3>
      <p className="text-xs text-muted-foreground">{t.help(project.name)}</p>
      <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
        <Folder aria-hidden className="size-4 text-muted-foreground" />
        <span className="flex-1">{t.summary(files, domains)}</span>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={() => go({ kind: "screen", screen: "domains", projectId: project.id })}
        >
          {t.open}
        </Button>
      </div>
    </section>
  );
}
