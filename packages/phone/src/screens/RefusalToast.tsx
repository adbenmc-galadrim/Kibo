import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { fr } from "../i18n/fr";
import type { Refusal, RemoteClient } from "../remote-client";

const VISIBLE_MS = 5_000;

function toastText({ reason, action }: Refusal): { title: string; body: string } {
  switch (reason) {
    case "macOff":
      return { title: fr.refusal.macOff(action), body: fr.refusal.nothingQueued };
    case "phoneOffline":
      return { title: fr.refusal.phoneOffline(action), body: fr.refusal.nothingQueuedOffline };
    case "timeout":
      return { title: fr.refusal.timeout(action), body: fr.refusal.nothingQueued };
    case "clock":
      return { title: fr.refusal.clock, body: fr.refusal.clockBody };
  }
}

export function RefusalToast({ client }: { client: RemoteClient }) {
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  useEffect(() => client.onRefused(setRefusal), [client]);
  useEffect(() => {
    if (!refusal) return;
    const timer = setTimeout(() => setRefusal(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [refusal]);
  if (!refusal) return null;
  const { title, body } = toastText(refusal);
  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-30 flex min-h-16 items-center gap-3 rounded-xl border border-(--tracking-border) bg-(--tracking-card) px-4 py-3 shadow-lg"
    >
      <WifiOff aria-hidden size={18} className="shrink-0 text-(--tracking-red)" />
      <div className="min-w-0">
        <p className="text-[14px] font-semibold">{title}</p>
        <p className="text-[13px] text-(--tracking-mfg)">{body}</p>
      </div>
    </div>
  );
}
