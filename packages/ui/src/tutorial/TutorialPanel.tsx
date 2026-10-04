import type { Page, RpcRequest, TabTarget, TutorialState } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Check, ChevronDown, ChevronUp, GraduationCap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { client } from "../api";
import { frTutorial as t } from "../i18n/fr-tutorial";
import { type StepView, stepViews } from "./tutorial-steps";

type Props = {
  state: TutorialState;
  pages: readonly Page[];
  activeTarget: TabTarget | null;
  onOpen(target: TabTarget): void;
  onDeleteDemo(projectId: string): void;
  onClose(): void;
};

const onGraph = (state: TutorialState, target: TabTarget | null): boolean =>
  target?.kind === "page" &&
  target.projectId === state.projectId &&
  target.pageId === state.seed?.graphPageId &&
  !state.seenViews.includes("graph");

function useGraphSeen(state: TutorialState, target: TabTarget | null) {
  const sent = useRef(false);
  const due = onGraph(state, target);
  useEffect(() => {
    if (!due || sent.current) return;
    sent.current = true;
    client.rpc({ method: "markTutorialSeen", view: "graph" }).catch((e: unknown) => {
      sent.current = false;
      console.error("markTutorialSeen failed", e);
    });
  }, [due]);
}

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

type BodyProps = { step: StepView; send(req: RpcRequest): void; onOpen(target: TabTarget): void };

function CurrentStep({ step, send, onOpen }: BodyProps) {
  const where = step.where;
  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <h3 className="text-sm font-medium">{step.title}</h3>
        <p className="text-xs text-muted-foreground">{step.instruction}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {where && (
          <Button size="sm" onClick={() => onOpen(where)}>
            {t.goTo}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => send({ method: "skipTutorialStep", step: step.step })}
        >
          {t.skipStep}
        </Button>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
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

export function TutorialPanel({ state, pages, activeTarget, onOpen, onDeleteDemo, onClose }: Props) {
  const [open, setOpen] = useState(true);
  const [failed, setFailed] = useState(false);
  useGraphSeen(state, activeTarget);
  const projectId = state.projectId ?? "";
  const views = stepViews(state, projectId, pages);
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
          {t.progress(state.completed.length, views.length)}
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
      {open && current && <CurrentStep step={current} send={send} onOpen={onOpen} />}
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
