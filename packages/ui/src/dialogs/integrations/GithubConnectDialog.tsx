import { type GithubConnectOptions, KiboError } from "@kibo/schema";
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
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup } from "@kibo/sdk/ui/radio-group";
import { KeyRound, Loader2, Terminal } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import type { IntegrationDialogProps } from "../../settings/integration-dialogs";
import { ChoiceCard } from "../ChoiceCard";
import { FormError } from "./FormError";

const t = fr.integrations.github;

function connectError(e: unknown): string {
  if (!(e instanceof KiboError)) return String(e);
  if (e.code === "REMOTE_REJECTED") return t.refused;
  if (e.code === "SECRET_STORE_UNAVAILABLE") return fr.integrations.keychainUnavailable;
  return e.detail;
}

const ghDescription = (options: GithubConnectOptions | null) =>
  options?.ghAvailable && options.ghLogin ? `${t.ghHelp} ${t.ghDetected(options.ghLogin)}` : t.ghMissing;

export function GithubConnectDialog({ open, onOpenChange, onDone }: IntegrationDialogProps) {
  const tokenId = useId();
  const [options, setOptions] = useState<GithubConnectOptions | null>(null);
  const [mode, setMode] = useState<"gh" | "token">("token");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    client.rpc({ method: "getGithubConnectOptions" }).then(
      (o) => {
        setOptions(o);
        setMode(o.ghAvailable ? "gh" : "token");
      },
      (e: unknown) => setError(connectError(e)),
    );
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const auth = mode === "gh" ? { mode: "gh" as const } : { mode: "token" as const, token };
      const { login } = await client.rpc({ method: "connectGithub", auth });
      onDone(t.connected(login));
    } catch (e) {
      setError(connectError(e));
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
        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v === "gh" ? "gh" : "token")}
          className="grid gap-2"
        >
          <ChoiceCard
            value="gh"
            icon={Terminal}
            title={t.gh}
            badge={<Badge variant="outline">{t.ghRecommended}</Badge>}
            description={ghDescription(options)}
            disabled={!options?.ghAvailable}
          />
          <ChoiceCard value="token" icon={KeyRound} title={t.token} description={t.tokenHelp} />
        </RadioGroup>
        {mode === "token" && (
          <div className="grid gap-2">
            <Label htmlFor={tokenId}>{t.tokenLabel}</Label>
            <Input
              id={tokenId}
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              placeholder={t.tokenPlaceholder}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              aria-invalid={error !== null}
            />
            <p className="text-xs text-muted-foreground">{t.scopes}</p>
          </div>
        )}
        <FormError message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {fr.common.cancel}
          </Button>
          <Button disabled={busy || (mode === "token" && token.trim() === "")} onClick={() => void submit()}>
            {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {busy ? t.verifying : t.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
