import type { SprintView } from "@kibo/schema";
import { BacklogColumn } from "./BacklogColumn";
import type { BandsTimeline } from "./bands-model";
import { cardEntries, type PlanTarget } from "./card-menu";
import { BACKLOG_ID } from "./drag";
import { FeatureCard } from "./FeatureCard";
import { fr } from "./fr";
import { HeldBand, type HeldHandlers } from "./HeldBand";
import { PlanningBands } from "./PlanningBands";
import { AddButton, PlanningHeader, type PlanningLayout } from "./PlanningHeader";
import type { FeatureCard as Card, PlanningModel } from "./planning-model";
import { SprintColumn, Warning } from "./SprintColumn";

function PlanningError({ error }: { error: string }) {
  return (
    <footer className="flex h-5 shrink-0 items-center text-[11.5px] leading-[14px]">
      <span role="alert" className="ml-auto text-(--tracking-red)">
        {error}
      </span>
    </footer>
  );
}

function EmptyPlanning({ onNewFeature }: { onNewFeature(): void }) {
  return (
    <output
      aria-label={fr.empty.label}
      className="flex shrink-0 flex-wrap items-center gap-3 rounded-[10px] border border-(--tracking-border) border-dashed px-4 py-3 text-(--tracking-mfg) text-[12.5px] leading-[16px]"
    >
      <span className="min-w-0 flex-1 basis-64">{fr.empty.text}</span>
      <AddButton label={fr.addFeature} title={fr.newFeature} onClick={onNewFeature} />
    </output>
  );
}

type PlanningViewProps = Omit<HeldHandlers, "onOpen"> & {
  model: PlanningModel;
  projectId: string;
  target: string | null;
  dragged: Card | null;
  error: string | null;
  layout: PlanningLayout;
  bands: BandsTimeline | null;
  onLayout(layout: PlanningLayout): void;
  onOpen(id: string): void;
  onOpenSprint(sprint: SprintView): void;
  onEditSprint(sprint: SprintView): void;
  onNewFeature(): void;
  onNewSprint(): void;
  onPlan(target: PlanTarget): void;
};

const limitHolder = (model: PlanningModel): string | null =>
  model.currentSprintId ?? model.sprints[0]?.sprint.id ?? null;

export function PlanningView(props: PlanningViewProps) {
  const { model, target, dragged, onOpen, onOpenSprint, onEditSprint } = props;
  const dropsIn = (columnId: string, own: string | null) =>
    dragged !== null && target === columnId && (own ?? BACKLOG_ID) !== columnId;
  const sprints = model.sprints.map((c) => c.sprint);
  const menuOf = (c: Card) => cardEntries(c, sprints, props.onPlan);
  const cards = (list: readonly Card[]) =>
    list.map((c) => <FeatureCard key={c.id} card={c} menu={menuOf(c)} onOpen={() => onOpen(c.id)} />);
  const holder = limitHolder(model);
  const limit = model.overLimit ? fr.overLimit(model.open, model.limit) : null;
  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5 bg-(--tracking-bg) px-6 py-[18px] font-sans">
      <PlanningHeader
        model={model}
        layout={props.layout}
        onLayout={props.onLayout}
        onOpen={onOpen}
        onNewFeature={props.onNewFeature}
        onNewSprint={props.onNewSprint}
      />
      {model.total === 0 && <EmptyPlanning onNewFeature={props.onNewFeature} />}
      {props.bands ? (
        <PlanningBands timeline={props.bands} onOpen={onOpen} />
      ) : (
        <>
          <HeldBand
            projectId={props.projectId}
            groups={model.held}
            onOpen={onOpen}
            onResume={props.onResume}
            onResumeIn={props.onResumeIn}
          />
          <div className="scrollbar-none -my-px flex min-h-0 flex-1 items-stretch gap-3 overflow-x-auto py-px">
            <BacklogColumn
              dropping={dropsIn(BACKLOG_ID, dragged?.sprintId ?? null)}
              empty={model.backlog.length === 0}
              footer={holder === null && limit !== null && <Warning>{limit}</Warning>}
            >
              {cards(model.backlog)}
            </BacklogColumn>
            {model.sprints.map((column) => (
              <SprintColumn
                key={column.sprint.id}
                column={column}
                dropping={dropsIn(column.sprint.id, dragged?.sprintId ?? null)}
                onOpen={() => onOpenSprint(column.sprint)}
                onEdit={() => onEditSprint(column.sprint)}
                limit={column.sprint.id === holder ? limit : null}
              >
                {cards(column.cards)}
              </SprintColumn>
            ))}
          </div>
          {props.error && <PlanningError error={props.error} />}
        </>
      )}
    </div>
  );
}
