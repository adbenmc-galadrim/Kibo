import type { Instance, Page, ProjectSnapshot } from "@kibo/schema";
import { createSdk, projectBackend, SdkProvider } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { client } from "../api";
import { AddComponentDialog } from "../dialogs/AddComponentDialog";
import { fr } from "../i18n/fr";
import { findComponent } from "../registry";
import { useHost } from "../shell/Host";

type FrameProps = { projectId: string; instance: Instance; viewer: string };

function InstanceFrame({ projectId, instance, viewer }: FrameProps) {
  const host = useHost();
  const mod = findComponent(instance.component);
  const sdk = useMemo(
    () =>
      mod &&
      createSdk(projectBackend(client, projectId), mod.manifest, {
        instanceId: instance.id,
        config: instance.config,
        viewer,
        openTicket: host.openTicket,
        openNewTicket: host.openNewTicket,
        openFile: (r) =>
          host.openFile({
            projectId,
            worktree: null,
            path: r.path,
            line: r.line ?? null,
            origin: r.origin ?? null,
          }),
      }),
    [mod, projectId, instance.id, instance.config, viewer, host],
  );
  if (!mod || !sdk) {
    return <p className="p-6 text-sm text-destructive">{fr.page.unknownComponent(instance.component)}</p>;
  }
  return (
    <SdkProvider sdk={sdk}>
      <mod.Component />
    </SdkProvider>
  );
}

type Props = { project: ProjectSnapshot; page: Page; viewer: string };

export function PageView({ project, page, viewer }: Props) {
  const [adding, setAdding] = useState(false);
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
        <InstanceFrame projectId={project.meta.id} instance={first} viewer={viewer} />
      ) : (
        <div className="grid flex-1 auto-rows-[80px] grid-cols-12 gap-4 overflow-auto p-4">
          {instances.map((i) => (
            <div
              key={i.id}
              className="overflow-hidden rounded-lg border bg-card"
              style={{
                gridColumn: `${i.layout.x + 1} / span ${i.layout.w}`,
                gridRow: `${i.layout.y + 1} / span ${i.layout.h}`,
              }}
            >
              <InstanceFrame projectId={project.meta.id} instance={i} viewer={viewer} />
            </div>
          ))}
          <div className="col-span-12">{addButton}</div>
        </div>
      )}
      {adding && (
        <AddComponentDialog
          projectId={project.meta.id}
          page={page}
          taken={instances.map((i) => i.layout)}
          open
          onOpenChange={setAdding}
        />
      )}
    </div>
  );
}
