import type { SyncStatus } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { fr } from "../i18n/fr";
import { navigateTo } from "../route";
import { useSyncServerStatus } from "../state/use-sync-server";

type Kind = "local" | "down" | "synced" | "syncing" | "offline" | "error";

const DOT: Record<Kind, string> = {
  local: "bg-green-500",
  down: "bg-red-500",
  synced: "bg-green-500",
  syncing: "bg-zinc-400 animate-pulse dark:bg-zinc-500",
  offline: "bg-zinc-400 dark:bg-zinc-500",
  error: "bg-red-500",
};

const TEXT: Record<Kind, string> = {
  local: "text-muted-foreground",
  down: "text-muted-foreground",
  synced: "text-green-600 dark:text-green-500",
  syncing: "text-muted-foreground",
  offline: "text-muted-foreground",
  error: "text-red-600 dark:text-red-400",
};

const projectFailing = (status: SyncStatus) =>
  status.projects.some((p) => p.lastError !== null && !p.accessRevoked);

function kindOf(online: boolean, status: SyncStatus | null): Kind {
  if (!online) return "down";
  if (!status || status.state === "unconfigured") return "local";
  if (status.state === "online") return projectFailing(status) ? "error" : "synced";
  if (status.state === "connecting") return "syncing";
  return status.lastError === null || status.lastError === "SYNC_OFFLINE" ? "offline" : "error";
}

export function SyncIndicator({ online }: { online: boolean }) {
  const { status } = useSyncServerStatus();
  const kind = kindOf(online, status);
  const base = online ? fr.agents.daemon : fr.agents.daemonOffline;
  const className = cn("flex shrink-0 items-center gap-1.5", TEXT[kind]);
  const dot = <span aria-hidden className={cn("size-1.5 rounded-full", DOT[kind])} />;
  if (kind === "local" || kind === "down")
    return (
      <span className={className}>
        {dot}
        {base}
      </span>
    );
  return (
    <button
      type="button"
      className={cn(className, "hover:underline")}
      onClick={() => navigateTo({ kind: "screen", screen: "sync" })}
    >
      {dot}
      {`${base} · ${fr.sync.indicator[kind]}`}
    </button>
  );
}
