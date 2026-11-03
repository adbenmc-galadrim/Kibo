import type { RemoteStatus } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { client } from "../api";
import { frPhone } from "../i18n/fr-phone";
import { PairPhoneDialog } from "./PairPhoneDialog";
import { PhoneProjectsCard } from "./PhoneProjectsCard";
import { SettingsLayout } from "./SettingsLayout";
import { describeError, useRemoteStatus } from "./use-remote-status";

const DEFAULT_SERVER_URL = "https://kibo.shinseo.fr";
const t = frPhone;

type Apply = (status: RemoteStatus) => void;

const connectionLabel = (status: RemoteStatus, now: number): string =>
  status.connected
    ? t.access.connected(
        status.lastPushAt === null ? null : Math.max(0, Math.round((now - status.lastPushAt) / 1000)),
      )
    : t.access.offline;

function Field({ label, hint, children }: { label: string; hint?: string; children(id: string): ReactNode }) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function EnableForm({ serverUrl, onEnabled }: { serverUrl: string | null; onEnabled: Apply }) {
  const [url, setUrl] = useState(serverUrl ?? DEFAULT_SERVER_URL);
  const [setupCode, setSetupCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onEnabled(
        await client.rpc({ method: "remote.enable", serverUrl: url.trim(), setupCode: setupCode.trim() }),
      );
    } catch (err) {
      setError(t.enable.failed(describeError(err)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="grid max-w-md gap-4" onSubmit={(e) => void submit(e)}>
      <Field label={t.enable.serverUrl}>
        {(id) => <Input id={id} type="url" value={url} onChange={(e) => setUrl(e.target.value)} required />}
      </Field>
      <Field label={t.enable.setupCode} hint={t.enable.setupCodeHint}>
        {(id) => (
          <Input
            id={id}
            type="password"
            autoComplete="off"
            value={setupCode}
            onChange={(e) => setSetupCode(e.target.value)}
            required
          />
        )}
      </Field>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={busy || setupCode.trim() === ""}>
          {busy ? t.enable.busy : t.enable.submit}
        </Button>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-sm">{value}</dd>
    </div>
  );
}

type Confirm = "revoke" | "disable" | null;

function EnabledAccess({ status, apply }: { status: RemoteStatus; apply: Apply }) {
  const [pairing, setPairing] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const revoke = async () => apply(await client.rpc({ method: "remote.revokePhone" }));
  const disable = async () => apply(await client.rpc({ method: "remote.disable" }));
  const close = (open: boolean) => !open && setConfirm(null);
  return (
    <div className="grid gap-4">
      <dl className="grid gap-3">
        <Row label={t.access.server} value={status.serverUrl ?? DEFAULT_SERVER_URL} />
        <Row label={t.access.phone} value={status.phonePaired ? t.access.phonePaired : t.access.noPhone} />
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setPairing(true)}>{t.pair.open}</Button>
        {status.phonePaired && (
          <Button variant="outline" onClick={() => setConfirm("revoke")}>
            {t.revoke.open}
          </Button>
        )}
        <Button variant="ghost" className="text-destructive" onClick={() => setConfirm("disable")}>
          {t.disable.open}
        </Button>
      </div>
      <PairPhoneDialog open={pairing} onOpenChange={setPairing} />
      <ConfirmDialog
        open={confirm === "revoke"}
        onOpenChange={close}
        title={t.revoke.title}
        description={t.revoke.description}
        confirmLabel={t.revoke.confirm}
        cancelLabel={t.cancel}
        onConfirm={revoke}
      />
      <ConfirmDialog
        open={confirm === "disable"}
        onOpenChange={close}
        title={t.disable.title}
        description={t.disable.description}
        confirmLabel={t.disable.confirm}
        cancelLabel={t.cancel}
        onConfirm={disable}
      />
    </div>
  );
}

function StateBadge({ status, now }: { status: RemoteStatus; now: number }) {
  if (!status.enabled) return <Badge variant="secondary">{t.access.disabled}</Badge>;
  return (
    <Badge variant="outline" className="gap-1.5">
      <span
        aria-hidden
        className={
          status.connected
            ? "size-1.5 rounded-full bg-emerald-500"
            : "size-1.5 rounded-full bg-muted-foreground"
        }
      />
      {connectionLabel(status, now)}
    </Badge>
  );
}

function AccessCard() {
  const titleId = useId();
  const { status, error, now, apply } = useRemoteStatus();
  return (
    <>
      <Card role="region" aria-labelledby={titleId} className="gap-4">
        <CardHeader>
          <CardTitle id={titleId} className="flex flex-wrap items-center gap-2">
            {t.access.title}
            {status && <StateBadge status={status} now={now} />}
          </CardTitle>
          <CardDescription>{t.access.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {t.access.unreadable(error)}
            </p>
          )}
          {status === null && !error && <p className="text-sm text-muted-foreground">{t.access.loading}</p>}
          {status?.revokePending && !status.enabled && (
            <output className="mb-3 block text-sm text-muted-foreground">{t.access.revokePending}</output>
          )}
          {status && !status.enabled && <EnableForm serverUrl={status.serverUrl} onEnabled={apply} />}
          {status?.enabled && <EnabledAccess status={status} apply={apply} />}
        </CardContent>
      </Card>
      {status?.enabled && <PhoneProjectsCard selected={status.projects} onSaved={apply} />}
    </>
  );
}

export function PhonePage() {
  return (
    <SettingsLayout active="phone">
      <div className="flex flex-col gap-4 p-8">
        <div>
          <h1 className="text-xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <AccessCard />
      </div>
    </SettingsLayout>
  );
}
