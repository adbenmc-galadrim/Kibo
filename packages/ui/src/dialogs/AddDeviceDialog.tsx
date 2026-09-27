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

export function AddDeviceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { code, error } = useDeviceCode(open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.addDeviceTitle}</DialogTitle>
          <DialogDescription>{t.addDeviceHelp}</DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : (
          <div className="grid gap-3">
            <div className="flex items-center gap-3 rounded-lg bg-muted px-4 py-3">
              <span className="flex-1 break-words font-mono text-xl font-medium tracking-wide">
                {code ? groupByFour(code) : "…"}
              </span>
              <CopyButton variant="outline" text={code ?? ""} />
            </div>
            <p className="text-xs text-muted-foreground">{t.addDeviceValidity}</p>
          </div>
        )}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t.done}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
