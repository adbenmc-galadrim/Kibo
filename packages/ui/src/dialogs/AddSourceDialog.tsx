import type { MarketProbe } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Alert, AlertTitle } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { ArrowLeft, Check, Fingerprint } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { groupFingerprint } from "../lib/fingerprint";
import { marketErrorText } from "../lib/market-errors";

type Props = { open: boolean; onOpenChange(open: boolean): void; onAdded(): void };

function Steps({ current }: { current: 1 | 2 }) {
  const t = fr.marketSources.dialog;
  return (
    <ol aria-label={t.stepsLabel} className="flex items-center gap-2">
      {t.steps.map((label, i) => {
        const n = i + 1;
        return (
          <li key={label} className="flex items-center gap-2">
            {n > 1 && <span aria-hidden className="h-px w-4 bg-border" />}
            <span
              aria-current={n === current ? "step" : undefined}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
                n === current ? "border-foreground/50 bg-accent font-medium" : "text-muted-foreground",
              )}
            >
              {n < current && <Check aria-hidden className="size-3 text-emerald-600 dark:text-emerald-400" />}
              {t.step(n, label)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function KeyLines({ fingerprint }: { fingerprint: string }) {
  const groups = groupFingerprint(fingerprint).split(" ");
  const lines = [groups.slice(0, 8).join(" "), groups.slice(8).join(" ")].filter(Boolean);
  return (
    <div className="grid gap-1 rounded-md bg-muted px-3 py-2.5 font-mono text-xs">
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </div>
  );
}

function ProbeStep({ probe }: { probe: MarketProbe }) {
  const t = fr.marketSources.dialog;
  const nameId = useId();
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor={nameId}>{t.sourceName}</Label>
        <Input id={nameId} value={probe.name} readOnly />
      </div>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{t.fingerprint}</legend>
        <KeyLines fingerprint={probe.fingerprint} />
      </fieldset>
      <Alert role="status" className="bg-muted/40">
        <Fingerprint aria-hidden />
        <AlertTitle className="line-clamp-none font-normal">{t.compare}</AlertTitle>
      </Alert>
    </div>
  );
}

export function AddSourceDialog({ open, onOpenChange, onAdded }: Props) {
  const t = fr.marketSources.dialog;
  const urlId = useId();
  const [url, setUrl] = useState("");
  const [probe, setProbe] = useState<MarketProbe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(marketErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  const next = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => setProbe(await client.rpc({ method: "probeMarketSource", url: url.trim() })));
  };
  const confirm = (found: MarketProbe) =>
    run(async () => {
      await client.rpc({ method: "addMarketSource", url: url.trim(), publicKey: found.publicKey });
      onAdded();
      onOpenChange(false);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>
            {probe ? t.found(url.trim(), probe.serial, probe.packages) : t.intro}
          </DialogDescription>
        </DialogHeader>
        <Steps current={probe ? 2 : 1} />
        {probe ? (
          <>
            <ProbeStep probe={probe} />
            <DialogFooter className="sm:justify-between">
              <Button variant="ghost" onClick={() => setProbe(null)}>
                <ArrowLeft aria-hidden />
                {t.back}
              </Button>
              <Button onClick={() => void confirm(probe)} disabled={busy}>
                {t.confirm}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={next} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor={urlId}>{t.address}</Label>
              <Input
                id={urlId}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">{t.addressHelp}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t.cancel}
              </Button>
              <Button type="submit" disabled={busy || !url.trim()}>
                {t.next}
              </Button>
            </DialogFooter>
          </form>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
