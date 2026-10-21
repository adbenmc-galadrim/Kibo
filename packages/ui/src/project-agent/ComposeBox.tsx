import { PROJECT_AGENT_REF } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { Send } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { useSkillComplete } from "../skill-complete/use-skill-complete";
import { READING_COLUMN } from "./reading-column";

type Props = {
  projectId: string;
  placeholder: string;
  onSend(text: string): Promise<void>;
};

const t = frProjectAgent.compose;

const BOX =
  "relative flex h-[42px] items-center gap-[8px] rounded-[8px] border border-(--tracking-border) bg-(--tracking-bg) px-[12px]";
const INPUT =
  "h-auto min-h-0 flex-1 resize-none border-0 bg-transparent p-0 text-[13px] leading-[1.2] shadow-none placeholder:text-(--tracking-mfg) focus-visible:ring-0 dark:bg-transparent";

const sendKey = (e: { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }) =>
  e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey);

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

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    complete.inputProps.onKeyDown(e);
    if (e.defaultPrevented || !sendKey(e)) return;
    e.preventDefault();
    void send();
  };

  return (
    <div className="shrink-0 border-t border-(--tracking-soft) px-[18px] py-[14px]">
      <div className={cn(READING_COLUMN, "grid gap-2")}>
        <div className={BOX}>
          <Textarea
            id={id}
            rows={1}
            aria-label={t.label}
            className={INPUT}
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
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
