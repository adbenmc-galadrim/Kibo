import { type ComponentDraft, type DraftAttachmentInput, KiboError } from "@kibo/schema";
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
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { client } from "../api";
import { ApprovalScope, useApprovalScope } from "../dialogs/approval-scope";
import { fr } from "../i18n/fr";
import { frCreations } from "../i18n/fr-creations";
import { AiDraftPanel } from "./AiDraftPanel";
import { AttachmentsField } from "./AttachmentsField";
import { aiErrorMessage } from "./ai-error";
import { DemoAgentNote } from "./DemoAgentNote";
import { keepEscapeInReviseForm } from "./revise-escape";
import { useGeneratorAvailability } from "./use-demo-project";

export type ModifyTarget = { id: string; title: string; version: string; origin: "user" | "ai" };
export { modifiable } from "../components-page/rows";

type Props = {
  component: ModifyTarget | null;
  draftId?: string;
  projectId?: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

const activeDraftOf = (list: ComponentDraft[], componentId: string) =>
  list.find((d) => d.componentId === componentId && d.status !== "done" && d.status !== "abandoned") ?? null;

function useActiveDraft(componentId: string | null) {
  const [active, setActive] = useState<ComponentDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (componentId === null) return null;
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
  projectId: string | null;
  onStarted: (draftId: string) => void;
  onConflict: () => Promise<boolean>;
  onCancel: () => void;
};

function ModifyForm({ componentId, projectId, onStarted, onConflict, onCancel }: FormProps) {
  const id = useId();
  const { ready, block, demo } = useGeneratorAvailability(projectId);
  const requestRef = useRef<HTMLTextAreaElement>(null);
  const [request, setRequest] = useState("");
  const [attachments, setAttachments] = useState<DraftAttachmentInput[]>([]);
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
        draft: {
          mode: "modify",
          id: componentId,
          description: text,
          attachments,
          ...(projectId ? { projectId } : {}),
        },
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
        ref={requestRef}
        rows={4}
        maxLength={2000}
        value={request}
        onChange={(e) => setRequest(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">{fr.ai.modifyHelp}</p>
      <AttachmentsField
        value={attachments}
        onChange={setAttachments}
        disabled={busy}
        pasteFrom={requestRef}
      />
      {demo && <DemoAgentNote />}
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

export function ModifyWithAiDialog({
  component,
  draftId: initialDraftId,
  projectId = null,
  open,
  onOpenChange,
}: Props) {
  const [draftId, setDraftId] = useState<string | null>(initialDraftId ?? null);
  const { active, error, refresh } = useActiveDraft(initialDraftId || !component ? null : component.id);
  const scope = useApprovalScope();

  const body = () => {
    if (draftId) return <AiDraftPanel draftId={draftId} target={null} onDone={() => onOpenChange(false)} />;
    if (active) return <ResumeBox draft={active} onResume={() => setDraftId(active.id)} />;
    if (!component) return null;
    return (
      <ModifyForm
        componentId={component.id}
        projectId={projectId}
        onStarted={setDraftId}
        onConflict={async () => (await refresh()) !== null}
        onCancel={() => onOpenChange(false)}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hidden={scope.hidden}
        onEscapeKeyDown={keepEscapeInReviseForm}
        className={draftId ? "sm:max-w-3xl" : "sm:max-w-[520px]"}
      >
        <DialogHeader>
          <DialogTitle>
            {component ? fr.ai.modifyTitle(component.title) : frCreations.modify.title}
          </DialogTitle>
          <DialogDescription className={component ? undefined : "sr-only"}>
            {component
              ? fr.ai.modifySubtitle(component.version, fr.components.origin[component.origin])
              : frCreations.modify.title}
          </DialogDescription>
        </DialogHeader>
        {error && !draftId && <p className="text-xs text-destructive">{error}</p>}
        <ApprovalScope scope={scope}>{body()}</ApprovalScope>
      </DialogContent>
    </Dialog>
  );
}
