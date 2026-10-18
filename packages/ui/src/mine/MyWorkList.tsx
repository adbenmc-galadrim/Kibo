import { deliveryBrief, type ProjectMeta, type ProjectSnapshot, type Status } from "@kibo/schema";
import { copyDeliveryCommand, StatusDot } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Copy } from "lucide-react";
import { useId, useMemo } from "react";
import { toast } from "sonner";
import { fr } from "../i18n/fr";
import { frMine } from "../i18n/fr-mine";
import { useProjectCiRuns } from "./use-project-ci-runs";
import { WorkBadges } from "./WorkBadges";
import { type WorkItem, type WorkSection, workList } from "./work-list";

type Props = {
  viewer: string;
  projects: ProjectMeta[];
  snapshots: ReadonlyMap<string, ProjectSnapshot>;
  onOpenTicket(projectId: string, ticketId: string): void;
};

const toaster = { toast: (message: string) => void toast(message) };

function CopyButton({ item }: { item: WorkItem }) {
  const { key, startable, waitingOn } = item.ticket;
  if (key === null) return null;
  const label = frMine.copy(deliveryBrief(key));
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 shrink-0 text-muted-foreground"
      aria-label={label}
      title={label}
      onClick={() => void copyDeliveryCommand(toaster, { key, startable, waitingOn })}
    >
      <Copy aria-hidden />
    </Button>
  );
}

type RowProps = {
  item: WorkItem;
  workflow: readonly Status[];
  many: boolean;
  waiting: boolean;
  onOpen(): void;
};

function WorkRow({ item, workflow, many, waiting, onOpen }: RowProps) {
  const { ticket, project } = item;
  const status = workflow.find((s) => s.id === ticket.statusId)?.label ?? ticket.statusId;
  return (
    <li className="flex h-12 items-center gap-3 rounded-lg border bg-card pr-2">
      <button
        type="button"
        aria-label={`${ticket.keyLabel} ${ticket.title}`}
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 self-stretch rounded-lg pl-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <StatusDot statusId={ticket.statusId} />
        <span className="key shrink-0 font-mono text-2xs text-muted-foreground">{ticket.keyLabel}</span>
        <span className="truncate text-sm">{ticket.title}</span>
        {many && (
          <span className="flex shrink-0 items-center gap-1.5 text-2xs text-muted-foreground">
            <span aria-hidden className="size-1.5 rounded-full" style={{ background: project.color }} />
            {project.name}
          </span>
        )}
      </button>
      <WorkBadges item={item} waiting={waiting} />
      <span className="w-24 shrink-0 text-sm text-muted-foreground">{status}</span>
      <CopyButton item={item} />
    </li>
  );
}

type SectionProps = Pick<Props, "snapshots" | "onOpenTicket"> & { section: WorkSection; many: boolean };

function WorkGroupSection({ section, snapshots, many, onOpenTicket }: SectionProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="grid gap-2">
      <h2 className="flex items-baseline gap-2 px-1">
        <span id={titleId} className="text-sm font-semibold">
          {frMine.groups[section.group]}
        </span>
        <span className="text-2xs text-muted-foreground tabular-nums">{section.items.length}</span>
        <span className="text-2xs text-muted-foreground">{frMine.hints[section.group]}</span>
      </h2>
      <ul className="grid gap-1.5">
        {section.items.map((item) => (
          <WorkRow
            key={`${item.project.id}:${item.ticket.id}`}
            item={item}
            workflow={snapshots.get(item.project.id)?.workflow ?? []}
            many={many}
            waiting={section.group === "waiting"}
            onOpen={() => onOpenTicket(item.project.id, item.ticket.id)}
          />
        ))}
      </ul>
    </section>
  );
}

export function MyWorkList({ viewer, projects, snapshots, onOpenTicket }: Props) {
  const ciRuns = useProjectCiRuns(useMemo(() => projects.map((p) => p.id), [projects]));
  const sections = useMemo(
    () => workList(projects, snapshots, viewer, ciRuns),
    [projects, snapshots, viewer, ciRuns],
  );
  const count = sections.reduce((n, s) => n + s.items.length, 0);
  const projectCount = new Set(sections.flatMap((s) => s.items.map((i) => i.project.id))).size;
  return (
    <>
      <div className="flex items-center justify-end gap-4 border-b px-6 py-3">
        <p className="text-xs text-muted-foreground tabular-nums">{fr.mine.summary(count, projectCount)}</p>
      </div>
      {sections.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">{fr.mine.empty.assigned}</p>
      ) : (
        <div className="grid gap-6 p-6">
          {sections.map((section) => (
            <WorkGroupSection
              key={section.group}
              section={section}
              snapshots={snapshots}
              many={projectCount > 1}
              onOpenTicket={onOpenTicket}
            />
          ))}
        </div>
      )}
    </>
  );
}
