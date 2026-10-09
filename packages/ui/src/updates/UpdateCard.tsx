import { Alert, AlertDescription, AlertTitle } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Progress } from "@kibo/sdk/ui/progress";
import { CircleX, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { holdsSlot } from "../agents/queue-runs";
import { frUpdates as t } from "../i18n/fr-updates";
import { RELEASES_URL } from "../lib/kibo-links";
import { inTauri } from "../shell/workspace-actions";
import { useAgents } from "../state/use-agents";
import { classifyUpdateFailure, downloadPercent, type UpdateInfo, type UpdateStatus } from "./update-state";
import type { UpdateSnapshot, UpdateStore } from "./update-store";
import { updateStore, useUpdateSnapshot } from "./use-update";

const timeOf = (ms: number) =>
  new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dateOf = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");

function Available({
  update,
  activeRuns,
  onInstall,
}: {
  update: UpdateInfo;
  activeRuns: number;
  onInstall(): void;
}) {
  return (
    <div className="grid gap-3">
      <p className="text-sm font-medium">
        {t.available(update.version)}
        {update.publishedAt && (
          <span className="font-normal text-muted-foreground">
            {" "}
            · {t.published(dateOf(update.publishedAt))}
          </span>
        )}
      </p>
      <div className="grid gap-1">
        <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{t.notes}</p>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 font-sans text-sm">
          {update.notes ?? t.noNotes}
        </pre>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={activeRuns > 0} onClick={onInstall}>
          {t.install}
        </Button>
        {activeRuns > 0 && (
          <span className="text-sm text-muted-foreground">{t.blockedByRuns(activeRuns)}</span>
        )}
      </div>
    </div>
  );
}

function Downloading({ status }: { status: Extract<UpdateStatus, { phase: "downloading" }> }) {
  const percent = downloadPercent(status);
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-sm">
        <span>{t.downloading}</span>
        {percent !== null && <span className="text-muted-foreground">{t.downloaded(percent)}</span>}
      </div>
      <Progress value={percent ?? 0} aria-valuenow={percent ?? undefined} />
    </div>
  );
}

const WITH_RELEASES = new Set(["install", "appImageOnly", "invalid"]);

function Failure({ status }: { status: Extract<UpdateStatus, { phase: "error" }> }) {
  const kind = classifyUpdateFailure(status.step, status.detail);
  if (kind === "noRelease") return <p className="text-sm text-muted-foreground">{t.errors.noRelease}</p>;
  return (
    <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
      <CircleX aria-hidden />
      <AlertTitle>{t.failed}</AlertTitle>
      <AlertDescription className="text-foreground/80!">
        <span>{t.errors[kind]}</span>
        {WITH_RELEASES.has(kind) && (
          <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            {t.releases}
          </a>
        )}
      </AlertDescription>
    </Alert>
  );
}

function Status({
  status,
  activeRuns,
  onInstall,
}: {
  status: UpdateStatus;
  activeRuns: number;
  onInstall(): void;
}) {
  switch (status.phase) {
    case "idle":
      return null;
    case "checking":
      return <p className="text-sm text-muted-foreground">{t.checking}</p>;
    case "current":
      return (
        <p className="text-sm">
          {t.upToDate} <span className="text-muted-foreground">{t.lastCheck(timeOf(status.checkedAt))}</span>
        </p>
      );
    case "available":
      return <Available update={status.update} activeRuns={activeRuns} onInstall={onInstall} />;
    case "backingUp":
      return <p className="text-sm">{t.backingUp}</p>;
    case "downloading":
      return <Downloading status={status} />;
    case "installing":
      return <p className="text-sm">{t.installing}</p>;
    case "error":
      return (
        <div className="grid gap-3">
          <Failure status={status} />
          {status.update && (
            <Available update={status.update} activeRuns={activeRuns} onInstall={onInstall} />
          )}
        </div>
      );
  }
}

export type UpdatePanelProps = {
  snapshot: UpdateSnapshot;
  activeRuns: number;
  desktop: boolean;
  onCheck(): void;
  onInstall(): void;
};

export function UpdatePanel({ snapshot, activeRuns, desktop, onCheck, onInstall }: UpdatePanelProps) {
  const busy = ["checking", "backingUp", "downloading"].includes(snapshot.status.phase);
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{desktop ? t.help : t.browserOnly}</CardDescription>
      </CardHeader>
      {desktop && (
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" disabled={busy} onClick={onCheck}>
              <RefreshCw aria-hidden />
              {t.check}
            </Button>
            <span className="text-sm text-muted-foreground">
              {snapshot.installed ? t.current(snapshot.installed) : t.unknownVersion}
            </span>
          </div>
          <Status status={snapshot.status} activeRuns={activeRuns} onInstall={onInstall} />
        </CardContent>
      )}
    </Card>
  );
}

function DesktopUpdateCard({ store }: { store: UpdateStore }) {
  const snapshot = useUpdateSnapshot(store);
  const agents = useAgents();
  useEffect(() => void store.loadInstalled(), [store]);
  const activeRuns = agents?.runs.filter(holdsSlot).length ?? 0;
  return (
    <UpdatePanel
      snapshot={snapshot}
      activeRuns={activeRuns}
      desktop
      onCheck={() => void store.check()}
      onInstall={() => void store.install()}
    />
  );
}

const BROWSER: UpdateSnapshot = { installed: null, status: { phase: "idle" } };

export function UpdateCard({
  store = updateStore,
  desktop = inTauri(),
}: {
  store?: UpdateStore;
  desktop?: boolean;
}) {
  if (!desktop)
    return (
      <UpdatePanel
        snapshot={BROWSER}
        activeRuns={0}
        desktop={false}
        onCheck={() => {}}
        onInstall={() => {}}
      />
    );
  return <DesktopUpdateCard store={store} />;
}
