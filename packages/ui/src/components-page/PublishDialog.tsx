import { KiboError, type PublishPreview, type PublishResult } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { Skeleton } from "@kibo/sdk/ui/skeleton";
import { useEffect, useState } from "react";
import { client } from "../api";
import { TrustDialog, type TrustTarget, trustTargetOf } from "../dialogs/TrustDialog";
import { fr } from "../i18n/fr";
import { isRemoteView } from "../lib/remote-view";
import { useProjects } from "../state/use-projects";
import {
  ChangesList,
  hasChanges,
  InvalidPreview,
  NEUTRAL_DOT,
  PublishReport,
  type Strategy,
  StrategyChoice,
  UsagesBox,
  validationErrors,
} from "./PublishSections";

type Props = {
  id: string;
  open: boolean;
  onOpenChange(o: boolean): void;
  onPublished?(result: PublishResult): void;
  remote?: boolean;
};

function explain(e: unknown, id: string): string {
  const p = fr.publish;
  if (!(e instanceof KiboError)) {
    console.error(e);
    return p.failed;
  }
  if (e.code === "VERSION_EXISTS") return p.versionExists;
  if (e.code === "INVALID_INPUT") return p.versionTooLow;
  if (e.code === "VALIDATION_FAILED") return p.invalid(id);
  if (e.code === "FORBIDDEN") return fr.componentErrors.FORBIDDEN;
  console.error(e);
  return p.failed;
}

async function pendingTrust(id: string, preview: PublishPreview): Promise<TrustTarget | null> {
  const list = await client.rpc({ method: "listComponents" });
  const version = list.find((c) => c.id === id)?.versions.find((x) => x.version === preview.to);
  return version ? trustTargetOf(id, preview.title, version) : null;
}

function usePreview(id: string, open: boolean) {
  const [preview, setPreview] = useState<PublishPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    setPreview(null);
    setError(null);
    client.rpc({ method: "previewPublish", id }).then(
      (pv) => {
        if (live) setPreview(pv);
      },
      (e: unknown) => {
        if (live) setError(explain(e, id));
      },
    );
    return () => {
      live = false;
    };
  }, [id, open]);
  return { preview, error, setError };
}

export function PublishDialog({ id, open, onOpenChange, onPublished, remote = isRemoteView() }: Props) {
  const p = fr.publish;
  const projects = useProjects() ?? [];
  const { preview, error, setError } = usePreview(id, open);
  const [strategy, setStrategy] = useState<Strategy>("update-all");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [trust, setTrust] = useState<TrustTarget | null>(null);

  const submit = async (pv: PublishPreview) => {
    setBusy(true);
    setError(null);
    try {
      const r = await client.rpc({
        method: "publishComponent",
        id,
        strategy: pv.usages.length > 0 ? strategy : "new-version",
      });
      setResult(r);
      onPublished?.(r);
      if (r.needsApproval) setTrust(await pendingTrust(id, pv));
    } catch (e) {
      setError(explain(e, id));
    } finally {
      setBusy(false);
    }
  };

  const colorOf = (projectId: string) => projects.find((x) => x.id === projectId)?.color ?? NEUTRAL_DOT;
  const errors = preview ? validationErrors(preview) : [];
  const publishable =
    preview !== null && preview.status !== "unchanged" && preview.validation.ok && result === null;
  const used = publishable && preview.usages.length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[39rem]">
          <DialogHeader>
            <DialogTitle>{preview ? p.title(preview.title, preview.to) : p.loading}</DialogTitle>
            {used && <DialogDescription>{p.subtitle}</DialogDescription>}
          </DialogHeader>
          {!preview && !error && <Skeleton className="h-40 w-full" />}
          {preview?.status === "unchanged" && <p className="text-sm text-muted-foreground">{p.unchanged}</p>}
          {preview && !preview.validation.ok && <InvalidPreview id={id} errors={errors} />}
          {used && <UsagesBox preview={preview} strategy={strategy} colorOf={colorOf} />}
          {publishable && hasChanges(preview) && <ChangesList preview={preview} />}
          {used && <StrategyChoice preview={preview} value={strategy} onChange={setStrategy} />}
          {result && preview && <PublishReport result={result} version={preview.to} />}
          {remote && publishable && (
            <p className="text-sm text-muted-foreground">{fr.componentErrors.FORBIDDEN}</p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {result ? fr.common.close : fr.common.cancel}
            </Button>
            {publishable && (
              <Button disabled={busy || remote} onClick={() => void submit(preview)}>
                {p.submit(preview.to)}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {trust && (
        <TrustDialog
          target={trust}
          mode="approve"
          open
          onOpenChange={(o) => !o && setTrust(null)}
          onApproved={() => setTrust(null)}
        />
      )}
    </>
  );
}
