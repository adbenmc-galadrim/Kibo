import { deliveryBrief, type RpcRequest, type TabTarget, type TutorialState } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Check, ChevronDown, ChevronUp, Copy, GraduationCap } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { frTutorial as t } from "../i18n/fr-tutorial";
import { type StepView, stepViews } from "./tutorial-steps";

type Props = {
  state: TutorialState;
  copyKey: string | null;
  activeTarget: TabTarget | null;
  onOpen(target: TabTarget): void;
  onDeleteDemo(projectId: string): void;
  onClose(): void;
};

const dotLabel = (v: StepView): string => {
  if (v.done) return `${v.title} · ${t.stepDone}`;
  return v.current ? `${v.title} · ${t.stepCurrent}` : v.title;
};

function Dots({ views }: { views: StepView[] }) {
  return (
    <ol className="flex gap-1.5">
      {views.map((v) => (
        <li
          key={v.step}
          aria-label={dotLabel(v)}
          className={cn(
            "grid size-4 place-items-center rounded-full border border-muted-foreground/40",
            v.done && "border-foreground bg-foreground text-background",
            v.current && "border-foreground",
          )}
        >
          {v.done && <Check aria-hidden className="size-3" />}
        </li>
      ))}
    </ol>
  );
}

const samePage = (a: TabTarget | null, b: TabTarget | null): boolean =>
  a?.kind === "page" && b?.kind === "page" && a.projectId === b.projectId && a.pageId === b.pageId;

type ActionProps = { step: StepView; projectId: string; copyKey: string | null; send(req: RpcRequest): void };

function StepAction({ step, projectId, copyKey, send }: ActionProps) {
  const [copyFailed, setCopyFailed] = useState(false);
  if (step.step === "overview")
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => send({ method: "markTutorialSeen", view: "overview" })}
      >
        {t.read}
      </Button>
    );
  if (step.step === "review")
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => send({ method: "simulateTutorialReview", projectId })}
      >
        {t.simulateReview}
      </Button>
    );
  if (step.step !== "copy" || copyKey === null) return null;
  const command = deliveryBrief(copyKey);
  const copy = async () => {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(command);
      send({ method: "markTutorialSeen", view: "copy" });
    } catch (e) {
      console.warn("tutorial copy refused", e);
      setCopyFailed(true);
    }
  };
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => void copy()}>
        <Copy aria-hidden /> {t.copy(command)}
      </Button>
      {copyFailed && (
        <p role="alert" className="basis-full text-xs text-destructive">
          {t.copyFailed}
        </p>
      )}
    </>
  );
}

type BodyProps = ActionProps & { activeTarget: TabTarget | null; onOpen(target: TabTarget): void };

function CurrentStep({ step, activeTarget, send, onOpen, ...action }: BodyProps) {
  const where = step.where;
  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <h3 className="text-sm font-medium">{step.title}</h3>
        <p className="text-xs text-muted-foreground">{step.instruction}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {where && !samePage(where, activeTarget) && (
          <Button size="sm" onClick={() => onOpen(where)}>
            {t.goTo}
          </Button>
        )}
        <StepAction step={step} send={send} {...action} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <Button
          size="sm"
          variant="link"
          className="h-auto px-0"
          onClick={() => send({ method: "skipTutorialStep", step: step.step })}
        >
          {t.skipStep}
        </Button>
        <Button
          size="sm"
          variant="link"
          className="h-auto px-0"
          onClick={() => send({ method: "pauseTutorial" })}
        >
          {t.pause}
        </Button>
        <Button
          size="sm"
          variant="link"
          className="h-auto px-0"
          onClick={() => send({ method: "skipTutorial" })}
        >
          {t.stop}
        </Button>
      </div>
    </div>
  );
}

function Finished({ onDelete, onClose }: { onDelete(): void; onClose(): void }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <h3 className="text-sm font-medium">{t.doneTitle}</h3>
        <p className="text-xs text-muted-foreground">{t.doneText}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="destructive" onClick={onDelete}>
          {t.deleteDemo}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          {t.close}
        </Button>
      </div>
    </div>
  );
}

export function TutorialPanel({ state, copyKey, activeTarget, onOpen, onDeleteDemo, onClose }: Props) {
  const [open, setOpen] = useState(true);
  const [failed, setFailed] = useState(false);
  const projectId = state.projectId ?? "";
  const views = stepViews(state, projectId);
  const current = views.find((v) => v.current) ?? null;
  const send = (req: RpcRequest) => {
    setFailed(false);
    client.rpc(req).catch((e: unknown) => {
      console.error("tutorial action failed", e);
      setFailed(true);
    });
  };
  return (
    <aside
      aria-label={t.panel}
      className="fixed right-4 bottom-14 z-40 grid w-80 gap-3 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg"
    >
      <header className="flex items-center gap-2">
        <GraduationCap aria-hidden className="size-4" />
        <span className="flex-1 text-sm font-semibold">{t.panel}</span>
        <span className="text-xs text-muted-foreground">
          {t.progress(views.filter((v) => v.done).length, views.length)}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label={open ? t.collapse : t.expand}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />}
        </Button>
      </header>
      <Dots views={views} />
      {open && current && (
        <CurrentStep
          step={current}
          projectId={projectId}
          copyKey={copyKey}
          activeTarget={activeTarget}
          send={send}
          onOpen={onOpen}
        />
      )}
      {open && state.status === "done" && (
        <Finished onDelete={() => onDeleteDemo(projectId)} onClose={onClose} />
      )}
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t.failed}
        </p>
      )}
    </aside>
  );
}
