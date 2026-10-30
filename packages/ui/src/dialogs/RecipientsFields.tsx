import {
  KiboError,
  ME_RECIPIENT,
  openCountByRecipient,
  type ProjectCommand,
  type QuestionRecipient,
  RECIPIENTS_MAX,
} from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";
import { client } from "../api";
import { frProject } from "../i18n/fr-project";
import { useSnapshots } from "../state/use-snapshots";

const t = frProject.recipients;

type RowProps = {
  recipient: QuestionRecipient;
  open: number;
  busy: boolean;
  onRename(name: string): Promise<boolean>;
  onRemove(): void;
};

const onEnter = (action: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  action();
};

function RecipientRow({ recipient, open, busy, onRename, onRemove }: RowProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = async () => {
    const name = draft?.trim() ?? "";
    if (name === "" || name === recipient.name) return setDraft(null);
    if (await onRename(name)) setDraft(null);
  };
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <UserRound aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <div className="grid min-w-0 flex-1 gap-0.5">
        {draft === null ? (
          <span className="flex items-center gap-2 text-sm font-medium">
            <span className="truncate">{recipient.name}</span>
            {recipient.id === ME_RECIPIENT && (
              <Badge variant="outline" className="text-3xs font-normal">
                {t.byDefault}
              </Badge>
            )}
          </span>
        ) : (
          <Input
            aria-label={t.newName(recipient.name)}
            value={draft}
            maxLength={40}
            autoFocus
            className="h-7 text-sm"
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setDraft(null);
              } else onEnter(() => void commit())(e);
            }}
            onBlur={() => void commit()}
          />
        )}
        <span className="text-xs text-muted-foreground">{t.open(open)}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={t.rename(recipient.name)}
        disabled={busy}
        onClick={() => setDraft(recipient.name)}
      >
        <Pencil aria-hidden />
      </Button>
      {recipient.id !== ME_RECIPIENT && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          aria-label={t.remove(recipient.name)}
          disabled={busy}
          onClick={onRemove}
        >
          <Trash2 aria-hidden />
        </Button>
      )}
    </li>
  );
}

function failure(e: unknown, open: number): string {
  if (e instanceof KiboError && e.code === "CONFLICT") return t.inUse(open);
  if (e instanceof KiboError && e.code === "QUOTA_EXCEEDED") return t.quota;
  console.error(e);
  return t.failed;
}

export function RecipientsFields({ projectId }: { projectId: string }) {
  const titleId = useId();
  const addId = useId();
  const snapshot = useSnapshots([projectId]).get(projectId);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!snapshot) return null;
  const counts = openCountByRecipient(snapshot.questions);
  const recipients = snapshot.questionRecipients;
  const send = async (command: ProjectCommand, open = 0): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await client.rpc({ method: "command", projectId, command });
      return true;
    } catch (e) {
      setError(failure(e, open));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const add = async () => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    if (await send({ method: "addQuestionRecipient", name: trimmed })) setName("");
  };
  return (
    <section aria-labelledby={titleId} className="grid gap-2">
      <h3 id={titleId} className="text-sm font-medium">
        {t.title}
      </h3>
      <p className="text-xs text-muted-foreground">{t.help}</p>
      <ul aria-labelledby={titleId} className="divide-y rounded-md border">
        {recipients.map((r) => (
          <RecipientRow
            key={r.id}
            recipient={r}
            open={counts.get(r.id) ?? 0}
            busy={busy}
            onRename={(next) => send({ method: "renameQuestionRecipient", recipientId: r.id, name: next })}
            onRemove={() =>
              void send({ method: "removeQuestionRecipient", recipientId: r.id }, counts.get(r.id) ?? 0)
            }
          />
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          id={addId}
          aria-label={t.addLabel}
          placeholder={t.addPlaceholder}
          value={name}
          maxLength={40}
          className="h-8 text-sm"
          disabled={busy || recipients.length >= RECIPIENTS_MAX}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onEnter(() => void add())}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={busy || name.trim() === "" || recipients.length >= RECIPIENTS_MAX}
          onClick={() => void add()}
        >
          <Plus aria-hidden />
          {t.add}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
