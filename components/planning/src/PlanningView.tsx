import type { SprintView } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { BacklogColumn } from "./BacklogColumn";
import type { BandsTimeline } from "./bands-model";
import { cardEntries, type PlanTarget } from "./card-menu";
import { BACKLOG_ID } from "./drag";
import { FeatureCard } from "./FeatureCard";
import { fr } from "./fr";
import { type HeldHandlers, HeldSection } from "./HeldSection";
import { PlanningBands } from "./PlanningBands";
import { AddButton, PlanningHeader, type PlanningLayout } from "./PlanningHeader";
import type { FeatureCard as Card, PlanningModel } from "./planning-model";
import { SprintColumn, Warning } from "./SprintColumn";
import { TONE_BG, TONES } from "./tones";

function Legend({ error }: { error: string | null }) {
  return (
    <footer className="flex h-[14px] shrink-0 items-center gap-3.5 text-(--tracking-dim) text-[11.5px] leading-[14px]">
      {TONES.map((tone) => (
        <span key={tone} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("h-2 w-3 rounded-[2px]", TONE_BG[tone])} />
          {fr.legend[tone]}
        </span>
      ))}
      <span>{fr.legend.hint}</span>
      {error && (
        <span role="alert" className="ml-auto text-(--tracking-red)">
          {error}
        </span>
      )}
    </footer>
  );
}

function EmptyPlanning({ readOnly, onNewFeature }: { readOnly: boolean; onNewFeature(): void }) {
  return (
    <output
      aria-label={fr.empty.label}
      className="flex shrink-0 flex-wrap items-center gap-3 rounded-[10px] border border-(--tracking-border) border-dashed px-4 py-3 text-(--tracking-mfg) text-[12.5px] leading-[16px]"
    >
      <span className="min-w-0 flex-1 basis-64">{fr.empty.text}</span>
      {!readOnly && <AddButton label={fr.addFeature} title={fr.newFeature} onClick={onNewFeature} />}
    </output>
  );
}

export type PlanningViewProps = Omit<HeldHandlers, "onOpen"> & {
  model: PlanningModel;
  readOnly: boolean;
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
  const { model, readOnly, target, dragged, onOpen, onOpenSprint, onEditSprint } = props;
  const dropsIn = (columnId: string, own: string | null) =>
    dragged !== null && target === columnId && (own ?? BACKLOG_ID) !== columnId;
  const sprints = model.sprints.map((c) => c.sprint);
  const menuOf = (c: Card) => (readOnly ? [] : cardEntries(c, sprints, props.onPlan));
  const cards = (list: readonly Card[]) =>
    list.map((c) => (
      <FeatureCard key={c.id} card={c} readOnly={readOnly} menu={menuOf(c)} onOpen={() => onOpen(c.id)} />
    ));
  const holder = limitHolder(model);
  const limitNote = model.overLimit && (
    <Warning tone="amber">{fr.overLimit(model.open, model.limit)}</Warning>
  );
  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5 bg-(--tracking-bg) px-6 py-[18px] font-sans">
      <PlanningHeader
        model={model}
        readOnly={readOnly}
        layout={props.layout}
        onLayout={props.onLayout}
        onOpen={onOpen}
        onNewFeature={props.onNewFeature}
        onNewSprint={props.onNewSprint}
      />
      {model.total === 0 && <EmptyPlanning readOnly={readOnly} onNewFeature={props.onNewFeature} />}
      {props.bands ? (
        <PlanningBands timeline={props.bands} onOpen={onOpen} />
      ) : (
        <>
          <div className="scrollbar-none -my-px flex min-h-0 flex-1 items-stretch gap-3 overflow-x-auto py-px">
            <BacklogColumn
              dropping={dropsIn(BACKLOG_ID, dragged?.sprintId ?? null)}
              footer={holder === null && limitNote}
              held={
                <HeldSection
                  groups={model.held}
                  readOnly={readOnly}
                  onOpen={onOpen}
                  onResume={props.onResume}
                  onResumeIn={props.onResumeIn}
                />
              }
            >
              {cards(model.backlog)}
            </BacklogColumn>
            {model.sprints.map((column) => (
              <SprintColumn
                key={column.sprint.id}
                column={column}
                dropping={dropsIn(column.sprint.id, dragged?.sprintId ?? null)}
                onOpen={() => onOpenSprint(column.sprint)}
                onEdit={readOnly ? undefined : () => onEditSprint(column.sprint)}
                footer={column.sprint.id === holder && limitNote}
              >
                {cards(column.cards)}
              </SprintColumn>
            ))}
          </div>
          <Legend error={props.error} />
        </>
      )}
    </div>
  );
}
