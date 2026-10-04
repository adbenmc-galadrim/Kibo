import type { IntegrationStatus } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { RadioGroup } from "@kibo/sdk/ui/radio-group";
import { KeyRound, Loader2, Plug } from "lucide-react";
import { useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { frDesign } from "../../i18n/fr-design";
import type { IntegrationDialogProps } from "../../settings/integration-dialogs";
import { ChoicePanel } from "./ChoicePanel";
import { type ConnectProblem, connectProblem } from "./design-problem";
import { Notice } from "./Notice";
import { SecretInput } from "./SecretInput";
import { UrlInput } from "./UrlInput";

const t = frDesign.connect.figma;
const FIGMA_API = "https://api.figma.com";

type Mode = "token" | "mcp";

const doneText = (s: IntegrationStatus) => (s.account ? t.connected(s.account) : t.connectedMcp);

export function FigmaConnectDialog({ open, onOpenChange, onDone }: IntegrationDialogProps) {
  const [mode, setMode] = useState<Mode>("token");
  const [token, setToken] = useState("");
  const [url, setUrl] = useState(t.defaultUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ConnectProblem | null>(null);
  const address = mode === "mcp" ? url : FIGMA_API;
  const ready = mode === "token" ? token.trim() !== "" : url.trim() !== "";

  const choose = (value: string) => {
    setMode(value === "mcp" ? "mcp" : "token");
    setError(null);
  };
  const submit = async () => {
    setBusy(true);
    setError(null);
    const auth = mode === "token" ? { mode, token } : { mode, url };
    setToken("");
    try {
      const s = await client.rpc({ method: "connectFigma", auth });
      if (s.state === "connected") onDone(doneText(s));
      else setError(connectProblem("figma", s.error, address));
    } catch (e) {
      setError(connectProblem("figma", e, address));
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
        <RadioGroup value={mode} onValueChange={choose} className="grid gap-2">
          <ChoicePanel
            value="token"
            icon={KeyRound}
            title={t.token}
            badge={<Badge variant="outline">{t.tokenRecommended}</Badge>}
          >
            {mode === "token" && (
              <div className="pt-1">
                <SecretInput
                  label={t.tokenLabel}
                  placeholder={t.tokenPlaceholder}
                  help={t.tokenHelp}
                  value={token}
                  invalid={error?.field === "token"}
                  onChange={setToken}
                />
              </div>
            )}
          </ChoicePanel>
          <ChoicePanel value="mcp" icon={Plug} title={t.mcp}>
            {mode === "mcp" && (
              <div className="pt-1">
                <UrlInput
                  label={t.url}
                  help={t.urlHelp}
                  value={url}
                  invalid={error?.field === "address"}
                  onChange={setUrl}
                />
              </div>
            )}
          </ChoicePanel>
        </RadioGroup>
        {error && <Notice tone={error.tone} title={error.title} detail={error.detail} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {fr.common.cancel}
          </Button>
          <Button disabled={busy || !ready} onClick={() => void submit()}>
            {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {busy ? frDesign.connect.verifying : frDesign.connect.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
