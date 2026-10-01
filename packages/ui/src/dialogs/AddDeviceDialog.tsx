import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { useEffect, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frSyncPage } from "../i18n/fr-sync-page";
import { hostOf } from "../lib/host-of";
import { syncFailure } from "../lib/sync-errors";
import { CopyButton } from "../settings/CopyButton";

const t = fr.sync;

export const groupByFour = (code: string): string => code.match(/.{1,4}/g)?.join(" ") ?? code;

function useDeviceCode(open: boolean) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setCode(null);
    setError(null);
    if (!open) return;
    let alive = true;
    client.rpc({ method: "addDevice" }).then(
      (r) => {
        if (alive) setCode(r.code);
      },
      (e: unknown) => {
        if (alive) setError(syncFailure(t.actionErrors, e));
      },
    );
    return () => {
      alive = false;
    };
  }, [open]);
  return { code, error };
}

type CopyLineProps = { label?: string; value: string; copy: string };

function CopyLine({ label, value, copy }: CopyLineProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted px-4 py-3">
      <span className="grid min-w-0 flex-1 gap-0.5">
        {label && <span className="text-xs text-muted-foreground">{label}</span>}
        <span className={cn("break-words font-mono font-medium", label ? "text-sm" : "text-lg")}>
          {value}
        </span>
      </span>
      <CopyButton variant="outline" text={copy} />
    </div>
  );
}

type Props = { open: boolean; onOpenChange: (o: boolean) => void; serverUrl: string };

export function AddDeviceDialog({ open, onOpenChange, serverUrl }: Props) {
  const { code, error } = useDeviceCode(open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[34rem]">
        <DialogHeader>
          <DialogTitle>{t.addDeviceTitle}</DialogTitle>
          <DialogDescription>{t.addDeviceValidity}</DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : (
          <div className="grid gap-3">
            <CopyLine value={code ? groupByFour(code) : "…"} copy={code ?? ""} />
            <CopyLine label={frSyncPage.serverAddress} value={hostOf(serverUrl)} copy={serverUrl} />
            <ol className="grid list-decimal gap-1 pl-5 text-sm">
              {frSyncPage.addDeviceSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        )}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t.done}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
