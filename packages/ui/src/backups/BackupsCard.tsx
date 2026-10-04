import { type BackupStatus, KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Label } from "@kibo/sdk/ui/label";
import { Switch } from "@kibo/sdk/ui/switch";
import { FolderOpen } from "lucide-react";
import { useId, useState } from "react";
import { client } from "../api";
import { pickFolder } from "../desktop/pick-folder";
import { revealInDir } from "../desktop/reveal";
import { frBackups as t } from "../i18n/fr-backups";
import { errorMessage } from "../lib/error-message";
import { SOURCE_URL } from "../lib/kibo-links";
import { inTauri } from "../shell/workspace-actions";
import { useRpcQuery } from "../state/use-rpc-query";
import { BackupsList } from "./BackupsList";
import { lastBackupLine, nextBackupLine } from "./backups-text";

const GUIDE_URL = `${SOURCE_URL}/blob/main/docs/installation.md#sauvegardes-et-restauration`;

function failureText(e: unknown, action: "create" | "folder"): string {
  if (e instanceof KiboError && e.code === "CONFLICT") return t.errors.conflict;
  if (e instanceof KiboError && e.code === "INVALID_INPUT" && action === "folder") return t.errors.folder;
  return errorMessage(e);
}

function AutoRow({ status, onToggle }: { status: BackupStatus; onToggle(enabled: boolean): void }) {
  const id = useId();
  const { enabled } = status.settings;
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="grid gap-1">
        <Label htmlFor={id}>{t.auto}</Label>
        <p className="text-sm text-muted-foreground">
          {enabled && status.nextAt !== null ? nextBackupLine(status.nextAt, Date.now()) : t.autoOff}
        </p>
      </div>
      <Switch id={id} checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}

type FolderProps = {
  status: BackupStatus;
  desktop: boolean;
  onReveal(): void;
  onChoose(): void;
  onDefault(): void;
};

function FolderRow({ status, desktop, onReveal, onChoose, onDefault }: FolderProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <FolderOpen aria-hidden className="size-4 text-muted-foreground" />
      <span className="text-muted-foreground">{t.folder}</span>
      <span className="font-mono text-xs">{status.displayDir}</span>
      <span className="flex-1" />
      {desktop && (
        <>
          <Button variant="outline" size="sm" onClick={onReveal}>
            {t.openFolder}
          </Button>
          <Button variant="outline" size="sm" onClick={onChoose}>
            {t.chooseFolder}
          </Button>
          {status.settings.dir !== null && (
            <Button variant="ghost" size="sm" onClick={onDefault}>
              {t.defaultFolder}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export type BackupsCardProps = {
  desktop?: boolean;
  pick?: (from: string | null) => Promise<string | null>;
  reveal?: (path: string) => Promise<void>;
};

export function BackupsCard({
  desktop = inTauri(),
  pick = pickFolder,
  reveal = revealInDir,
}: BackupsCardProps) {
  const { data, error: loadError } = useRpcQuery({ method: "getBackups" }, ["backups.changed"]);
  const [creating, setCreating] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const status = data?.status ?? null;

  const attempt = async (action: "create" | "folder", run: () => Promise<unknown>) => {
    setFailure(null);
    try {
      await run();
    } catch (e) {
      console.error("[kibo-ui] backup action failed", e);
      setFailure(failureText(e, action));
    }
  };
  const create = async () => {
    setCreating(true);
    await attempt("create", () => client.rpc({ method: "createBackup", reason: "manual" }));
    setCreating(false);
  };
  const setDir = (dir: string | null) =>
    attempt("folder", () => client.rpc({ method: "setBackupSettings", patch: { dir } }));
  const choose = async () => {
    if (!status) return;
    const dir = await pick(status.dir);
    if (dir !== null) await setDir(dir);
  };
  const openFolder = async () => {
    if (!status) return;
    await reveal(status.dir).catch((e: unknown) => {
      console.error("[kibo-ui] reveal failed", e);
      setFailure(t.errors.reveal);
    });
  };

  const busy = creating || (status?.running ?? false);
  const shown = failure ?? (loadError ? errorMessage(loadError) : null);
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      {status && (
        <CardContent className="grid gap-4">
          <AutoRow
            status={status}
            onToggle={(enabled) =>
              void attempt("folder", () => client.rpc({ method: "setBackupSettings", patch: { enabled } }))
            }
          />
          <FolderRow
            status={status}
            desktop={desktop}
            onReveal={() => void openFolder()}
            onChoose={() => void choose()}
            onDefault={() => void setDir(null)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" disabled={busy} onClick={() => void create()}>
              {busy ? t.running : t.backupNow}
            </Button>
            <span className="text-sm text-muted-foreground">{lastBackupLine(status.last, Date.now())}</span>
          </div>
          {shown && (
            <p role="alert" className="text-sm text-destructive">
              {shown}
            </p>
          )}
          <BackupsList
            backups={data?.backups ?? []}
            onDelete={(id) => client.rpc({ method: "deleteBackup", id }).then(() => undefined)}
          />
          <div className="grid gap-1 text-xs text-muted-foreground">
            <p>{t.excluded}</p>
            <p>
              {t.restore}{" "}
              <a href={GUIDE_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {t.guide}
              </a>
            </p>
          </div>
        </CardContent>
      )}
      {!status && shown && (
        <CardContent>
          <p role="alert" className="text-sm text-destructive">
            {shown}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
