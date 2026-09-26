import type { SandboxStatus } from "@kibo/schema";
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
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Label } from "@kibo/sdk/ui/label";
import { Switch } from "@kibo/sdk/ui/switch";
import { TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { sandboxActive, sandboxProblem } from "../lib/sandbox-problem";
import { securityFailure } from "../lib/security-error";
import { useRpcQuery } from "../state/use-rpc-query";

const t = fr.security.isolation;

function IsolationState({ status }: { status: SandboxStatus }) {
  if (status.available)
    return (
      <p className="flex items-center gap-2 text-sm">
        <span aria-hidden className="size-2 rounded-full bg-emerald-500" />
        <span className="text-emerald-700 dark:text-emerald-400">{sandboxActive(status)}</span>
        <span className="text-muted-foreground">{t.activeDetail}</span>
      </p>
    );
  return (
    <div className="grid gap-2 text-sm">
      <p className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <TriangleAlert aria-hidden className="size-4" />
        {t.unavailable(sandboxProblem(status))}
      </p>
      {status.fix && (
        <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
          {t.fix}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
            {status.fix}
          </code>
        </p>
      )}
    </div>
  );
}

function AllowDialog({
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
          <AlertDialogTitle>{t.allowTitle}</AlertDialogTitle>
          <AlertDialogDescription className="text-destructive">{t.allowWarning}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{fr.common.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t.allowConfirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function IsolationCard() {
  const allowId = useId();
  const {
    data: status,
    error: loadError,
    reload,
  } = useRpcQuery({ method: "getSandboxStatus" }, ["sandbox.changed"]);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAllow = async (allow: boolean) => {
    setConfirm(false);
    setError(null);
    try {
      await client.rpc({ method: "setAllowUnsandboxed", allow });
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
        {status && <IsolationState status={status} />}
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
        <div className="flex items-center justify-between gap-6">
          <Label htmlFor={allowId} className="font-normal">
            {t.allow}
          </Label>
          <Switch
            id={allowId}
            checked={status?.allowUnsandboxed ?? false}
            disabled={!status}
            onCheckedChange={(checked) => (checked ? setConfirm(true) : setAllow(false))}
          />
        </div>
      </CardContent>
      <AllowDialog open={confirm} onOpenChange={setConfirm} onConfirm={() => setAllow(true)} />
    </Card>
  );
}
