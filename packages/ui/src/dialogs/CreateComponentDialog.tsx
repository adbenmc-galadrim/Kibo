import type { FinalizeComponentDraftInput } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Copy, SquareTerminal } from "lucide-react";
import { useState } from "react";
import { AiDraftPanel } from "../ai/AiDraftPanel";
import { DescribeCard, ResumeDraftBanner } from "../ai/DescribeCard";
import { DraftStepper } from "../ai/DraftStepper";
import { fr } from "../i18n/fr";
import { ApprovalScope, useApprovalScope } from "./approval-scope";

const COMMANDS = [
  "kibo component new burndown",
  "kibo component test burndown",
  "kibo component dev burndown",
];

function CodeColumn() {
  const t = fr.createComponent;
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = async () => {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(COMMANDS.join("\n"));
      setCopied(true);
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
      {copied && <p className="text-xs text-muted-foreground">{t.copied}</p>}
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
};

export function CreateComponentDialog({ open, onOpenChange, target, onAdded }: Props) {
  const t = fr.createComponent;
  const [draftId, setDraftId] = useState<string | null>(null);
  const scope = useApprovalScope();
  const done = () => {
    setDraftId(null);
    onOpenChange(false);
    onAdded?.();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hidden={scope.hidden} className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription className={draftId ? "sr-only" : undefined}>{t.subtitle}</DialogDescription>
        </DialogHeader>
        {draftId ? (
          <ApprovalScope scope={scope}>
            <AiDraftPanel draftId={draftId} target={target} onDone={done} />
          </ApprovalScope>
        ) : (
          <>
            <ResumeDraftBanner onResume={setDraftId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <DescribeCard onStarted={(d) => setDraftId(d.id)} />
              <CodeColumn />
            </div>
            <DraftStepper current={1} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
