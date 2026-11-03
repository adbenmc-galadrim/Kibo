import { onToast } from "@kibo/sdk";
import { CircleAlert, Info, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { fr } from "../i18n/fr";
import type { Refusal, RemoteClient } from "../remote-client";
import { onPhoneToast, type PhoneToast } from "../toast";

const VISIBLE_MS = 5_000;

type Shown = { kind: "refusal"; refusal: Refusal } | { kind: "toast"; toast: Omit<PhoneToast, "id"> };

function refusalText({ reason, action }: Refusal): { title: string; body: string } {
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

function contentOf(shown: Shown) {
  if (shown.kind === "refusal") {
    const { title, body } = refusalText(shown.refusal);
    return { alert: true, title, body, action: null, Icon: WifiOff };
  }
  const { kind, message, description, action } = shown.toast;
  const alert = kind === "error" || kind === "warning";
  return { alert, title: message, body: description, action, Icon: alert ? CircleAlert : Info };
}

const plainToast = (message: string): Shown => ({
  kind: "toast",
  toast: { kind: "message", message, description: null, action: null },
});

export function Toasts({ client }: { client: RemoteClient }) {
  const [shown, setShown] = useState<Shown | null>(null);
  useEffect(() => client.onRefused((refusal) => setShown({ kind: "refusal", refusal })), [client]);
  useEffect(() => onPhoneToast((toast) => setShown({ kind: "toast", toast })), []);
  useEffect(() => onToast((message) => setShown(plainToast(message))), []);
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [shown]);
  if (!shown) return null;
  const { alert, title, body, action, Icon } = contentOf(shown);
  return (
    <div
      role={alert ? "alert" : "status"}
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-30 flex min-h-16 items-center gap-3 rounded-xl border border-(--tracking-border) bg-(--tracking-card) px-4 py-3 shadow-lg"
    >
      <Icon
        aria-hidden
        size={18}
        className={`shrink-0 ${alert ? "text-(--tracking-red)" : "text-(--tracking-dim)"}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">{title}</p>
        {body ? <p className="text-[13px] text-(--tracking-mfg)">{body}</p> : null}
      </div>
      {action ? (
        <button
          type="button"
          onClick={() => {
            action.onClick();
            setShown(null);
          }}
          className="min-h-11 shrink-0 px-2 text-[14px] font-semibold"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
