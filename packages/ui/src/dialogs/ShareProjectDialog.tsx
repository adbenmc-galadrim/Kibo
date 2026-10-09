import type { MemberInfo, ProjectSnapshot, ProjectSyncInfo, SyncStatus } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { Cloud, Info, Laptop, Loader2, Upload } from "lucide-react";
import { type ComponentType, useEffect, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frCollab } from "../i18n/fr-collab";
import { frShare } from "../i18n/fr-share";
import { isRemoteView } from "../lib/remote-view";
import { shareErrorText } from "../lib/share-errors";
import { navigateTo } from "../route";
import { ProjectAccessBanner } from "../shell/ProjectAccessBanner";
import { useSyncServerStatus } from "../state/use-sync-server";
import { Invite, Members, StopSharing } from "./ShareMembers";

const t = frShare;

type Props = {
  project: ProjectSnapshot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remote?: boolean;
};

type ListProps = { title: string; items: readonly string[]; Icon: ComponentType<{ className?: string }> };

function ItemList({ title, items, Icon }: ListProps) {
  const id = useId();
  return (
    <div className="grid content-start gap-2 rounded-md border p-3">
      <h3 id={id} className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4" aria-hidden />
        {title}
      </h3>
      <ul aria-labelledby={id} className="grid gap-1 text-xs text-muted-foreground">
        {items.map((i) => (
          <li key={i} className="before:mr-1.5 before:content-['·']">
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ServerBar({ status }: { status: SyncStatus }) {
  const online = status.state === "online";
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
      <Cloud className="size-4 text-muted-foreground" aria-hidden />
      <span className="flex-1 truncate font-mono text-xs">{status.serverUrl}</span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span aria-hidden className={cn("size-1.5 rounded-full", online ? "bg-green-500" : "bg-zinc-400")} />
        {online ? frCollab.sync.online : frCollab.sync.offline}
      </span>
    </div>
  );
}

type NotSharedProps = { status: SyncStatus | null; remote: boolean; onShared(info: ProjectSyncInfo): void };

function NotShared({ project, status, remote, onShared, onOpenChange }: NotSharedProps & Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = status !== null && status.state !== "unconfigured";
  const share = async () => {
    setBusy(true);
    setError(null);
    try {
      onShared(await client.rpc({ method: "shareProject", projectId: project.meta.id }));
    } catch (e) {
      setError(shareErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  const openSettings = () => {
    onOpenChange(false);
    navigateTo({ kind: "screen", screen: "sync" });
  };
  return (
    <>
      {status !== null && configured && <ServerBar status={status} />}
      {status !== null && !configured && remote && (
        <p className="text-sm text-muted-foreground">{t.noServerRemote}</p>
      )}
      {status !== null && !configured && !remote && (
        <Button variant="link" className="h-auto justify-start p-0 text-sm underline" onClick={openSettings}>
          {t.noServer}
        </Button>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <ItemList title={t.sent} items={t.sentItems} Icon={Upload} />
        <ItemList title={t.kept} items={t.keptItems} Icon={Laptop} />
      </div>
      <div className="flex gap-2 rounded-md border bg-muted/40 p-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="grid gap-0.5">
          <p className="font-medium">{t.plaintext}</p>
          <p className="text-xs text-muted-foreground">{t.plaintextHelp}</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {fr.common.cancel}
        </Button>
        <Button onClick={() => void share()} disabled={!configured || busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {busy ? t.sharing : t.submit}
        </Button>
      </DialogFooter>
    </>
  );
}

function Shared({
  project,
  sync,
  status,
  onOpenChange,
}: Props & { sync: ProjectSyncInfo; status: SyncStatus | null }) {
  const [members, setMembers] = useState<MemberInfo[]>(sync.members);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setMembers(sync.members), [sync.members]);
  const owner = sync.role === "owner" && sync.access === "write";
  const entry = status?.projects.find((p) => p.projectId === project.meta.id);
  const projectId = project.meta.id;
  return (
    <>
      {entry && !entry.accessRevoked && <ProjectAccessBanner access="write" suspended={entry.lastError} />}
      <Members
        projectId={projectId}
        owner={owner}
        me={status?.user?.id ?? null}
        members={members}
        onChange={setMembers}
        onError={setError}
      />
      {owner && <Invite projectId={projectId} onError={setError} />}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter className="items-end sm:justify-between">
        {owner ? (
          <StopSharing projectId={projectId} onStopped={() => onOpenChange(false)} onError={setError} />
        ) : (
          <span />
        )}
        <Button onClick={() => onOpenChange(false)}>{t.done}</Button>
      </DialogFooter>
    </>
  );
}

export function ShareProjectDialog(props: Props) {
  const { project, open, onOpenChange, remote = isRemoteView() } = props;
  const { status } = useSyncServerStatus();
  const [shared, setShared] = useState<ProjectSyncInfo | null>(null);
  const sync = shared && !project.sync.shared ? shared : project.sync;
  const count = sync.members.length;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.title(project.meta.name)}</DialogTitle>
          <DialogDescription>
            {sync.shared && status?.serverUrl ? t.sharedVia(status.serverUrl, count) : t.help}
          </DialogDescription>
        </DialogHeader>
        {sync.shared ? (
          <Shared {...props} sync={sync} status={status} />
        ) : (
          <NotShared {...props} status={status} remote={remote} onShared={setShared} />
        )}
      </DialogContent>
    </Dialog>
  );
}
