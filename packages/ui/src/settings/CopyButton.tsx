import { Button } from "@kibo/sdk/ui/button";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { fr } from "../i18n/fr";

type State = "idle" | "copied" | "failed";

export function CopyButton({ text, variant = "ghost" }: { text: string; variant?: "ghost" | "outline" }) {
  const t = fr.security;
  const [state, setState] = useState<State>("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch (e) {
      console.error("[kibo-ui] copy failed", e);
      setState("failed");
    }
  };
  return (
    <Button type="button" variant={variant} size="sm" disabled={text === ""} onClick={copy}>
      {state === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
      {state === "copied" ? t.copied : state === "failed" ? t.copyFailed : t.copy}
    </Button>
  );
}
