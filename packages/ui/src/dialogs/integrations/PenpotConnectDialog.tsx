import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { frDesign } from "../../i18n/fr-design";
import type { IntegrationDialogProps } from "../../settings/integration-dialogs";
import { type ConnectProblem, connectProblem } from "./design-problem";
import { Notice } from "./Notice";
import { SecretInput } from "./SecretInput";
import { UrlInput } from "./UrlInput";

const t = frDesign.connect.penpot;

export function PenpotConnectDialog({ open, onOpenChange, onDone }: IntegrationDialogProps) {
  const [url, setUrl] = useState(t.defaultUrl);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ConnectProblem | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const sent = { url: url.trim(), token };
    setToken("");
    try {
      const s = await client.rpc({ method: "connectPenpot", ...sent });
      if (s.state === "connected") onDone(t.connected(s.account ?? ""));
      else setError(connectProblem("penpot", s.error, sent.url));
    } catch (e) {
      setError(connectProblem("penpot", e, sent.url));
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
        <UrlInput
          label={t.url}
          help={t.urlHelp}
          value={url}
          invalid={error?.field === "address"}
          onChange={setUrl}
        />
        <SecretInput
          label={t.tokenLabel}
          placeholder={t.tokenPlaceholder}
          help={t.tokenHelp}
          value={token}
          invalid={error?.field === "token"}
          onChange={setToken}
        />
        {error && <Notice tone={error.tone} title={error.title} detail={error.detail} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {fr.common.cancel}
          </Button>
          <Button disabled={busy || url.trim() === "" || token.trim() === ""} onClick={() => void submit()}>
            {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {busy ? frDesign.connect.verifying : frDesign.connect.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
