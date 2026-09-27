import { KiboError, type RemoteAccessStatus, type RemoteTls } from "@kibo/schema";
import { Alert, AlertDescription, AlertTitle } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
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
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { TriangleAlert } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { securityFailure } from "../lib/security-error";

type Props = {
  status: RemoteAccessStatus;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEnabled: (s: RemoteAccessStatus) => void;
};
type TlsKind = RemoteTls["kind"];

const t = fr.security.remote;
const DEFAULT_PORT = 47832;
const isLoopback = (address: string) => address.startsWith("127.") || address === "::1";

function validPort(port: string): boolean {
  const n = Number(port);
  return Number.isInteger(n) && n >= 1024 && n <= 65535;
}

function CertificateFields({
  kind,
  onKind,
  certFile,
  keyFile,
  onCert,
  onKey,
}: {
  kind: TlsKind;
  onKind(k: TlsKind): void;
  certFile: string;
  keyFile: string;
  onCert(v: string): void;
  onKey(v: string): void;
}) {
  const certId = useId();
  const keyId = useId();
  return (
    <div className="grid gap-2">
      <Label>{t.certificate}</Label>
      <RadioGroup
        aria-label={t.certificate}
        value={kind}
        onValueChange={(v) => onKind(v === "provided" ? "provided" : "self-signed")}
        className="flex gap-4"
      >
        <Label className="flex items-center gap-2 font-normal">
          <RadioGroupItem value="self-signed" />
          {t.selfSigned}
        </Label>
        <Label className="flex items-center gap-2 font-normal">
          <RadioGroupItem value="provided" />
          {t.provided}
        </Label>
      </RadioGroup>
      {kind === "provided" && (
        <div className="grid gap-2">
          <Label htmlFor={certId}>{t.certFile}</Label>
          <Input
            id={certId}
            value={certFile}
            onChange={(e) => onCert(e.target.value)}
            className="font-mono"
          />
          <Label htmlFor={keyId}>{t.keyFile}</Label>
          <Input id={keyId} value={keyFile} onChange={(e) => onKey(e.target.value)} className="font-mono" />
        </div>
      )}
    </div>
  );
}

export function EnableRemoteAccessDialog({ status, open, onOpenChange, onEnabled }: Props) {
  const ifaceId = useId();
  const portId = useId();
  const consentId = useId();
  const candidates = status.interfaces.filter((i) => !isLoopback(i.address));
  const preferred = candidates.find((i) => !i.address.includes(":")) ?? candidates[0];
  const [address, setAddress] = useState(preferred?.address ?? "");
  const [port, setPort] = useState(String(DEFAULT_PORT));
  const [kind, setKind] = useState<TlsKind>("self-signed");
  const [certFile, setCertFile] = useState("");
  const [keyFile, setKeyFile] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const certified = kind === "self-signed" || (certFile.trim() !== "" && keyFile.trim() !== "");
  const ready = consent && address !== "" && validPort(port) && certified;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const tls: RemoteTls =
        kind === "self-signed" ? { kind } : { kind, certFile: certFile.trim(), keyFile: keyFile.trim() };
      onEnabled(await client.rpc({ method: "enableRemoteAccess", address, port: Number(port), tls }));
      onOpenChange(false);
    } catch (err) {
      if (!(err instanceof KiboError)) throw err;
      setError(t.failed(securityFailure(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.dialogTitle}</DialogTitle>
          <DialogDescription>{t.dialogHelp}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <div className="grid gap-2">
              <Label htmlFor={ifaceId}>{t.iface}</Label>
              <Select value={address} onValueChange={setAddress} disabled={candidates.length === 0}>
                <SelectTrigger id={ifaceId} className="w-full">
                  <SelectValue placeholder={t.noInterface} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((i) => (
                    <SelectItem key={`${i.name}-${i.address}`} value={i.address}>
                      {`${i.name} · ${i.address}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={portId}>{t.port}</Label>
              <Input
                id={portId}
                inputMode="numeric"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          <CertificateFields
            kind={kind}
            onKind={setKind}
            certFile={certFile}
            keyFile={keyFile}
            onCert={setCertFile}
            onKey={setKeyFile}
          />
          <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <TriangleAlert />
            <AlertTitle>{t.warningTitle}</AlertTitle>
            <AlertDescription className="text-foreground/80">{t.warning}</AlertDescription>
          </Alert>
          <div className="flex items-start gap-2">
            <Checkbox id={consentId} checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
            <Label htmlFor={consentId} className="font-normal leading-snug">
              {t.consent}
            </Label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {fr.common.cancel}
            </Button>
            <Button type="submit" disabled={!ready || busy}>
              {busy ? t.enabling : t.enable}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
