import { LinkifiedText } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { Target } from "lucide-react";
import { useState } from "react";
import { frFeature as t } from "../../i18n/fr-group";
import type { TicketCommand } from "../../ticket/use-ticket-command";
import { STROKE } from "./styles";

type Props = {
  ticketId: string;
  description: string;
  editable: boolean;
  command: TicketCommand;
  onOpenFile(ref: { path: string; line: number | null }): void;
};

const TEXT = "text-[14px] leading-[22px] text-(--tracking-fg) whitespace-pre-wrap";

function Shown({ description, onOpenFile }: Pick<Props, "description" | "onOpenFile">) {
  if (!description) return <span className="text-(--tracking-dim)">{t.expectedEmpty}</span>;
  return <LinkifiedText text={description} onOpen={onOpenFile} />;
}

export function ExpectedResult({ ticketId, description, editable, command, onOpenFile }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const save = async () => {
    if (draft === null) return;
    if (await command.run({ method: "updateTicket", ticketId, description: draft })) setDraft(null);
  };
  return (
    <section
      aria-label={t.expectedField}
      className={`relative flex min-h-[100px] w-full overflow-hidden rounded-[8px] bg-(--tracking-card) ${STROKE}`}
    >
      <span aria-hidden className="w-[3px] shrink-0 bg-(--tracking-fg)" />
      <div className="flex min-w-0 flex-1 flex-col gap-[6px] px-[16px] py-[12px]">
        <h3 className="flex items-center gap-[6px] text-[12px] leading-[15px] font-semibold text-(--tracking-mfg)">
          <Target absoluteStrokeWidth size={14} aria-hidden className="size-[14px]" />
          {t.expected}
        </h3>
        {draft === null ? (
          editable ? (
            <button
              type="button"
              aria-label={t.editExpected}
              className={`text-left ${TEXT} hover:underline decoration-dotted underline-offset-4`}
              onClick={() => setDraft(description)}
            >
              {description || <span className="text-(--tracking-dim)">{t.expectedEmpty}</span>}
            </button>
          ) : (
            <p className={TEXT}>
              <Shown description={description} onOpenFile={onOpenFile} />
            </p>
          )
        ) : (
          <div className="grid gap-2">
            <Textarea
              aria-label={t.expectedField}
              value={draft}
              autoFocus
              className="min-h-24"
              onChange={(e) => setDraft(e.target.value)}
            />
            {command.error && (
              <p role="alert" className="text-xs text-destructive">
                {command.error}
              </p>
            )}
            <div className="flex gap-2">
              <Button size="sm" disabled={command.busy} onClick={() => void save()}>
                {t.save}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                {t.cancel}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
