import type { RemoteAccessStatus } from "@kibo/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@kibo/sdk/ui/alert-dialog";
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Switch } from "@kibo/sdk/ui/switch";
import { Fingerprint, Globe } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { securityErrorText, securityFailure } from "../lib/security-error";
import { useRpcQuery } from "../state/use-rpc-query";
import { CopyButton } from "./CopyButton";
import { EnableRemoteAccessDialog } from "./EnableRemoteAccessDialog";

const t = fr.security.remote;

function RemoteDetails({ status, onDisable }: { status: RemoteAccessStatus; onDisable(): void }) {
  const url = status.url ?? "";
  return (
    <div className="grid gap-2 text-sm">
      <div className="flex items-center gap-2">
        <Globe aria-hidden className="size-4 text-muted-foreground" />
        <span className="font-mono">{url}</span>
        <CopyButton text={url} />
        <span className="flex-1" />
        <Button variant="outline" size="sm" onClick={onDisable}>
          {t.disable}
        </Button>
      </div>
      <p className="flex items-center gap-3 rounded-md bg-muted px-3 py-2 font-mono text-xs">
        <Fingerprint aria-hidden className="size-4 text-muted-foreground" />
        <span>{t.fingerprint}</span>
        <span className="break-all">{status.fingerprint}</span>
      </p>
      <p className="text-xs text-muted-foreground">{t.verify}</p>
    </div>
  );
}

function DisableDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange(o: boolean): void;
  onConfirm(): void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.disableTitle}</AlertDialogTitle>
          <AlertDialogDescription>{t.disableHelp}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{fr.common.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t.disable}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RemoteAccessCard() {
  const { data: status, error: loadError, reload } = useRpcQuery({ method: "getRemoteAccess" }, []);
  const [dialog, setDialog] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disable = async () => {
    setConfirmOff(false);
    setError(null);
    try {
      await client.rpc({ method: "disableRemoteAccess" });
    } catch (e) {
      setError(securityFailure(e));
    }
    reload();
  };
  const failure = error ?? (loadError ? securityFailure(loadError) : null);
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex items-start justify-between gap-6">
          <p className="text-sm text-muted-foreground">{t.help}</p>
          <Switch
            aria-label={t.toggle}
            checked={status?.enabled ?? false}
            disabled={!status}
            onCheckedChange={(checked) => (checked ? setDialog(true) : setConfirmOff(true))}
          />
        </div>
        {status?.lastError && (
          <p role="alert" className="text-sm text-destructive">
            {t.resumeFailed(securityErrorText(status.lastError))}
          </p>
        )}
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
        {status?.enabled && <RemoteDetails status={status} onDisable={() => setConfirmOff(true)} />}
      </CardContent>
      {status && dialog && (
        <EnableRemoteAccessDialog status={status} open onOpenChange={setDialog} onEnabled={() => reload()} />
      )}
      <DisableDialog open={confirmOff} onOpenChange={setConfirmOff} onConfirm={disable} />
    </Card>
  );
}
