import { type ComponentDraft, DraftComponentId, type DraftKind, KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { Bot, Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { aiErrorMessage } from "./ai-error";
import { slugify, suggestTitle } from "./slug";
import { useAiAvailability } from "./use-ai-availability";

const MIN = 20;
const MAX = 2000;

export function DescribeCard({ onStarted }: { onStarted: (draft: ComponentDraft) => void }) {
  const id = useId();
  const { ready, block } = useAiAvailability("generateur");
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState<string | null>(null);
  const [componentId, setComponentId] = useState<string | null>(null);
  const [kind, setKind] = useState<DraftKind>("widget");
  const [withServer, setWithServer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const effectiveTitle = title ?? suggestTitle(description);
  const effectiveId = componentId ?? slugify(effectiveTitle);
  const length = description.trim().length;
  const idValid = DraftComponentId.safeParse(effectiveId).success;
  const valid = length >= MIN && length <= MAX && effectiveTitle.trim().length > 0 && idValid;

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
            kind,
            withServer,
            description: description.trim(),
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
          rows={3}
          maxLength={MAX}
          placeholder={fr.createComponent.aiPlaceholder}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <p className="text-right font-mono text-[11px] text-muted-foreground">{fr.ai.create.count(length)}</p>
      </div>
      {length > 0 && (
        <div className="grid grid-cols-2 items-end gap-2">
          <div className="col-span-2 grid gap-1">
            <Label htmlFor={`${id}-title`} className="text-xs">
              {fr.ai.create.titleLabel}
            </Label>
            <Input
              id={`${id}-title`}
              maxLength={60}
              value={effectiveTitle}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="col-span-2 grid gap-1">
            <Label htmlFor={`${id}-id`} className="text-xs">
              {fr.ai.create.idLabel}
            </Label>
            <Input
              id={`${id}-id`}
              className="font-mono"
              maxLength={40}
              aria-invalid={!idValid}
              aria-describedby={idValid ? undefined : `${id}-id-help`}
              value={effectiveId}
              onChange={(e) => setComponentId(e.target.value.toLowerCase())}
            />
            {!idValid && (
              <p id={`${id}-id-help`} className="text-xs text-destructive">
                {fr.ai.create.idInvalid}
              </p>
            )}
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`${id}-kind`} className="text-xs">
              {fr.ai.create.kindLabel}
            </Label>
            <Select value={kind} onValueChange={(v) => setKind(v === "view" || v === "both" ? v : "widget")}>
              <SelectTrigger id={`${id}-kind`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["widget", "view", "both"] as const).map((k) => (
                  <SelectItem key={k} value={k}>
                    {fr.ai.create.kinds[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label htmlFor={`${id}-server`} className="flex h-9 items-center gap-2 text-xs">
            <Checkbox
              id={`${id}-server`}
              checked={withServer}
              onCheckedChange={(v) => setWithServer(v === true)}
            />
            {fr.ai.create.withServer}
          </label>
        </div>
      )}
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

export function ResumeDraftBanner({ onResume }: { onResume: (draftId: string) => void }) {
  const [draft, setDraft] = useState<ComponentDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    client.rpc({ method: "listComponentDrafts" }).then(
      (list) => alive && setDraft(list.find((d) => d.status !== "done" && d.status !== "abandoned") ?? null),
      (e: unknown) => alive && setError(aiErrorMessage(e)),
    );
    return () => {
      alive = false;
    };
  }, []);
  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!draft) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
      <span>{fr.ai.create.resume(draft.title)}</span>
      <Button size="sm" variant="outline" onClick={() => onResume(draft.id)}>
        {fr.ai.create.resumeAction}
      </Button>
    </div>
  );
}
