import type { ProjectSnapshot, TabTarget } from "@kibo/schema";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@kibo/sdk/ui/sheet";
import { frSprint } from "../../i18n/fr-sprint";
import { SprintDetail } from "./SprintDetail";
import { SprintReportBanner } from "./SprintReportBanner";
import { type SprintRoute, sprintTarget } from "./sprint-route";
import { useSprintView } from "./use-sprint-view";

type Props = {
  route: SprintRoute;
  project: ProjectSnapshot | null;
  now?: number;
  onClose(): void;
  onOpenTicket(ticketId: string): void;
  onOpenInTab(target: TabTarget): void;
};

function SprintSheetBody({
  route,
  project,
  now,
  onClose,
  onOpenTicket,
  onOpenInTab,
}: Props & { project: ProjectSnapshot }) {
  const v = useSprintView(project, route.sprintId, now);
  if (!v.sprint || !v.timing) return null;
  const sprint = v.sprint;
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-[min(90vw,560px)]">
        <SheetHeader className="sr-only">
          <SheetDescription>{frSprint.features}</SheetDescription>
        </SheetHeader>
        <SprintDetail
          sprint={sprint}
          features={v.features}
          timing={v.timing}
          editable={v.editable}
          banner={<SprintReportBanner proposal={v.proposal} editable={v.editable} decide={v.decide} />}
          title={({ className, children }) => <SheetTitle className={className}>{children}</SheetTitle>}
          command={v.command}
          onOpenTicket={onOpenTicket}
          onOpenInTab={() => onOpenInTab(sprintTarget(route.projectId, sprint.id))}
        />
      </SheetContent>
    </Sheet>
  );
}

export function SprintSheet(props: Props) {
  const { project, route } = props;
  if (!project || project.meta.id !== route.projectId) return null;
  return <SprintSheetBody {...props} project={project} />;
}
