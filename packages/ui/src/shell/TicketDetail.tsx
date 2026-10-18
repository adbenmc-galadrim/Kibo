import type { CiRun, Domain, FileRef, ProjectSnapshot, TicketView } from "@kibo/schema";
import { fr } from "../i18n/fr";
import { frTicketTracking as tt } from "../i18n/fr-ticket-tracking";
import { canEdit } from "../state/access";
import { useNow } from "../state/use-agents";
import { DependenciesSection } from "../ticket/DependenciesSection";
import { DescriptionEditor } from "../ticket/DescriptionEditor";
import { DomainSelect } from "../ticket/DomainSelect";
import { FoldSection } from "../ticket/FoldSection";
import { QuestionsSection } from "../ticket/QuestionsSection";
import { TrackingSection } from "../ticket/TrackingSection";
import { useTicketCommand } from "../ticket/use-ticket-command";
import type { TicketJournal } from "../ticket/use-ticket-tracking";
import { useOptionalHost } from "./Host";
import { CiSection, DesignProperty, DesignSection, SyncStatus } from "./sheet/lazy-sections";

type Props = {
  project: ProjectSnapshot;
  ticket: TicketView;
  domains?: Domain[];
  ciRuns?: readonly CiRun[];
  journal?: TicketJournal;
  onOpenFile(ref: FileRef): void;
  onOpenTicket(ticketId: string): void;
};

const NO_JOURNAL: TicketJournal = { events: [], error: false };
const LINE = "h-px w-full bg-(--tracking-soft)";
const DESIGN_KINDS: ReadonlySet<string> = new Set(["figma_node", "penpot_board"]);

export const descendantCount = (tickets: readonly TicketView[], id: string): number =>
  tickets.filter((x) => x.parentId === id).reduce((n, c) => n + 1 + descendantCount(tickets, c.id), 0);

export function TicketDetail({
  project,
  ticket: t,
  domains,
  ciRuns = [],
  journal = NO_JOURNAL,
  onOpenFile,
  onOpenTicket,
}: Props) {
  const editable = canEdit(project);
  const now = useNow(60_000);
  const host = useOptionalHost();
  const descriptionCommand = useTicketCommand(project.meta.id);
  const children = project.tickets.filter((x) => x.parentId === t.id);
  const domain = domains?.find((d) => d.id === t.domainId)?.name ?? fr.ticket.noDomain;
  const mockups = t.externalRefs.filter((r) => DESIGN_KINDS.has(r.kind)).length;
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
      <div className="-mx-4 empty:hidden">
        <SyncStatus projectId={project.meta.id} ticket={t} />
      </div>
      <TrackingSection ticket={t} ciRuns={ciRuns} events={journal.events} now={now} />
      <div className={LINE} />
      {(editable || t.description) && (
        <>
          <DescriptionEditor
            ticketId={t.id}
            description={t.description}
            editable={editable}
            command={descriptionCommand}
            onOpenFile={open}
          />
          <div className={LINE} />
        </>
      )}
      <DependenciesSection project={project} ticket={t} editable={editable} onOpenTicket={onOpenTicket} />
      <div className={LINE} />
      <QuestionsSection
        ticket={t}
        questions={project.questions}
        onOpen={(id) => host?.openView("questions", undefined, id)}
      />
      {children.length > 0 && (
        <section className="grid gap-1 text-xs">
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
      {ciRuns.length > 0 && (
        <div className="-mx-4">
          <CiSection projectId={project.meta.id} ticketId={t.id} />
        </div>
      )}
      <div className={LINE} />
      <FoldSection title={tt.domain} hint={domain}>
        {domains && <DomainSelect project={project} ticket={t} domains={domains} />}
      </FoldSection>
      <FoldSection title={tt.mockups} hint={String(mockups)}>
        <dl className="grid grid-cols-[106px_1fr] items-center text-xs">
          <DesignProperty ticket={t} />
        </dl>
        <div className="-mx-4">
          <DesignSection projectId={project.meta.id} ticket={t} />
        </div>
      </FoldSection>
    </div>
  );
}
