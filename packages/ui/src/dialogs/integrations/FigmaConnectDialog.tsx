import { type IntegrationStatus, KiboError } from "@kibo/schema";
import { Alert, AlertDescription } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
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
import { CircleX, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import type { IntegrationDialogProps } from "../../settings/integration-dialogs";

const t = fr.integrations.figma;

const statusError = (s: IntegrationStatus) =>
  s.error?.code === "MCP_FAILED" ? t.missingTools : t.unreachable;

export function FigmaConnectDialog({ open, onOpenChange, onDone }: IntegrationDialogProps) {
  const urlId = useId();
  const [url, setUrl] = useState(t.defaultUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await client.rpc({ method: "configureFigma", url });
      if (s.state === "connected") onDone();
      else setError(statusError(s));
    } catch (e) {
      setError(e instanceof KiboError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={urlId}>{t.url}</Label>
          <Input
            id={urlId}
            className="font-mono"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={error !== null}
          />
          <p className="text-xs text-muted-foreground">{t.urlHelp}</p>
        </div>
        {error && (
          <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
            <CircleX aria-hidden />
            <AlertDescription className="text-destructive">{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {fr.common.cancel}
          </Button>
          <Button disabled={busy || url.trim() === ""} onClick={() => void submit()}>
            {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {t.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
