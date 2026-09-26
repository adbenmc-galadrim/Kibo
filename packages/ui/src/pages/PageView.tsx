import { type Instance, isBuiltinId, type Page, type ProjectSnapshot, splitRef } from "@kibo/schema";
import { lazyPanel, readSource } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { linkedRepos } from "../dialogs/sync/linked-repos";
import { fr } from "../i18n/fr";
import { componentIcon } from "../registry";
import { SourceHeader } from "../shell/lazy-screens";
import { PageActions } from "../shell/page-actions";
import { InstanceFrame } from "./InstanceFrame";
import { InstanceMenu, useInstanceTitle } from "./InstanceMenu";

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

function WidgetHeader({ projectId, instance }: { projectId: string; instance: Instance }) {
  const Icon = componentIcon(instance.component);
  const title = useInstanceTitle(instance.component);
  const { id, version } = splitRef(instance.component);
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-xs font-medium">
        {isBuiltinId(id) ? title : `${title} · ${version}`}
      </span>
      <InstanceMenu projectId={projectId} instance={instance} title={title} />
    </div>
  );
}

function ViewActions({ projectId, instance }: { projectId: string; instance: Instance }) {
  const title = useInstanceTitle(instance.component);
  return (
    <PageActions>
      <InstanceMenu projectId={projectId} instance={instance} title={title} />
    </PageActions>
  );
}

type Props = { project: ProjectSnapshot; page: Page; viewer: string };

export function PageView({ project, page, viewer }: Props) {
  const [adding, setAdding] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const projectId = project.meta.id;
  const instances = project.instances.filter((i) => i.pageId === page.id);
  const [first] = instances;
  const canAdd = page.kind === "dashboard" || !first;
  const addButton = canAdd && (
    <Button variant="outline" onClick={() => setAdding(true)}>
      <Plus className="size-4" /> {fr.page.addComponent}
    </Button>
  );
  return (
    <div className="flex h-full flex-col">
      {!first ? (
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div className="grid gap-3">
            <p className="text-muted-foreground">{fr.page.empty}</p>
            {addButton}
          </div>
        </div>
      ) : page.kind === "view" ? (
        <>
          <ViewActions projectId={projectId} instance={first} />
          {readSource(first.config) && <SourceHeader project={project} instance={first} />}
          <InstanceFrame projectId={projectId} instance={first} viewer={viewer} surface="view" />
        </>
      ) : (
        <div className="grid flex-1 auto-rows-[80px] grid-cols-12 gap-4 overflow-auto p-4">
          {instances.map((i) => (
            <div
              key={i.id}
              className="flex flex-col overflow-hidden rounded-lg border bg-card has-[[data-tampered]]:border-destructive"
              style={{
                gridColumn: `${i.layout.x + 1} / span ${i.layout.w}`,
                gridRow: `${i.layout.y + 1} / span ${i.layout.h}`,
              }}
            >
              <WidgetHeader projectId={projectId} instance={i} />
              {readSource(i.config) && <SourceHeader project={project} instance={i} />}
              <div className="min-h-0 flex-1 overflow-auto">
                <InstanceFrame projectId={projectId} instance={i} viewer={viewer} surface="widget" />
              </div>
            </div>
          ))}
          <div className="col-span-12">{addButton}</div>
        </div>
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
