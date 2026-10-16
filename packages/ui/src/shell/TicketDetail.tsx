import {
  type Domain,
  type FileRef,
  mainSessionOf,
  type ProjectSnapshot,
  type TicketView,
} from "@kibo/schema";
import { DeliveryLine } from "../delivery/lazy";
import { fr } from "../i18n/fr";
import { frDelivery } from "../i18n/fr-delivery";
import { frFeature } from "../i18n/fr-group";
import { frQuestions } from "../i18n/fr-questions";
import { frTicketEdit } from "../i18n/fr-ticket-edit";
import { canEdit } from "../state/access";
import { useAgentsState } from "../state/agents-context";
import { runLabelIn } from "../state/run-label";
import { AssigneeSelect } from "../ticket/AssigneeSelect";
import { DependenciesSection } from "../ticket/DependenciesSection";
import { DescriptionEditor } from "../ticket/DescriptionEditor";
import { DomainSelect } from "../ticket/DomainSelect";
import { OptionalToggle } from "../ticket/OptionalToggle";
import { QuestionsBadge } from "../ticket/QuestionsBadge";
import { hasSprintField, SprintField } from "../ticket/SprintField";
import { StatusSelect } from "../ticket/StatusSelect";
import { useTicketCommand } from "../ticket/use-ticket-command";
import { useOptionalHost } from "./Host";
import { CiSection, DesignProperty, DesignSection, SyncStatus } from "./sheet/lazy-sections";

type Props = {
  project: ProjectSnapshot;
  ticket: TicketView;
  domains?: Domain[];
  viewer: string;
  onOpenFile(ref: FileRef): void;
  onOpenTicket(ticketId: string): void;
};

export const descendantCount = (tickets: readonly TicketView[], id: string): number =>
  tickets.filter((x) => x.parentId === id).reduce((n, c) => n + 1 + descendantCount(tickets, c.id), 0);

export function TicketDetail({ project, ticket: t, domains, viewer, onOpenFile, onOpenTicket }: Props) {
  const editable = canEdit(project);
  const host = useOptionalHost();
  const agents = useAgentsState();
  const session = agents && mainSessionOf(agents.runs, t.id);
  const command = useTicketCommand(project.meta.id);
  const descriptionCommand = useTicketCommand(project.meta.id);
  const children = project.tickets.filter((x) => x.parentId === t.id);
  const hasPr = t.externalRefs.some((r) => r.kind === "github_pr");
  const open = (r: { path: string; line: number | null }) =>
    onOpenFile({
      projectId: project.meta.id,
      worktree: null,
      path: r.path,
      line: r.line,
      origin: t.keyLabel,
    });
  return (
    <div className="grid gap-4">
      {t.openQuestions > 0 && (
        <div className="px-4">
          <QuestionsBadge
            count={t.openQuestions}
            questions={project.questions}
            recipients={project.questionRecipients}
            ticket={t}
            runLabel={runLabelIn(agents?.runs)}
            onOpen={(id) => host?.openView("questions", undefined, id ?? undefined)}
          />
        </div>
      )}
      <SyncStatus projectId={project.meta.id} ticket={t} />
      <dl className="grid grid-cols-[120px_1fr] items-center gap-y-2 px-4 text-xs">
        <dt className="text-muted-foreground">{fr.ticket.status}</dt>
        <dd>
          <StatusSelect ticket={t} workflow={project.workflow} editable={editable} command={command} />
        </dd>
        {domains && (
          <>
            <dt className="text-muted-foreground">{fr.ticket.domain}</dt>
            <dd>
              <DomainSelect project={project} ticket={t} domains={domains} />
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">{frTicketEdit.assignee}</dt>
        <dd>
          <AssigneeSelect
            ticket={t}
            viewer={viewer}
            members={project.sync.members}
            editable={editable}
            command={command}
          />
        </dd>
        {t.parentId !== null && (
          <>
            <dt className="text-muted-foreground">{frFeature.optional}</dt>
            <dd>
              <OptionalToggle ticket={t} editable={editable} command={command} />
            </dd>
          </>
        )}
        {hasSprintField(t) && (
          <>
            <dt className="text-muted-foreground">{frFeature.ticketSprint}</dt>
            <dd>
              <SprintField ticket={t} sprints={project.sprints} editable={editable} command={command} />
            </dd>
          </>
        )}
        {session && (
          <>
            <dt className="text-muted-foreground">{frQuestions.session}</dt>
            <dd className="font-mono">{frQuestions.mainSession(session.label, session.turns)}</dd>
          </>
        )}
        {t.delivery && (
          <>
            <dt className="self-start text-muted-foreground">{frDelivery.label}</dt>
            <dd>
              <DeliveryLine delivery={t.delivery} />
            </dd>
          </>
        )}
        {t.blockedReason && (
          <>
            <dt className="text-muted-foreground">{fr.ticket.blockedReason}</dt>
            <dd className="text-red-600 dark:text-red-400">{t.blockedReason}</dd>
          </>
        )}
        <DesignProperty ticket={t} />
      </dl>
      {command.error && (
        <p role="alert" className="px-4 text-sm text-destructive">
          {command.error}
        </p>
      )}
      <DependenciesSection project={project} ticket={t} editable={editable} onOpenTicket={onOpenTicket} />
      <DescriptionEditor
        ticketId={t.id}
        description={t.description}
        editable={editable}
        command={descriptionCommand}
        onOpenFile={open}
      />
      {children.length > 0 && (
        <section className="grid gap-1 px-4 text-xs">
          <h3 className="font-medium">
            {fr.ticket.subtickets} {`${t.progress.done}/${t.progress.total}`}
          </h3>
          {children.map((c) => (
            <button
              key={c.id}
              type="button"
              className="text-left hover:underline"
              onClick={() => onOpenTicket(c.id)}
            >
              <span className="font-mono text-2xs text-muted-foreground">{c.keyLabel}</span> {c.title}
            </button>
          ))}
        </section>
      )}
      {hasPr && <CiSection projectId={project.meta.id} ticketId={t.id} />}
      <DesignSection projectId={project.meta.id} ticket={t} />
    </div>
  );
}
