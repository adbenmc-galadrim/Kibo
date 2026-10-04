import { type TabTarget, TUTORIAL_STEPS, type TutorialState } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { GraduationCap } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { frTutorial as t } from "../i18n/fr-tutorial";
import { useTutorial } from "./use-tutorial";

type Props = { open: boolean; onClose(): void; onOpen(target: TabTarget): void };
type Action = "start" | "resume" | "restart";

export function offerAction(state: TutorialState | null): Action {
  if (state?.status === "paused" || state?.status === "active") return "resume";
  if (state?.status === "done" || state?.status === "skipped") return "restart";
  return "start";
}

async function run(action: Action): Promise<TutorialState> {
  if (action === "restart") await client.rpc({ method: "resetTutorial" });
  return client.rpc({ method: "startTutorial" });
}

export function TutorialOffer({ open, onClose, onOpen }: Props) {
  const { state } = useTutorial();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const action = offerAction(state);

  const go = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const next = await run(action);
      onClose();
      if (next.projectId) onOpen({ kind: "project", projectId: next.projectId });
    } catch (e) {
      console.error("tutorial start failed", e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap aria-hidden className="size-4" />
            {t.offer.title}
          </DialogTitle>
          <DialogDescription>{t.offer.text}</DialogDescription>
        </DialogHeader>
        <ol className="grid list-decimal gap-1 pl-5 text-sm">
          {TUTORIAL_STEPS.map((step) => (
            <li key={step}>{t.steps[step].title}</li>
          ))}
        </ol>
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {t.failed}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.offer.later}
          </Button>
          <Button type="button" disabled={busy || state === null} onClick={() => void go()}>
            {t.offer[action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
