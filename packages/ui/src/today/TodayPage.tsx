import type { ProjectSnapshot, ProjectSummary } from "@kibo/schema";
import { useDaemonToday } from "../shell/use-daemon-today";
import { BlockingSection } from "./BlockingSection";
import { frToday as t } from "./fr-today";
import { ProjectsList } from "./ProjectsList";
import { PrsSection } from "./PrsSection";
import { StartableSection } from "./StartableSection";
import { TodayHeader } from "./TodayHeader";
import { type TodayModel, todayModel } from "./today-model";

type OpenHandlers = {
  onOpenTicket(projectId: string, ticketId: string): void;
  onOpenProject(projectId: string): void;
};
type Props = OpenHandlers & {
  projects: readonly ProjectSummary[];
  snapshots: ReadonlyMap<string, ProjectSnapshot>;
  now?: number;
  onNewProject(): void;
};

function Sections({ model, loaded, ...open }: OpenHandlers & { model: TodayModel; loaded: boolean }) {
  const { blocking, prsToReview, startable } = model;
  const calm = loaded && blocking.length + prsToReview.length + startable.length === 0;
  return (
    <>
      {calm && <p className="text-[13px] text-(--tracking-mfg)">{t.calm}</p>}
      {blocking.length > 0 && (
        <BlockingSection
          rows={blocking}
          questions={model.blockingQuestions}
          onOpenTicket={open.onOpenTicket}
        />
      )}
      {prsToReview.length > 0 && <PrsSection rows={prsToReview} onOpenTicket={open.onOpenTicket} />}
      {startable.length > 0 && <StartableSection rows={startable} onOpenTicket={open.onOpenTicket} />}
      <ProjectsList projects={model.projects} onOpen={open.onOpenProject} />
    </>
  );
}

export function TodayPage({ projects, snapshots, now, onNewProject, ...open }: Props) {
  const today = useDaemonToday(now);
  const views = projects.flatMap((p) => snapshots.get(p.id) ?? []);
  const model = today === null ? null : todayModel(views, today);
  return (
    <div data-view-body className="flex flex-col gap-3.5 px-6 pt-5 pb-6">
      <TodayHeader
        summary={model && t.summary(t.day(model.date), projects.length, model.openTickets)}
        onNewProject={onNewProject}
      />
      {model && <Sections model={model} loaded={views.length === projects.length} {...open} />}
    </div>
  );
}
