import type { FileRef, ProjectSnapshot, TicketView } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { Progress } from "@kibo/sdk/ui/progress";
import { frGroup } from "../i18n/fr-group";
import { DescriptionEditor } from "../ticket/DescriptionEditor";
import { useTicketCommand } from "../ticket/use-ticket-command";

type Props = {
  project: ProjectSnapshot;
  ticket: TicketView;
  onOpenFile(ref: FileRef): void;
  onOpenTicket(ticketId: string): void;
};

const percent = ({ done, total }: TicketView["progress"]) =>
  total === 0 ? 0 : Math.round((done / total) * 100);

export function GroupDetail({ project, ticket: t, onOpenFile, onOpenTicket }: Props) {
  const command = useTicketCommand(project.meta.id);
  const children = project.tickets.filter((x) => x.parentId === t.id);
  const label = (id: TicketView["statusId"]) => project.workflow.find((s) => s.id === id)?.label ?? id;
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
      <dl className="grid grid-cols-[120px_1fr] items-center gap-y-2 px-4 text-xs">
        <dt className="text-muted-foreground">{frGroup.state}</dt>
        <dd className="flex items-center gap-2">
          <StatusDot statusId={t.statusId} />
          <span>{label(t.statusId)}</span>
          <span className="text-muted-foreground">{frGroup.derived}</span>
        </dd>
        <dt className="text-muted-foreground">{frGroup.progress}</dt>
        <dd className="flex items-center gap-3">
          <Progress
            aria-label={frGroup.progress}
            value={percent(t.progress)}
            className="h-1.5 max-w-48 bg-zinc-200 dark:bg-zinc-800"
          />
          <span className="shrink-0 font-mono">{frGroup.delivered(t.progress.done, t.progress.total)}</span>
        </dd>
      </dl>
      {command.error && (
        <p role="alert" className="px-4 text-sm text-destructive">
          {command.error}
        </p>
      )}
      <section className="grid gap-1 px-4 text-xs">
        <h3 className="font-medium">{frGroup.children}</h3>
        <ul className="grid gap-0.5">
          {children.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-1 py-1 text-left hover:bg-muted"
                onClick={() => onOpenTicket(c.id)}
              >
                <StatusDot statusId={c.statusId} />
                <span className="shrink-0 font-mono text-2xs text-muted-foreground">{c.keyLabel}</span>
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                <span className="shrink-0 text-muted-foreground">{label(c.statusId)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <DescriptionEditor
        ticketId={t.id}
        description={t.description}
        editable
        command={command}
        onOpenFile={open}
      />
    </div>
  );
}
