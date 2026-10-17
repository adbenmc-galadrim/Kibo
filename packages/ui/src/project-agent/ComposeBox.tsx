import { PROJECT_AGENT_REF } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { Send, SendHorizontal } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { useSkillComplete } from "../skill-complete/use-skill-complete";

type Props = {
  projectId: string;
  placeholder: string;
  compact?: boolean;
  onSend(text: string): Promise<void>;
};

const t = frProjectAgent.compose;

const COMPACT_BOX =
  "flex h-[42px] items-center gap-[8px] rounded-[8px] border border-(--tracking-border) bg-(--tracking-bg) px-[12px]";
const COMPACT_INPUT =
  "h-auto min-h-0 flex-1 resize-none border-0 bg-transparent p-0 text-[13px] leading-[1.2] shadow-none placeholder:text-(--tracking-mfg) focus-visible:ring-0 dark:bg-transparent";

const sendKey = (
  e: { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean },
  compact: boolean,
) => e.key === "Enter" && (e.metaKey || e.ctrlKey || (compact && !e.shiftKey));

export function ComposeBox({ projectId, placeholder, compact = false, onSend }: Props) {
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

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    complete.inputProps.onKeyDown(e);
    if (e.defaultPrevented || !sendKey(e, compact)) return;
    e.preventDefault();
    void send();
  };

  const alert = error && (
    <p role="alert" className="text-xs text-destructive">
      {error}
    </p>
  );

  if (compact)
    return (
      <div className="grid gap-2 border-t border-(--tracking-soft) px-[18px] py-[14px]">
        <div className={`relative ${COMPACT_BOX}`}>
          <Textarea
            id={id}
            rows={1}
            aria-label={t.label}
            className={COMPACT_INPUT}
            placeholder={placeholder}
            {...complete.inputProps}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            aria-label={t.send}
            className="k-focus text-(--tracking-mfg) disabled:opacity-50"
            disabled={!ready}
            onClick={() => void send()}
          >
            <Send className="size-[15px]" />
          </button>
          {complete.list}
        </div>
        {alert}
      </div>
    );

  return (
    <div className="grid gap-2 border-t p-3">
      <div className="relative">
        <Textarea
          id={id}
          aria-label={t.label}
          className="max-h-48 min-h-20 resize-none text-sm"
          placeholder={placeholder}
          {...complete.inputProps}
          onKeyDown={onKeyDown}
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
      {alert}
    </div>
  );
}
