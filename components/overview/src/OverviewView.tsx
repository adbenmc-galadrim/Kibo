import type { ProjectInfo } from "@kibo/sdk";
import { ActivityCard } from "./ActivityCard";
import type { ActivityInput } from "./activity-model";
import { CurrentSprintCard } from "./CurrentSprintCard";
import { DeadlinesCard } from "./DeadlinesCard";
import { GettingStarted } from "./GettingStarted";
import type { GettingStartedModel } from "./getting-started-model";
import { HeldCard } from "./HeldCard";
import { Indicators } from "./Indicators";
import { InReviewCard } from "./InReviewCard";
import { LateCard } from "./LateCard";
import { type NextActions, NextFeatureCard } from "./NextFeatureCard";
import { NowCard } from "./NowCard";
import type { OverviewModel } from "./overview-model";
import { ProjectHeading } from "./ProjectHeading";
import { QuestionsCard } from "./QuestionsCard";
import { SprintsCard } from "./SprintsCard";

export type OverviewHandlers = NextActions & {
  onOpenSprint(id: string): void;
  onOpenQuestion(id: string): void;
  onOpenQuestions(): void;
  onOpenPlanning(): void;
  onNewFeature(): void;
  onChooseFolder(): void;
};
type Props = {
  project: ProjectInfo | null;
  model: OverviewModel;
  activity: ActivityInput;
  start: GettingStartedModel | null;
  handlers: OverviewHandlers;
};

function StartCard({
  project,
  start,
  handlers,
}: {
  project: ProjectInfo;
  start: GettingStartedModel;
  handlers: OverviewHandlers;
}) {
  const { target } = start;
  return (
    <GettingStarted
      model={start}
      projectKey={project.key}
      onNewFeature={handlers.onNewFeature}
      onChooseFolder={handlers.onChooseFolder}
      onCopy={() => {
        if (target !== null) void handlers.copy(target.id);
      }}
    />
  );
}

function EmptyProject({
  project,
  model,
  start,
  handlers,
}: Props & { project: ProjectInfo; start: GettingStartedModel }) {
  return (
    <div className="flex items-start gap-[16px]">
      <div className="flex min-w-0 flex-1 flex-col gap-[14px]">
        <StartCard project={project} start={start} handlers={handlers} />
      </div>
      <div className="flex w-[300px] shrink-0 flex-col gap-[14px]">
        <SprintsCard
          sprints={model.sprints}
          current={model.sprint?.sprint.id ?? null}
          onOpenSprint={handlers.onOpenSprint}
        />
      </div>
    </div>
  );
}

function ProjectCards({ project, model, activity, start, handlers }: Props) {
  return (
    <>
      {project !== null && start !== null && (
        <StartCard project={project} start={start} handlers={handlers} />
      )}
      {model.now.length > 0 && <NowCard rows={model.now} onOpenTicket={handlers.onOpenTicket} />}
      <DeadlinesCard deadlines={model.deadlines} onOpenTicket={handlers.onOpenTicket} />
      <LateCard rows={model.late} onOpenTicket={handlers.onOpenTicket} />
      <HeldCard rows={model.held} onOpenPlanning={handlers.onOpenPlanning} />
      <div className="flex items-start gap-[16px]">
        <div className="flex min-w-0 flex-1 flex-col gap-[14px]">
          <CurrentSprintCard
            card={model.sprint}
            onOpenTicket={handlers.onOpenTicket}
            onOpenSprint={handlers.onOpenSprint}
          />
          <NextFeatureCard card={model.next} actions={handlers} />
          <ActivityCard input={activity} onOpenTicket={handlers.onOpenTicket} />
        </div>
        <div className="flex w-[300px] shrink-0 flex-col gap-[14px]">
          <InReviewCard rows={model.review} onOpenTicket={handlers.onOpenTicket} />
          <QuestionsCard
            rows={model.questions}
            onOpenQuestion={handlers.onOpenQuestion}
            onOpenQuestions={handlers.onOpenQuestions}
          />
        </div>
      </div>
    </>
  );
}

export function OverviewView(props: Props) {
  const { project, model, start, handlers } = props;
  const empty = project !== null && start !== null && !start.done.feature;
  return (
    <div className="h-full overflow-y-auto bg-(--tracking-bg)">
      <div className="flex min-w-0 flex-col gap-[14px] px-[24px] pt-[18px] pb-[24px]">
        <ProjectHeading project={project} />
        <Indicators indicators={model.indicators} onOpenHeld={handlers.onOpenPlanning} />
        {empty ? <EmptyProject {...props} project={project} start={start} /> : <ProjectCards {...props} />}
      </div>
    </div>
  );
}
