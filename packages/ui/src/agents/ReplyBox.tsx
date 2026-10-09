import { KiboError, type RunView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frAgentsPage } from "../i18n/fr-agents-page";
import { frRunChat } from "../i18n/fr-run-chat";

type Props = { run: RunView; mode?: "answer" | "write"; title?: string; pending?: boolean };

function texts(mode: "answer" | "write", label: string) {
  const r = fr.agents.reply;
  return mode === "answer"
    ? { label: r.label(label), placeholder: r.placeholder, failed: r.failed }
    : {
        label: frRunChat.writeLabel(label),
        placeholder: frRunChat.writePlaceholder,
        failed: frRunChat.writeFailed,
      };
}

export function ReplyBox({ run, mode = "answer", title, pending = false }: Props) {
  const id = useId();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const t = texts(mode, run.label);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFailure(null);
    setSending(true);
    try {
      await client.rpc({ method: "answerRun", runId: run.id, text: text.trim() });
      setText("");
    } catch (err) {
      setFailure(
        err instanceof KiboError && err.code === "CONFLICT" ? frAgentsPage.assign.ticketBusy : t.failed,
      );
    } finally {
      setSending(false);
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-1">
      {title && <p className="text-xs font-medium text-muted-foreground">{title}</p>}
      <div className="flex items-center gap-3 rounded-md border border-brand/60 px-3 py-1.5">
        <label htmlFor={id} className="sr-only">
          {t.label}
        </label>
        <Input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.placeholder}
          className="h-8 border-0 px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        {!pending && <span className="shrink-0 text-xs text-muted-foreground">{fr.agents.reply.hint}</span>}
        <Button
          type="submit"
          size="sm"
          disabled={!text.trim() || sending}
          className="bg-brand-strong text-white hover:bg-brand-strong/90"
        >
          {fr.agents.reply.send}
        </Button>
      </div>
      {pending && <p className="text-xs text-muted-foreground">{frRunChat.nextTurn}</p>}
      {failure && (
        <p role="alert" className="text-xs text-destructive">
          {failure}
        </p>
      )}
    </form>
  );
}
