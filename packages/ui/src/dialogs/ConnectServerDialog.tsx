import { Button } from "@kibo/sdk/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
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
import { ChevronRight } from "lucide-react";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { syncFailure } from "../lib/sync-errors";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewer: string;
  mode: "server" | "device";
  onConnected(): void;
};

const t = fr.sync;

function Field({
  id,
  label,
  help,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help && (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {help}
        </p>
      )}
    </div>
  );
}

export function ConnectServerDialog({ open, onOpenChange, viewer, mode, onConnected }: Props) {
  const id = useId();
  const ids = { url: `${id}-url`, code: `${id}-code`, device: `${id}-device`, ca: `${id}-ca` };
  const [serverUrl, setServerUrl] = useState("");
  const [code, setCode] = useState("");
  const [deviceName, setDeviceName] = useState(t.defaultDevice(viewer));
  const [caFile, setCaFile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await client.rpc({
        method: "connectSyncServer",
        serverUrl: serverUrl.trim(),
        code: code.trim(),
        deviceName: deviceName.trim(),
        caFile: caFile.trim() || null,
      });
      setCode("");
      onConnected();
      onOpenChange(false);
    } catch (err) {
      setError(syncFailure(t.connectErrors, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.dialogTitle}</DialogTitle>
            <DialogDescription>{t.dialogHelp}</DialogDescription>
          </DialogHeader>
          <Field id={ids.url} label={t.serverUrl} help={t.urlHelp}>
            <Input
              id={ids.url}
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="wss://sync.kibo.test"
              className="font-mono"
              autoComplete="off"
              aria-describedby={`${ids.url}-help`}
              required
            />
          </Field>
          <Field id={ids.code} label={t.code} help={mode === "device" ? t.codeHelpDevice : t.codeHelpServer}>
            <Input
              id={ids.code}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="font-mono"
              autoComplete="off"
              spellCheck={false}
              aria-describedby={`${ids.code}-help`}
              required
            />
          </Field>
          <Field id={ids.device} label={t.deviceName}>
            <Input
              id={ids.device}
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              required
            />
          </Field>
          <Collapsible className="grid gap-3">
            <CollapsibleTrigger className="group flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronRight
                aria-hidden
                className="size-3.5 transition-transform group-data-[state=open]:rotate-90"
              />
              {t.advanced}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Field id={ids.ca} label={t.caFile} help={t.caFileHelp}>
                <Input
                  id={ids.ca}
                  value={caFile}
                  onChange={(e) => setCaFile(e.target.value)}
                  placeholder="/etc/ssl/equipe-ca.pem"
                  className="font-mono"
                  aria-describedby={`${ids.ca}-help`}
                />
              </Field>
            </CollapsibleContent>
          </Collapsible>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {fr.common.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t.submitting : t.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
