import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Switch } from "@kibo/sdk/ui/switch";
import { useId, useState } from "react";
import { frTracking } from "../i18n/fr-tracking";
import { useAppSettings, useAppSettingsStore } from "../state/use-app-settings";

const t = frTracking.execution;

export function ExecutionCard() {
  const helpId = useId();
  const store = useAppSettingsStore();
  const { agentExecution } = useAppSettings();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const toggle = async (shown: boolean) => {
    setBusy(true);
    setFailed(false);
    try {
      await store.update({ agentExecution: shown ? "shown" : "hidden" });
    } catch (e) {
      console.error(e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex items-center justify-between gap-6">
          <p id={helpId} className="text-sm text-muted-foreground">
            {t.help}
          </p>
          <Switch
            aria-label={t.title}
            aria-describedby={helpId}
            checked={agentExecution === "shown"}
            disabled={busy}
            onCheckedChange={(checked) => void toggle(checked)}
          />
        </div>
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {t.failed}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
