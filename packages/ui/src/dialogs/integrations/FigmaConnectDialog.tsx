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
import { Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import type { IntegrationDialogProps } from "../../settings/integration-dialogs";
import { type FigmaProblem, figmaProblem } from "./figma-problem";
import { Notice } from "./Notice";

const t = fr.integrations.figma;

export function FigmaConnectDialog({ open, onOpenChange, onDone }: IntegrationDialogProps) {
  const urlId = useId();
  const [url, setUrl] = useState(t.defaultUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FigmaProblem | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await client.rpc({ method: "connectFigma", auth: { mode: "mcp", url } });
      if (s.state === "connected") onDone();
      else setError(figmaProblem(s.error, url));
    } catch (e) {
      setError(figmaProblem(e, url));
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
        {error && <Notice {...error} />}
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
