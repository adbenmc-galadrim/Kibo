import type { DraftStatus, FinalizeComponentDraftInput } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Copy, SquareTerminal } from "lucide-react";
import { useEffect, useState } from "react";
import { ActiveDraftsBanner } from "../ai/ActiveDraftsBanner";
import { AiDraftPanel } from "../ai/AiDraftPanel";
import { ContinueInBackground } from "../ai/ContinueInBackground";
import { DescribeCard } from "../ai/DescribeCard";
import { DraftStepper } from "../ai/DraftStepper";
import { keepEscapeInReviseForm } from "../ai/revise-escape";
import { fr } from "../i18n/fr";
import { useFlash } from "../lib/use-flash";
import { ApprovalScope, useApprovalScope } from "./approval-scope";

const COPIED_MS = 2_000;
const COMMANDS = [
  "kibo component new burndown",
  "kibo component test burndown",
  "kibo component dev burndown",
];

function CodeColumn() {
  const t = fr.createComponent;
  const copied = useFlash(COPIED_MS);
  const [failed, setFailed] = useState(false);
  const copy = async () => {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(COMMANDS.join("\n"));
      copied.flash(t.copied);
    } catch (e) {
      console.error(e);
      setFailed(true);
    }
  };
  return (
    <section className="grid content-start gap-3 rounded-lg border p-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <SquareTerminal aria-hidden className="size-4" />
        {t.code}
      </h3>
      <p className="text-sm text-muted-foreground">{t.codeHelp}</p>
      <div className="relative rounded-md border bg-muted/40 p-3 pr-10 font-mono text-xs">
        {COMMANDS.map((c) => (
          <div key={c}>$ {c}</div>
        ))}
        <Button
          size="icon"
          variant="ghost"
          aria-label={t.copy}
          className="absolute top-1.5 right-1.5 size-7"
          onClick={() => void copy()}
        >
          <Copy aria-hidden />
        </Button>
      </div>
      {copied.message && <p className="text-xs text-muted-foreground">{copied.message}</p>}
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {fr.common.error}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{t.codeFooter}</p>
    </section>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: FinalizeComponentDraftInput["target"];
  onAdded?: () => void;
  draftId?: string;
  onOpenCreations?: () => void;
};

export function CreateComponentDialog({
  open,
  onOpenChange,
  target,
  onAdded,
  draftId,
  onOpenCreations,
}: Props) {
  const t = fr.createComponent;
  const [current, setCurrent] = useState<string | null>(draftId ?? null);
  const [reported, setReported] = useState<{ draftId: string; status: DraftStatus } | null>(null);
  const scope = useApprovalScope();
  useEffect(() => {
    if (open) setCurrent(draftId ?? null);
  }, [open, draftId]);
  const done = () => {
    setCurrent(null);
    onOpenChange(false);
    onAdded?.();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hidden={scope.hidden}
        onEscapeKeyDown={keepEscapeInReviseForm}
        className="sm:max-w-3xl [&>[data-slot=dialog-close]]:z-20"
      >
        <DialogHeader className="sticky -top-6 z-10 -mx-6 -mt-6 bg-background px-6 pt-6 pb-2">
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription className={current ? "sr-only" : undefined}>{t.subtitle}</DialogDescription>
        </DialogHeader>
        {current ? (
          <>
            <ApprovalScope scope={scope}>
              <AiDraftPanel
                key={current}
                draftId={current}
                target={target}
                onDone={done}
                onStatus={(status) => setReported({ draftId: current, status })}
              />
            </ApprovalScope>
            <ContinueInBackground
              status={reported?.draftId === current ? reported.status : null}
              onContinue={() => onOpenChange(false)}
            />
          </>
        ) : (
          <>
            <ActiveDraftsBanner onResume={setCurrent} onOpenCreations={onOpenCreations} />
            <div className="grid gap-4 sm:grid-cols-2">
              <DescribeCard onStarted={(d) => setCurrent(d.id)} />
              <CodeColumn />
            </div>
            <DraftStepper current={1} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
