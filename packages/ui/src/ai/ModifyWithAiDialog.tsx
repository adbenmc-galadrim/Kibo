import { type ComponentDraft, KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { Bot } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { AiDraftPanel } from "./AiDraftPanel";
import { aiErrorMessage } from "./ai-error";
import { useAiAvailability } from "./use-ai-availability";

export type ModifyTarget = { id: string; title: string; version: string; origin: "user" | "ai" };
export { modifiable } from "../components-page/rows";

type Props = {
  component: ModifyTarget;
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

const activeDraftOf = (list: ComponentDraft[], componentId: string) =>
  list.find((d) => d.componentId === componentId && d.status !== "done" && d.status !== "abandoned") ?? null;

function useActiveDraft(componentId: string) {
  const [active, setActive] = useState<ComponentDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const found = activeDraftOf(await client.rpc({ method: "listComponentDrafts" }), componentId);
      setActive(found);
      return found;
    } catch (e) {
      setError(aiErrorMessage(e));
      return null;
    }
  }, [componentId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { active, error, refresh };
}

function ResumeBox({ draft, onResume }: { draft: ComponentDraft; onResume: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
      <span>{fr.ai.create.resume(draft.title)}</span>
      <Button size="sm" variant="outline" onClick={onResume}>
        {fr.ai.create.resumeAction}
      </Button>
    </div>
  );
}

type FormProps = {
  componentId: string;
  onStarted: (draftId: string) => void;
  onConflict: () => Promise<boolean>;
  onCancel: () => void;
};

function ModifyForm({ componentId, onStarted, onConflict, onCancel }: FormProps) {
  const id = useId();
  const { ready, block } = useAiAvailability("generateur");
  const [request, setRequest] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const text = request.trim();
  const valid = text.length >= 5 && text.length <= 2000;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const draft = await client.rpc({
        method: "startComponentDraft",
        draft: { mode: "modify", id: componentId, description: text },
      });
      onStarted(draft.id);
    } catch (err) {
      const conflict = err instanceof KiboError && err.code === "CONFLICT";
      if (!conflict) setError(aiErrorMessage(err));
      else if (!(await onConflict())) setError(fr.ai.modifyBusy);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3">
      <Label htmlFor={`${id}-request`}>{fr.ai.modifyField}</Label>
      <Textarea
        id={`${id}-request`}
        rows={4}
        maxLength={2000}
        value={request}
        onChange={(e) => setRequest(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">{fr.ai.modifyHelp}</p>
      {block && <p className="text-xs text-amber-600 dark:text-amber-400">{fr.ai.blocked[block]}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {fr.common.cancel}
        </Button>
        <Button type="submit" variant="agent" disabled={!ready || block !== null || !valid || busy}>
          <Bot className="size-4" /> {fr.ai.launch}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ModifyWithAiDialog({ component, open, onOpenChange }: Props) {
  const [draftId, setDraftId] = useState<string | null>(null);
  const { active, error, refresh } = useActiveDraft(component.id);

  const body = () => {
    if (draftId) return <AiDraftPanel draftId={draftId} target={null} onDone={() => onOpenChange(false)} />;
    if (active) return <ResumeBox draft={active} onResume={() => setDraftId(active.id)} />;
    return (
      <ModifyForm
        componentId={component.id}
        onStarted={setDraftId}
        onConflict={async () => (await refresh()) !== null}
        onCancel={() => onOpenChange(false)}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={draftId ? "sm:max-w-3xl" : "sm:max-w-[520px]"}>
        <DialogHeader>
          <DialogTitle>{fr.ai.modifyTitle(component.title)}</DialogTitle>
          <DialogDescription>
            {fr.ai.modifySubtitle(component.version, fr.components.origin[component.origin])}
          </DialogDescription>
        </DialogHeader>
        {error && !draftId && <p className="text-xs text-destructive">{error}</p>}
        {body()}
      </DialogContent>
    </Dialog>
  );
}
