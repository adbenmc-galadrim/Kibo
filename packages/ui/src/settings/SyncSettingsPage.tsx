import type { ProjectSummary, SyncStatus } from "@kibo/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@kibo/sdk/ui/alert-dialog";
import { useState } from "react";
import { client } from "../api";
import { ConnectServerDialog } from "../dialogs/ConnectServerDialog";
import { fr } from "../i18n/fr";
import { isRemoteView } from "../lib/remote-view";
import { syncFailure } from "../lib/sync-errors";
import { useSyncServerStatus } from "../state/use-sync-server";
import { SettingsNav } from "./SettingsNav";
import { SyncDevicesCard } from "./SyncDevicesCard";
import { SyncEmptyState } from "./SyncEmptyState";
import { SyncProjectsCard } from "./SyncProjectsCard";
import { AccountCard, ServerCard } from "./SyncServerCards";

const t = fr.sync;

function DisconnectDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange(o: boolean): void;
  onConfirm(): void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.disconnectTitle}</AlertDialogTitle>
          <AlertDialogDescription>{t.disconnectConfirm}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{fr.common.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t.disconnect}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type ConnectedProps = {
  status: SyncStatus;
  remote: boolean;
  projects: readonly ProjectSummary[];
  onDisconnect(): void;
  onOpen(projectId: string): void;
  onManage(projectId: string): void;
  onDelete(projectId: string): void;
};

function Connected({ status, remote, onDisconnect, ...projectProps }: ConnectedProps) {
  return (
    <>
      <div className="grid grid-cols-2 items-start gap-3">
        <ServerCard status={status} remote={remote} onDisconnect={onDisconnect} />
        <AccountCard status={status} />
      </div>
      <SyncDevicesCard status={status} remote={remote} />
      <SyncProjectsCard status={status} {...projectProps} />
    </>
  );
}

type Props = {
  viewer: string;
  projects: readonly ProjectSummary[];
  remote?: boolean;
  onOpen(projectId: string): void;
  onShare(projectId: string): void;
  onDeleteProject(projectId: string): void;
};

export function SyncSettingsPage({ viewer, remote = isRemoteView(), ...p }: Props) {
  const { status, error, reload } = useSyncServerStatus();
  const [connecting, setConnecting] = useState<"server" | "device" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const configured = status !== null && status.state !== "unconfigured";
  const disconnect = async () => {
    setConfirming(false);
    setActionError(null);
    try {
      await client.rpc({ method: "disconnectSyncServer" });
    } catch (e) {
      setActionError(syncFailure(t.actionErrors, e));
    }
    reload();
  };
  return (
    <div className="grid min-h-full grid-cols-[14rem_1fr]">
      <SettingsNav active="sync" />
      <div className="flex flex-col gap-4 p-8">
        <div>
          <h1 className="text-xl font-semibold">{t.title}</h1>
          {configured && <p className="text-sm text-muted-foreground">{t.subtitle}</p>}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t.loadFailed}
          </p>
        )}
        {actionError && (
          <p role="alert" className="text-sm text-destructive">
            {actionError}
          </p>
        )}
        {remote && configured && <p className="text-sm text-muted-foreground">{t.localOnly}</p>}
        {status?.state === "unconfigured" && (
          <SyncEmptyState
            remote={remote}
            onConnect={() => setConnecting("server")}
            onJoinDevice={() => setConnecting("device")}
          />
        )}
        {status && configured && (
          <Connected
            status={status}
            remote={remote}
            projects={p.projects}
            onDisconnect={() => setConfirming(true)}
            onOpen={p.onOpen}
            onManage={p.onShare}
            onDelete={p.onDeleteProject}
          />
        )}
        {connecting && (
          <ConnectServerDialog
            open
            onOpenChange={(o) => !o && setConnecting(null)}
            viewer={viewer}
            mode={connecting}
            onConnected={reload}
          />
        )}
        <DisconnectDialog
          open={confirming}
          onOpenChange={setConfirming}
          onConfirm={() => void disconnect()}
        />
      </div>
    </div>
  );
}
