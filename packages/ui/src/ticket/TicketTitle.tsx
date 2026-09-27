import { Input } from "@kibo/sdk/ui/input";
import { type KeyboardEvent, useState } from "react";
import { frTicketEdit as t } from "../i18n/fr-ticket-edit";

type Props = {
  title: string;
  editable: boolean;
  error: string | null;
  onSave(title: string): Promise<boolean>;
  onCancel(): void;
  className?: string;
};

export function TicketTitle({ title, editable, error, onSave, onCancel, className }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const stop = () => {
    setDraft(null);
    onCancel();
  };
  const save = async () => {
    if (draft === null) return;
    if (await onSave(draft.trim())) setDraft(null);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void save();
    if (e.key === "Escape") stop();
  };
  if (!editable) return <span className={className}>{title}</span>;
  if (draft === null)
    return (
      <button
        type="button"
        aria-label={t.editTitle}
        className={`text-left hover:underline decoration-dotted underline-offset-4 ${className ?? ""}`}
        onClick={() => setDraft(title)}
      >
        {title}
      </button>
    );
  return (
    <span className="grid gap-1">
      <Input
        aria-label={t.titleField}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => void save()}
      />
      <span className="text-xs text-muted-foreground">{t.titleHint}</span>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
