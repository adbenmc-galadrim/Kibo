import { PROJECT_AGENT_REF } from "@kibo/schema";
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
  const ready = text.trim() !== "";

  const send = () => {
    if (!ready) return;
    setText("");
    void onSend(text.trim());
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    complete.inputProps.onKeyDown(e);
    if (e.defaultPrevented || !sendKey(e)) return;
    e.preventDefault();
    send();
  };

  return (
    <div className="shrink-0 border-t border-(--tracking-soft) px-[18px] py-[14px]">
      <div className={READING_COLUMN}>
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
            onClick={send}
          >
            <Send className="size-[15px]" />
          </button>
          {complete.list}
        </div>
      </div>
    </div>
  );
}
