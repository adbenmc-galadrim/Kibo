import type { RemotePairing } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { toCanvas } from "qrcode";
import { useEffect, useRef, useState } from "react";
import { client } from "../api";
import { frPhone } from "../i18n/fr-phone";
import { describeError } from "./use-remote-status";

const t = frPhone.pair;
const QR_PX = 224;

type Props = { open: boolean; onOpenChange(open: boolean): void };

const countdown = (ms: number): string => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

function usePairing(open: boolean) {
  const [pairing, setPairing] = useState<RemotePairing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!open) return;
    let live = true;
    void round;
    setPairing(null);
    setError(null);
    client.rpc({ method: "remote.createPairing" }).then(
      (next) => live && setPairing(next),
      (e: unknown) => live && setError(t.failed(describeError(e))),
    );
    return () => {
      live = false;
    };
  }, [open, round]);
  return { pairing, error, renew: () => setRound((n) => n + 1) };
}

function useNow(pairing: RemotePairing | null): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!pairing) return;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [pairing]);
  return now;
}

function QrCanvas({ code }: { code: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    setFailed(false);
    toCanvas(target, code, { width: QR_PX, margin: 2, color: { dark: "#000000", light: "#ffffff" } }).catch(
      () => setFailed(true),
    );
  }, [code]);
  return (
    <div className="grid justify-items-center gap-2">
      <canvas
        ref={canvas}
        role="img"
        aria-label={t.qrLabel}
        width={QR_PX}
        height={QR_PX}
        className="size-56 rounded-md bg-white"
      />
      {failed && <p className="text-xs text-muted-foreground">{t.qrFailed}</p>}
    </div>
  );
}

function CopyButton({ code }: { code: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = () =>
    navigator.clipboard.writeText(code).then(
      () => setState("copied"),
      () => setState("failed"),
    );
  if (state === "failed") return <span className="text-xs">{t.copyFailed}</span>;
  return (
    <Button variant="outline" size="sm" onClick={() => void copy()}>
      {state === "copied" ? t.copied : t.copy}
    </Button>
  );
}

function PairingBody({ pairing, now, onRenew }: { pairing: RemotePairing; now: number; onRenew(): void }) {
  const left = pairing.expiresAt - now;
  return (
    <div className="grid gap-4">
      {left > 0 ? <QrCanvas code={pairing.code} /> : <p className="text-sm font-medium">{t.expired}</p>}
      <code className="block rounded-md bg-muted px-3 py-2 font-mono text-xs break-all select-all">
        {pairing.code}
      </code>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {left > 0 ? (
          <>
            <span>{t.expiresIn}</span>
            <span className="font-mono tabular-nums text-foreground">{countdown(left)}</span>
            <span className="ml-auto">
              <CopyButton code={pairing.code} />
            </span>
          </>
        ) : (
          <Button size="sm" onClick={onRenew}>
            {t.renew}
          </Button>
        )}
      </div>
    </div>
  );
}

export function PairPhoneDialog({ open, onOpenChange }: Props) {
  const { pairing, error, renew } = usePairing(open);
  const now = useNow(pairing);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!error && !pairing && <p className="text-sm text-muted-foreground">{t.loading}</p>}
        {pairing && <PairingBody pairing={pairing} now={now} onRenew={renew} />}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
