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
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent } from "@kibo/sdk/ui/card";
import { CloudOff } from "lucide-react";
import { useMemo, useState } from "react";
import { client } from "../api";
import { ConnectServerDialog } from "../dialogs/ConnectServerDialog";
import { fr } from "../i18n/fr";
import { isRemoteView } from "../lib/remote-view";
import { syncFailure } from "../lib/sync-errors";
import { useSyncServerStatus } from "../state/use-sync-server";
import { SettingsNav } from "./SettingsNav";
import { SyncDevicesCard } from "./SyncDevicesCard";
import { SyncProjectsCard } from "./SyncProjectsCard";
import { AccountCard, ServerCard } from "./SyncServerCards";

const t = fr.sync;

function EmptyState({ remote, onConnect }: { remote: boolean; onConnect(): void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <CloudOff className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm">{t.empty}</p>
        <Button disabled={remote} onClick={onConnect}>
          {t.connect}
        </Button>
      </CardContent>
    </Card>
  );
}

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
  colors: ReadonlyMap<string, string>;
  onDisconnect(): void;
};

function Connected({ status, remote, colors, onDisconnect }: ConnectedProps) {
  return (
    <>
      <div className="grid grid-cols-2 items-start gap-3">
        <ServerCard status={status} remote={remote} onDisconnect={onDisconnect} />
        <AccountCard status={status} />
      </div>
      <SyncDevicesCard status={status} remote={remote} />
      <SyncProjectsCard status={status} colors={colors} />
    </>
  );
}

type Props = { viewer: string; projects?: readonly ProjectSummary[]; remote?: boolean };

export function SyncSettingsPage({ viewer, projects = [], remote = isRemoteView() }: Props) {
  const { status, error, reload } = useSyncServerStatus();
  const [connecting, setConnecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const colors = useMemo(() => new Map(projects.map((p) => [p.id, p.color])), [projects]);
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
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
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
        {remote && status && <p className="text-sm text-muted-foreground">{t.localOnly}</p>}
        {status?.state === "unconfigured" && (
          <EmptyState remote={remote} onConnect={() => setConnecting(true)} />
        )}
        {status && status.state !== "unconfigured" && (
          <Connected
            status={status}
            remote={remote}
            colors={colors}
            onDisconnect={() => setConfirming(true)}
          />
        )}
        {connecting && (
          <ConnectServerDialog open onOpenChange={setConnecting} viewer={viewer} onConnected={reload} />
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
