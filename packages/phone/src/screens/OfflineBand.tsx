import { WifiOff } from "lucide-react";
import { formatClock } from "../format-time";
import { fr } from "../i18n/fr";
import type { Presence } from "../remote-client";

function bandText({ macOnline, phoneOnline, stale, lastSnapshotAt }: Presence): string | null {
  if (macOnline && phoneOnline && !stale) return null;
  const time = lastSnapshotAt === null ? null : formatClock(lastSnapshotAt);
  if (!phoneOnline) return time ? fr.band.phoneOffline(time) : fr.band.phoneOfflineEmpty;
  if (!macOnline) return time ? fr.band.macOff(time) : fr.band.macOffEmpty;
  return time ? fr.band.stale(time) : fr.band.staleEmpty;
}

export function OfflineBand({ presence }: { presence: Presence }) {
  const text = bandText(presence);
  if (text === null) return null;
  return (
    <output className="flex h-8 shrink-0 items-center gap-2 border-b border-(--tracking-border) bg-(--tracking-muted) px-4 text-[12.5px] font-medium text-(--tracking-mfg)">
      <WifiOff aria-hidden size={13} className="shrink-0 text-(--tracking-dim)" />
      {text}
    </output>
  );
}
