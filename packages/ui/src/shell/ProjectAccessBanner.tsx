import type { ProjectAccess } from "@kibo/schema";
import { CloudOff, Eye, Unplug } from "lucide-react";
import { frCollab } from "../i18n/fr-collab";
import { frShare } from "../i18n/fr-share";
import { isSuspended, syncErrorText } from "../lib/sync-errors";
import { useSyncServerStatus } from "../state/use-sync-server";

const MUTED = "flex items-center gap-2 border-b bg-muted px-3 py-1.5 text-sm text-muted-foreground";
const DANGER =
  "flex items-center gap-2 border-b bg-red-50 px-3 py-1.5 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300";

type Props = { access: ProjectAccess; suspended?: string | null };

function bannerOf(access: ProjectAccess, suspended: string | null) {
  if (access === "revoked") return { Icon: Unplug, className: DANGER, text: frShare.revoked };
  if (access === "read-only") return { Icon: Eye, className: MUTED, text: frShare.readOnly };
  if (suspended === null || !isSuspended(suspended)) return null;
  const reason = syncErrorText(frCollab.sync.projectErrors, suspended);
  return { Icon: CloudOff, className: MUTED, text: frShare.suspended(reason, frCollab.sync.suspendedHint) };
}

export function ProjectAccessBanner({ access, suspended = null }: Props) {
  const banner = bannerOf(access, suspended);
  if (!banner) return null;
  const { Icon, className, text } = banner;
  return (
    <output className={className}>
      <Icon className="size-4 shrink-0" aria-hidden />
      {text}
    </output>
  );
}

export function ProjectStatusBanner({ projectId, access }: { projectId: string; access: ProjectAccess }) {
  const { status } = useSyncServerStatus();
  const entry = status?.projects.find((p) => p.projectId === projectId);
  const suspended = entry && !entry.accessRevoked ? entry.lastError : null;
  return <ProjectAccessBanner access={access} suspended={suspended} />;
}
