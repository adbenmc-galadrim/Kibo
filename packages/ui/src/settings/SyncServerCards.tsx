import type { SyncStatus } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { useEffect, useState } from "react";
import { fr } from "../i18n/fr";
import { syncErrorText } from "../lib/sync-errors";
import { UserAvatar } from "../shell/UserAvatar";

const t = fr.sync;

function useTicking(active: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function connectionLabel(status: SyncStatus, now: number): [string, string] {
  if (status.state === "online") return ["bg-green-500", t.online];
  if (status.state === "connecting") return ["bg-zinc-400 animate-pulse dark:bg-zinc-500", t.connecting];
  if (status.retryAt !== null)
    return [
      "bg-zinc-400 dark:bg-zinc-500",
      t.retrying(Math.max(0, Math.round((status.retryAt - now) / 1000))),
    ];
  return ["bg-zinc-400 dark:bg-zinc-500", t.offline];
}

function ConnectionState({ status }: { status: SyncStatus }) {
  const now = useTicking(status.state === "offline" && status.retryAt !== null);
  const [dot, label] = connectionLabel(status, now);
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden className={cn("size-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}

type ServerProps = { status: SyncStatus; remote: boolean; onDisconnect(): void };

export function ServerCard({ status, remote, onDisconnect }: ServerProps) {
  const failure = status.state !== "online" && status.lastError !== null;
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{t.server}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-mono text-sm">{status.serverUrl}</span>
          <ConnectionState status={status} />
        </div>
        {failure && status.lastError && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {syncErrorText(t.connectionErrors, status.lastError)}
          </p>
        )}
        <div>
          <Button variant="outline" size="sm" disabled={remote} onClick={onDisconnect}>
            {t.disconnect}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AccountCard({ status }: { status: SyncStatus }) {
  const user = status.user;
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{t.account}</CardTitle>
      </CardHeader>
      <CardContent>
        {user && (
          <div className="flex items-center gap-3">
            <UserAvatar user={user.name} />
            <div className="grid gap-0.5">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="font-mono text-2xs text-muted-foreground">{user.id}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
