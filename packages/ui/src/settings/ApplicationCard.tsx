import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Label } from "@kibo/sdk/ui/label";
import { Switch } from "@kibo/sdk/ui/switch";
import { useEffect, useId, useState } from "react";
import { type AutostartPort, createTauriAutostart } from "../desktop/autostart";
import { frAbout } from "../i18n/fr-about";
import { inTauri } from "../shell/workspace-actions";

const t = frAbout.application;

function AutostartRow({ port }: { port: AutostartPort }) {
  const id = useId();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    port.isEnabled().then(
      (on) => {
        if (live) setEnabled(on);
      },
      (e: unknown) => {
        console.error("autostart state unavailable", e);
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [port]);
  const toggle = async (next: boolean) => {
    setBusy(true);
    setFailed(false);
    try {
      await (next ? port.enable() : port.disable());
      setEnabled(next);
    } catch (e) {
      console.error("autostart change refused", e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-4">
        <div className="grid gap-1">
          <Label htmlFor={id}>{t.autostart}</Label>
          <p className="text-sm text-muted-foreground">{t.autostartHelp}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {enabled !== null && (
            <span className="text-sm text-muted-foreground">{enabled ? t.enabled : t.disabled}</span>
          )}
          <Switch
            id={id}
            checked={enabled ?? false}
            disabled={enabled === null || busy}
            onCheckedChange={(next) => void toggle(next)}
          />
        </div>
      </div>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t.failed}
        </p>
      )}
    </div>
  );
}

export function ApplicationCard({ port, desktop = inTauri() }: { port?: AutostartPort; desktop?: boolean }) {
  const [own] = useState(createTauriAutostart);
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{desktop ? t.description : t.desktopOnly}</CardDescription>
      </CardHeader>
      {desktop && (
        <CardContent>
          <AutostartRow port={port ?? own} />
        </CardContent>
      )}
    </Card>
  );
}
