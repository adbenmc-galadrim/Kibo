import { PROJECT_AGENT_REF } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { SendHorizontal } from "lucide-react";
import { useId, useState } from "react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { useSkillComplete } from "../skill-complete/use-skill-complete";

type Props = { projectId: string; placeholder: string; onSend(text: string): Promise<void> };

const t = frProjectAgent.compose;

export function ComposeBox({ projectId, placeholder, onSend }: Props) {
  const id = useId();
  const [text, setText] = useState("");
  const complete = useSkillComplete({
    agentRef: PROJECT_AGENT_REF,
    projectId,
    value: text,
    onValueChange: setText,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = text.trim() !== "" && !busy;

  const send = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await onSend(text.trim());
      setText("");
    } catch (e) {
      console.error(e);
      setError(frProjectAgent.sendFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-2 border-t p-3">
      <div className="relative">
        <Textarea
          id={id}
          aria-label={t.label}
          className="max-h-48 min-h-20 resize-none text-sm"
          placeholder={placeholder}
          {...complete.inputProps}
          onKeyDown={(e) => {
            complete.inputProps.onKeyDown(e);
            if (e.defaultPrevented || e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
            e.preventDefault();
            void send();
          }}
        />
        {complete.list}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs text-muted-foreground">{t.hint}</span>
        <Button
          size="sm"
          className="h-7 bg-brand-strong text-white hover:bg-brand-strong/90"
          disabled={!ready}
          onClick={() => void send()}
        >
          <SendHorizontal />
          {t.send}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
