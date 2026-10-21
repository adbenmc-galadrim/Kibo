import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { openLimitOf, type SprintView } from "@kibo/schema";
import { type EntityMap, useEntities, useReadOnly, useSdk } from "@kibo/sdk";
import { useComponentSettings } from "@kibo/sdk/hooks/use-component-settings";
import { useProject } from "@kibo/sdk/hooks/use-project";
import { useState } from "react";
import { bandsTimeline } from "./bands-model";
import { DragPreview } from "./DragPreview";
import { BACKLOG_ID, planDrop } from "./drag";
import { FeatureCardPreview } from "./FeatureCard";
import { fr } from "./fr";
import type { HeldStep } from "./held-model";
import { NewFeatureDialog } from "./NewFeatureDialog";
import type { PlanningLayout } from "./PlanningHeader";
import { PlanningView } from "./PlanningView";
import { type FeatureCard, planningModel } from "./planning-model";
import { SprintDialog } from "./SprintDialog";
import { sprintLabel } from "./sprint-label";
import { useNewFeatureIntent } from "./use-new-feature-intent";

const COLUMN_STEP = 226;

export const columnSteps: KeyboardCoordinateGetter = (event, { currentCoordinates }) => {
  const shift: Record<string, number> = { ArrowRight: COLUMN_STEP, ArrowLeft: -COLUMN_STEP };
  const dx = shift[event.code];
  if (dx === undefined) return undefined;
  event.preventDefault();
  return { x: currentCoordinates.x + dx, y: currentCoordinates.y };
};

const initialLayout = (config: Record<string, unknown>): PlanningLayout =>
  config.layout === "bands" ? "bands" : "columns";

type Dialog = { kind: "sprint"; sprint: SprintView | null } | { kind: "feature" } | null;

type PlanningData = {
  tickets: EntityMap["ticket"][];
  links: EntityMap["link"][];
  sprints: EntityMap["sprint"][];
  questions: EntityMap["question"][];
  events: EntityMap["project_event"][];
};

function usePlanningData(): PlanningData | null {
  const tickets = useEntities("ticket");
  const links = useEntities("link");
  const sprints = useEntities("sprint");
  const questions = useEntities("question");
  const events = useEntities("project_event");
  if ([tickets, links, sprints, questions, events].some((list) => list.loading)) return null;
  return {
    tickets: tickets.data,
    links: links.data,
    sprints: sprints.data,
    questions: questions.data,
    events: events.data,
  };
}

export function Planning() {
  const today = useProject()?.today;
  const data = usePlanningData();
  return today === undefined || data === null ? null : <PlanningBoard today={today} data={data} />;
}

function PlanningBoard({ today, data }: { today: string; data: PlanningData }) {
  const sdk = useSdk();
  const readOnly = useReadOnly();
  const { tickets, links, sprints, questions, events } = data;
  const { tracking } = useComponentSettings();
  const model = planningModel({
    tickets,
    links,
    sprints,
    questions,
    events,
    today,
    openLimit: openLimitOf(tracking),
  });
  const cards = [...model.sprints.flatMap((c) => c.cards), ...model.backlog];
  const [dragged, setDragged] = useState<FeatureCard | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  useNewFeatureIntent(readOnly, () => setDialog({ kind: "feature" }));
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<PlanningLayout>(() => initialLayout(sdk.config));
  const chooseLayout = (next: PlanningLayout) => {
    setLayout(next);
    void sdk.setConfig({ layout: next });
  };
  const bands =
    layout === "bands"
      ? bandsTimeline({
          tickets,
          links,
          sprints,
          questions,
          events,
          today,
          backlog: fr.backlog,
          slipped: fr.slipped,
        })
      : null;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnSteps }),
  );
  const cardOf = (id: string | number) => cards.find((c) => c.id === String(id));
  const labelOf = (id: string | number): string => {
    if (id === BACKLOG_ID) return fr.backlog;
    const s = sprints.find((x) => x.id === id);
    return s ? sprintLabel(s) : (cardOf(id)?.shortKey ?? "");
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => fr.drag.picked(labelOf(active.id)),
    onDragOver: ({ active, over }) =>
      over ? fr.drag.over(labelOf(active.id), labelOf(over.id)) : fr.drag.outside(labelOf(active.id)),
    onDragEnd: ({ active, over }) =>
      over ? fr.drag.dropped(labelOf(active.id), labelOf(over.id)) : fr.drag.cancelled(labelOf(active.id)),
    onDragCancel: ({ active }) => fr.drag.cancelled(labelOf(active.id)),
  };
  const stop = () => {
    setDragged(null);
    setTarget(null);
  };
  const plan = (ticketId: string, sprintId: string | null) =>
    sdk.sprints.assign(ticketId, sprintId).then(
      () => setError(null),
      () => setError(fr.moveFailed(cardOf(ticketId)?.shortKey ?? "")),
    );
  const resume = (step: HeldStep): Promise<boolean> =>
    sdk.run({ method: "setHold", ticketId: step.ticketId, reason: null }).then(
      () => {
        setError(null);
        sdk.toast(fr.held.resumed(step.key));
        return true;
      },
      () => {
        setError(fr.held.failed(step.key));
        return false;
      },
    );
  const resumeIn = async (step: HeldStep, sprintId: string) => {
    if (await resume(step)) await plan(step.featureId, sprintId);
  };
  const onDragEnd = (e: DragEndEvent) => {
    stop();
    const drop = planDrop({
      activeId: String(e.active.id),
      overId: e.over ? String(e.over.id) : null,
      cards,
    });
    if (readOnly || drop === null) return;
    void plan(drop.ticketId, drop.sprintId);
  };
  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setDragged(cardOf(e.active.id) ?? null)}
      onDragOver={(e) => setTarget(e.over ? String(e.over.id) : null)}
      onDragCancel={stop}
      onDragEnd={onDragEnd}
      accessibility={{ screenReaderInstructions: { draggable: fr.drag.help }, announcements }}
    >
      <PlanningView
        model={model}
        readOnly={readOnly}
        target={target}
        dragged={dragged}
        error={error}
        layout={layout}
        bands={bands}
        onLayout={chooseLayout}
        onOpen={(id) => sdk.openTicket(id)}
        onOpenSprint={(sprint) => sdk.sprints.open(sprint.id)}
        onEditSprint={(sprint) => setDialog({ kind: "sprint", sprint })}
        onNewFeature={() => setDialog({ kind: "feature" })}
        onNewSprint={() => setDialog({ kind: "sprint", sprint: null })}
        onPlan={(target) => plan(target.cardId, target.sprintId)}
        onResume={(step) => void resume(step)}
        onResumeIn={(step, sprintId) => void resumeIn(step, sprintId)}
      />
      <DragPreview>{dragged ? <FeatureCardPreview card={dragged} /> : null}</DragPreview>
      {dialog?.kind === "sprint" && (
        <SprintDialog
          sprint={dialog.sprint}
          sprints={sprints}
          today={today}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "feature" && (
        <NewFeatureDialog sprints={sprints} today={today} onClose={() => setDialog(null)} />
      )}
    </DndContext>
  );
}
