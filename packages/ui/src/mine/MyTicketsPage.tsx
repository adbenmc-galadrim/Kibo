import type { ProjectSnapshot, WorkspaceConfig } from "@kibo/schema";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@kibo/sdk/ui/tooltip";
import { useId, useMemo, useState } from "react";
import { fr } from "../i18n/fr";
import { MyTicketRow } from "./MyTicketRow";
import { countMine, type MineGroup, type MineTab, myTickets } from "./my-tickets";

type Props = {
  viewer: string;
  projects: MineGroup["project"][];
  snapshots: ReadonlyMap<string, ProjectSnapshot>;
  config: WorkspaceConfig | null;
  onOpenTicket(projectId: string, ticketId: string): void;
  onAssign(projectId: string, ticketId: string): void;
};

const SEGMENT =
  "h-7 rounded-md px-3 text-xs text-muted-foreground hover:bg-transparent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm";

function MineTabs({ value, onChange }: { value: MineTab; onChange(tab: MineTab): void }) {
  return (
    <ToggleGroup
      type="single"
      spacing={1}
      aria-label={fr.mine.tabs}
      className="rounded-lg bg-muted p-[3px]"
      value={value}
      onValueChange={(v) => {
        if (v === "assigned" || v === "agents") onChange(v);
      }}
    >
      <ToggleGroupItem value="assigned" className={SEGMENT}>
        {fr.mine.assigned}
      </ToggleGroupItem>
      <ToggleGroupItem value="agents" className={SEGMENT}>
        {fr.mine.agents}
      </ToggleGroupItem>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block">
            <ToggleGroupItem value="created" className={SEGMENT} disabled>
              {fr.mine.created}
            </ToggleGroupItem>
          </span>
        </TooltipTrigger>
        <TooltipContent>{fr.mine.createdLater}</TooltipContent>
      </Tooltip>
    </ToggleGroup>
  );
}

type SectionProps = Pick<Props, "config" | "onOpenTicket" | "onAssign"> & {
  group: MineGroup;
  tab: MineTab;
  snapshot: ProjectSnapshot | undefined;
};

function MineSection({ group, tab, snapshot, config, onOpenTicket, onAssign }: SectionProps) {
  const titleId = useId();
  const { project, tickets } = group;
  const domainOf = (id: string | null) => config?.domains.find((d) => d.id === id) ?? null;
  return (
    <section aria-labelledby={titleId} className="grid gap-2">
      <h2 className="flex items-center gap-2 px-1">
        <span aria-hidden className="size-2 rounded-[2px]" style={{ background: project.color }} />
        <span id={titleId} className="text-sm font-semibold">
          {project.name}
        </span>
        <span className="text-2xs text-muted-foreground tabular-nums">{tickets.length}</span>
      </h2>
      <ul className="grid gap-1.5">
        {tickets.map((ticket) => (
          <MyTicketRow
            key={ticket.id}
            ticket={ticket}
            tab={tab}
            domain={domainOf(ticket.domainId)}
            workflow={snapshot?.workflow ?? []}
            canRun={project.folder !== null}
            onOpen={() => onOpenTicket(project.id, ticket.id)}
            onAssign={() => onAssign(project.id, ticket.id)}
          />
        ))}
      </ul>
    </section>
  );
}

export function MyTicketsPage({ viewer, projects, snapshots, ...p }: Props) {
  const [tab, setTab] = useState<MineTab>("assigned");
  const groups = useMemo(
    () => myTickets(projects, snapshots, viewer, tab),
    [projects, snapshots, viewer, tab],
  );
  return (
    <TooltipProvider>
      <div className="flex items-center justify-between gap-4 border-b px-6 py-3">
        <MineTabs value={tab} onChange={setTab} />
        <p className="text-xs text-muted-foreground tabular-nums">
          {fr.mine.summary(countMine(groups), groups.length)}
        </p>
      </div>
      {groups.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">{fr.mine.empty[tab]}</p>
      ) : (
        <div className="grid gap-6 p-6">
          {groups.map((group) => (
            <MineSection
              key={group.project.id}
              group={group}
              tab={tab}
              snapshot={snapshots.get(group.project.id)}
              {...p}
            />
          ))}
        </div>
      )}
    </TooltipProvider>
  );
}
