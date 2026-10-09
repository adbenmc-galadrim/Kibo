import type { PairingCode } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { useCallback, useEffect, useState } from "react";
import { client } from "../api";
import { frSecurity } from "../i18n/fr-security";
import { formatPairingCode, remaining } from "../lib/pairing-code";
import { securityFailure } from "../lib/security-error";
import { CopyButton } from "./CopyButton";

type Props = { open: boolean; onOpenChange: (o: boolean) => void; now?: () => number };
const t = frSecurity.pairingCode;

export function PairingCodeDialog({ open, onOpenChange, now = Date.now }: Props) {
  const [code, setCode] = useState<PairingCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(now);
  const generate = useCallback(() => {
    setError(null);
    client.rpc({ method: "createPairingCode" }).then(
      (created) => {
        setCode(created);
        setTick(now());
      },
      (e: unknown) => setError(securityFailure(e)),
    );
  }, [now]);
  useEffect(() => {
    if (!open) return;
    generate();
    const timer = setInterval(() => setTick(now()), 1000);
    return () => clearInterval(timer);
  }, [open, generate, now]);
  const expired = code !== null && code.expiresAt <= tick;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.help}</DialogDescription>
        </DialogHeader>
        {code && !expired && (
          <div className="grid justify-items-center gap-2 py-4">
            <p className="font-mono text-3xl tracking-[0.3em]">{formatPairingCode(code.code)}</p>
            <p className="text-sm text-muted-foreground">{t.expiresIn(remaining(code.expiresAt, tick))}</p>
          </div>
        )}
        {expired && <p className="py-4 text-center text-sm text-muted-foreground">{t.expired}</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          {expired ? (
            <Button onClick={generate}>{t.regenerate}</Button>
          ) : (
            <CopyButton variant="outline" text={code ? formatPairingCode(code.code) : ""} />
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
