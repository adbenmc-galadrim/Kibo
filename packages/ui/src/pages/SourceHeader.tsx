import { type Binding, type Instance, InstanceSource, type ProjectSnapshot } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { ListTodo, RefreshCw, Unlink } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { useSyncState } from "../state/use-sync-state";

const t = fr.integrations.instance;
const time = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

function RemovedBinding() {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3 text-sm text-muted-foreground">
      <Unlink aria-hidden className="size-4 shrink-0" />
      <span className="shrink-0 font-medium text-foreground">{t.bindingRemoved}</span>
      <span className="truncate">{t.bindingRemovedHelp}</span>
    </div>
  );
}

function SyncedHeader({ projectId, binding }: { projectId: string; binding: Binding }) {
  const { state } = useSyncState(projectId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const b = state?.bindings.find((x) => x.bindingId === binding.id);
  const running = busy || b?.running === true;
  const problem = error ?? b?.lastError?.message ?? null;
  const sync = async () => {
    setBusy(true);
    try {
      await client.rpc({ method: "syncBinding", projectId, bindingId: binding.id });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3 text-sm">
      <ListTodo aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="shrink-0 font-medium">{t.header(binding.config.repo)}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {b?.lastPullAt ? t.lastSync(time(b.lastPullAt)) : t.never}
      </span>
      {problem && (
        <span role="alert" className="min-w-0 truncate text-xs text-destructive">
          {problem}
        </span>
      )}
      <Button size="sm" variant="ghost" className="ml-auto" disabled={running} onClick={() => void sync()}>
        <RefreshCw aria-hidden className={running ? "size-3.5 animate-spin" : "size-3.5"} />
        {running ? t.syncing : t.sync}
      </Button>
    </div>
  );
}

export function SourceHeader({ project, instance }: { project: ProjectSnapshot; instance: Instance }) {
  const source = InstanceSource.safeParse(instance.config.source);
  if (!source.success) return null;
  const binding = project.bindings.find((b) => b.id === source.data.bindingId);
  if (!binding) return <RemovedBinding />;
  return <SyncedHeader projectId={project.meta.id} binding={binding} />;
}
