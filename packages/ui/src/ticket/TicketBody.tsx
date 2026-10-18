import type { Domain, FileRef, ProjectSnapshot, TicketView } from "@kibo/schema";
import type { ReactNode } from "react";
import { fr } from "../i18n/fr";
import { GithubLinkNote } from "../shell/sheet/lazy-sections";
import { TicketDetail } from "../shell/TicketDetail";
import { canEdit } from "../state/access";
import { AssigneeSelect } from "./AssigneeSelect";
import { TicketTabs, useTicketTab } from "./activity/TicketTabs";
import { TicketTimeline } from "./activity/TicketTimeline";
import { LabelsField } from "./LabelsField";
import { OptionalToggle } from "./OptionalToggle";
import { SprintField } from "./SprintField";
import { StatusSelect } from "./StatusSelect";
import { TicketHeader } from "./TicketHeader";
import { TicketTitle } from "./TicketTitle";
import { TrackingBanner } from "./TrackingBanner";
import { useTicketCommand } from "./use-ticket-command";
import { useTicketCiRuns, useTicketJournal } from "./use-ticket-tracking";

type Props = {
  project: ProjectSnapshot;
  ticket: TicketView;
  domains?: Domain[];
  viewer: string;
  notice?: ReactNode;
  heading(title: ReactNode): ReactNode;
  onOpenFile(ref: FileRef): void;
  onOpenTicket(ticketId: string): void;
};

export function TicketBody({
  project,
  ticket: t,
  domains,
  viewer,
  notice,
  heading,
  onOpenFile,
  onOpenTicket,
}: Props) {
  const titleCommand = useTicketCommand(project.meta.id);
  const fieldCommand = useTicketCommand(project.meta.id);
  const labelsCommand = useTicketCommand(project.meta.id);
  const ciRuns = useTicketCiRuns(project.meta.id, t.id);
  const journal = useTicketJournal(project.meta.id, t);
  const [tab, setTab] = useTicketTab();
  const editable = canEdit(project);
  return (
    <div className="grid gap-4 px-6 pt-[18px] pb-6">
      {notice}
      <TicketHeader project={project} ticket={t} />
      {heading(
        <TicketTitle
          title={t.title}
          editable={editable}
          error={titleCommand.error}
          onSave={(title) => titleCommand.run({ method: "updateTicket", ticketId: t.id, title })}
          onCancel={titleCommand.clearError}
        />,
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <StatusSelect ticket={t} workflow={project.workflow} editable={editable} command={fieldCommand} />
        <AssigneeSelect
          ticket={t}
          viewer={viewer}
          members={project.sync.members}
          editable={editable}
          command={fieldCommand}
        />
        <SprintField ticket={t} sprints={project.sprints} editable={editable} command={fieldCommand} />
        <OptionalToggle ticket={t} editable={editable} command={fieldCommand} />
      </div>
      {fieldCommand.error && (
        <p role="alert" className="text-sm text-destructive">
          {fieldCommand.error}
        </p>
      )}
      {t.blockedReason && (
        <p className="text-xs text-red-600 dark:text-red-400">
          <span className="text-muted-foreground">{fr.ticket.blockedReason} · </span>
          {t.blockedReason}
        </p>
      )}
      <LabelsField ticket={t} editable={editable} command={labelsCommand} />
      <GithubLinkNote ticket={t} />
      <TrackingBanner ticket={t} ciRuns={ciRuns} />
      <TicketTabs
        tab={tab}
        onTab={setTab}
        details={
          <TicketDetail
            project={project}
            ticket={t}
            domains={domains}
            ciRuns={ciRuns}
            journal={journal}
            onOpenFile={onOpenFile}
            onOpenTicket={onOpenTicket}
          />
        }
        activity={
          <TicketTimeline
            project={project}
            ticket={t}
            journal={journal}
            ciRuns={ciRuns}
            onOpenFile={onOpenFile}
          />
        }
      />
    </div>
  );
}
