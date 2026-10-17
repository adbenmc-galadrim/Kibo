import type { ProjectSnapshot } from "@kibo/schema";
import { frTracking } from "../../i18n/fr-tracking";
import { SprintDetail } from "./SprintDetail";
import { SprintReportBanner } from "./SprintReportBanner";
import { useSprintView } from "./use-sprint-view";

type Props = { project: ProjectSnapshot; sprintId: string; onOpenTicket(ticketId: string): void };

export function SprintTab({ project, sprintId, onOpenTicket }: Props) {
  const v = useSprintView(project, sprintId);
  if (!v.sprint || !v.timing)
    return <p className="p-8 text-sm text-muted-foreground">{frTracking.missingSprint}</p>;
  return (
    <div className="mx-auto w-full max-w-[640px]">
      <SprintDetail
        sprint={v.sprint}
        features={v.features}
        timing={v.timing}
        editable={v.editable}
        banner={<SprintReportBanner proposal={v.proposal} editable={v.editable} decide={v.decide} />}
        title={({ className, children }) => <h1 className={className}>{children}</h1>}
        command={v.command}
        onOpenTicket={onOpenTicket}
      />
    </div>
  );
}
