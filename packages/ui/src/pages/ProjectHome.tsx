import type { ProjectSnapshot } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Plus } from "lucide-react";
import { fr } from "../i18n/fr";
import { abbreviateHome } from "../lib/home-path";
import { canEdit } from "../state/access";

type Props = { project: ProjectSnapshot; onNewPage: () => void };

export function ProjectHome({ project, onNewPage }: Props) {
  return (
    <div className="p-6">
      <section className="grid gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold">{fr.projectHome.created(project.meta.name)}</h1>
          {project.meta.folder && (
            <p className="font-mono text-sm text-muted-foreground">{abbreviateHome(project.meta.folder)}</p>
          )}
        </div>
        {canEdit(project) && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
            <p className="text-sm text-muted-foreground">{fr.projectHome.help}</p>
            <Button variant="outline" size="sm" onClick={onNewPage}>
              <Plus className="size-4" /> {fr.nav.newPage}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
