import type { Page, ProjectSnapshot } from "@kibo/schema";
import { lazyPanel, readSource } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { linkedRepos } from "../dialogs/sync/linked-repos";
import { fr } from "../i18n/fr";
import { resolveOverlaps } from "../lib/format-grid";
import { PresenceAvatars, SourceHeader } from "../shell/lazy-screens";
import { PageActions } from "../shell/page-actions";
import { canEdit } from "../state/access";
import { DashboardGrid, WIDGET_CARD } from "./DashboardGrid";
import { InstanceFrame } from "./InstanceFrame";
import { useWideGrid } from "./use-wide-grid";
import { ViewActions, WidgetBody, WidgetHeader } from "./WidgetHeader";

const AddComponentDialog = lazyPanel(
  () => import("../dialogs/AddComponentDialog").then((m) => m.AddComponentDialog),
  fr.lazy,
  { fallback: "sr-only" },
);
const PublishDialog = lazyPanel(
  () => import("../components-page/PublishDialog").then((m) => m.PublishDialog),
  fr.lazy,
  { fallback: "sr-only" },
);

type Props = { project: ProjectSnapshot; page: Page; viewer: string };
export function PageView({ project, page, viewer }: Props) {
  const [adding, setAdding] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const wide = useWideGrid();
  const projectId = project.meta.id;
  const instances = project.instances.filter((i) => i.pageId === page.id);
  const [first] = instances;
  const editable = canEdit(project);
  const addButton = (page.kind === "dashboard" || !first) && editable && (
    <Button variant="outline" onClick={() => setAdding(true)}>
      <Plus className="size-4" /> {fr.page.addComponent}
    </Button>
  );
  return (
    <div className="flex h-full flex-col">
      {project.sync.shared && (
        <PageActions>
          <PresenceAvatars
            project={{ id: projectId, name: project.meta.name }}
            pages={project.pages}
            pageId={page.id}
          />
        </PageActions>
      )}
      {!first ? (
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div className="grid gap-3">
            <p className="text-muted-foreground">{fr.page.empty}</p>
            {addButton}
          </div>
        </div>
      ) : page.kind === "view" ? (
        <>
          <ViewActions projectId={projectId} instance={first} editable={editable} />
          {readSource(first.config) && <SourceHeader project={project} instance={first} />}
          <InstanceFrame
            projectId={projectId}
            instance={first}
            viewer={viewer}
            surface="view"
            format="full"
          />
        </>
      ) : (
        <DashboardGrid
          instances={instances}
          layouts={resolveOverlaps(instances)}
          narrow={!wide}
          renderWidget={(i, layout) => (
            <div className={WIDGET_CARD}>
              <WidgetHeader projectId={projectId} instance={i} editable={editable} />
              <WidgetBody project={project} page={page} instance={i} layout={layout} viewer={viewer} />
            </div>
          )}
          trailing={
            <div className="flex flex-wrap items-center gap-3">
              {addButton}
              {editable && !wide && (
                <p className="text-xs text-muted-foreground">{fr.page.editLayoutNarrow}</p>
              )}
            </div>
          }
        />
      )}
      {adding && (
        <AddComponentDialog
          projectId={projectId}
          page={page}
          taken={instances.map((i) => i.layout)}
          open
          onOpenChange={setAdding}
          onPublishDraft={(id) => setPublishing(id)}
          workflow={project.workflow}
          linked={linkedRepos(project)}
        />
      )}
      {publishing && <PublishDialog id={publishing} open onOpenChange={(o) => !o && setPublishing(null)} />}
    </div>
  );
}
