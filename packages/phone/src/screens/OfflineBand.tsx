import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { formatClock } from "../format-time";
import { fr } from "../i18n/fr";
import type { Presence } from "../remote-client";

type Schedule = (run: () => void, ms: number) => () => void;

const SYNCING_DELAY_MS = 1_000;

const timeout: Schedule = (run, ms) => {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
};

const isSyncing = ({ macOnline, phoneOnline, reconnecting, stale, syncing }: Presence): boolean =>
  phoneOnline && ((!macOnline && reconnecting === true) || (stale && syncing === true));

function bandText({ macOnline, phoneOnline, stale, lastSnapshotAt }: Presence): string | null {
  if (macOnline && phoneOnline && !stale) return null;
  const time = lastSnapshotAt === null ? null : formatClock(lastSnapshotAt);
  if (!phoneOnline) return time ? fr.band.phoneOffline(time) : fr.band.phoneOfflineEmpty;
  if (!macOnline) return time ? fr.band.macOff(time) : fr.band.macOffEmpty;
  return time ? fr.band.stale(time) : fr.band.staleEmpty;
}

function useShownAfter(active: boolean, schedule: Schedule): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(false);
    if (!active) return;
    return schedule(() => setShown(true), SYNCING_DELAY_MS);
  }, [active, schedule]);
  return active && shown;
}

export function OfflineBand({ presence, schedule = timeout }: { presence: Presence; schedule?: Schedule }) {
  const syncing = isSyncing(presence);
  const syncingShown = useShownAfter(syncing, schedule);
  const text = syncing ? (syncingShown ? fr.band.syncing : null) : bandText(presence);
  if (text === null) return null;
  return (
    <output className="flex h-8 shrink-0 items-center gap-2 border-b border-(--tracking-border) bg-(--tracking-muted) px-4 text-[12.5px] font-medium text-(--tracking-mfg)">
      <WifiOff aria-hidden size={13} className="shrink-0 text-(--tracking-dim)" />
      {text}
    </output>
  );
}
