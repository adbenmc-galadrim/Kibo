import { ShieldOff } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "../i18n/fr";
import { useRpcQuery } from "../state/use-rpc-query";

const SANDBOX_EVENTS = ["sandbox.changed"] as const;

export function BackendGate({ compact, children }: { compact: boolean; children: ReactNode }) {
  const { data } = useRpcQuery({ method: "getSandboxStatus" }, SANDBOX_EVENTS);
  if (!data) return null;
  if (data.available || data.allowUnsandboxed) return children;
  return (
    <output className={`grid h-full place-items-center text-center ${compact ? "p-4" : "p-10"}`}>
      <span className="grid max-w-sm justify-items-center gap-2">
        <ShieldOff aria-hidden className="size-6 text-amber-600 dark:text-amber-400" />
        <span className="font-medium text-amber-600 dark:text-amber-400">{fr.market.backendStopped}</span>
        <span className="text-sm text-muted-foreground">{fr.market.backendStoppedHelp}</span>
      </span>
    </output>
  );
}
