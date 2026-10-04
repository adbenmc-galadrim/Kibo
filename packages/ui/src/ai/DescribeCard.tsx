import { type ComponentDraft, type DraftAttachmentInput, DraftComponentId, KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { Bot, Sparkles } from "lucide-react";
import { type FormEvent, useId, useRef, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { AttachmentsField } from "./AttachmentsField";
import { aiErrorMessage } from "./ai-error";
import { type DescribeEdits, DescribeFields, initialEdits } from "./DescribeFields";
import { formatProblem } from "./FormatsField";
import { slugify, suggestTitle } from "./slug";
import { useAiAvailability } from "./use-ai-availability";

const MIN = 20;
const MAX = 2000;

export function DescribeCard({ onStarted }: { onStarted: (draft: ComponentDraft) => void }) {
  const id = useId();
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const { ready, block } = useAiAvailability("generateur");
  const [description, setDescription] = useState("");
  const [edits, setEdits] = useState<DescribeEdits>(initialEdits);
  const [attachments, setAttachments] = useState<DraftAttachmentInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const effectiveTitle = edits.title ?? suggestTitle(description);
  const effectiveId = edits.componentId ?? slugify(effectiveTitle);
  const length = description.trim().length;
  const idValid = DraftComponentId.safeParse(effectiveId).success;
  const valid =
    length >= MIN &&
    length <= MAX &&
    effectiveTitle.trim().length > 0 &&
    idValid &&
    formatProblem(edits.kind, edits.formats) === null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onStarted(
        await client.rpc({
          method: "startComponentDraft",
          draft: {
            mode: "create",
            id: effectiveId,
            title: effectiveTitle.trim(),
            kind: edits.kind,
            withServer: edits.withServer,
            description: description.trim(),
            formats: edits.formats,
            template: "blank",
            attachments,
          },
        }),
      );
    } catch (err) {
      setError(
        err instanceof KiboError && err.code === "CONFLICT" ? fr.ai.create.idTaken : aiErrorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid content-start gap-3 rounded-lg border border-foreground/70 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles aria-hidden className="size-4" /> {fr.ai.create.column}
      </h3>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-desc`}>{fr.ai.create.describe}</Label>
        <Textarea
          id={`${id}-desc`}
          ref={descriptionRef}
          rows={3}
          maxLength={MAX}
          placeholder={fr.createComponent.aiPlaceholder}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <p className="text-right font-mono text-[11px] text-muted-foreground">{fr.ai.create.count(length)}</p>
      </div>
      <DescribeFields
        id={id}
        described={length > 0}
        edits={edits}
        title={effectiveTitle}
        componentId={effectiveId}
        idValid={idValid}
        onChange={(patch) => setEdits((current) => ({ ...current, ...patch }))}
      />
      <AttachmentsField
        value={attachments}
        onChange={setAttachments}
        disabled={busy}
        pasteFrom={descriptionRef}
      />
      <p className="text-xs text-muted-foreground">{fr.ai.create.describeHelp}</p>
      {length > 0 && length < MIN && <p className="text-xs text-muted-foreground">{fr.ai.create.tooShort}</p>}
      {block && <p className="text-xs text-amber-600 dark:text-amber-400">{fr.ai.blocked[block]}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        variant="agent"
        className="justify-self-start"
        disabled={!ready || block !== null || !valid || busy}
      >
        <Bot className="size-4" /> {fr.ai.create.generate}
      </Button>
    </form>
  );
}
