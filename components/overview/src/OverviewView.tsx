import type { ProjectInfo } from "@kibo/sdk";
import { ActivityCard } from "./ActivityCard";
import type { ActivityInput } from "./activity-model";
import { CurrentSprintCard } from "./CurrentSprintCard";
import { DeadlinesCard } from "./DeadlinesCard";
import { Indicators } from "./Indicators";
import { InReviewCard } from "./InReviewCard";
import { type NextActions, NextFeatureCard } from "./NextFeatureCard";
import { NowCard } from "./NowCard";
import type { OverviewModel } from "./overview-model";
import { ProjectHeading } from "./ProjectHeading";
import { QuestionsCard } from "./QuestionsCard";

export type OverviewHandlers = NextActions & {
  onOpenSprint(id: string): void;
  onOpenQuestion(id: string): void;
  onOpenQuestions(): void;
};
type Props = {
  project: ProjectInfo | null;
  model: OverviewModel;
  activity: ActivityInput;
  handlers: OverviewHandlers;
};

export function OverviewView({ project, model, activity, handlers }: Props) {
  return (
    <div className="h-full overflow-y-auto bg-(--tracking-bg)">
      <div className="flex min-w-0 flex-col gap-[14px] px-[24px] pt-[18px] pb-[24px]">
        <ProjectHeading project={project} />
        <Indicators indicators={model.indicators} />
        <NowCard rows={model.now} onOpenTicket={handlers.onOpenTicket} />
        <DeadlinesCard deadlines={model.deadlines} onOpenTicket={handlers.onOpenTicket} />
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
      </div>
    </div>
  );
}
