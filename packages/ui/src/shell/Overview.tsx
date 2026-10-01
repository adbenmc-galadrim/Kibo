import type { ProjectSummary, StatusId } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Inbox, Plus } from "lucide-react";
import { useId } from "react";
import { fr } from "../i18n/fr";
import { abbreviateHome } from "../lib/home-path";
import { navigate } from "../route";

const total = (p: ProjectSummary) => Object.values(p.counts).reduce((a, b) => a + b, 0);
const open = (p: ProjectSummary) => total(p) - p.counts.done;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Count({ statusId, value, label }: { statusId: StatusId; value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot statusId={statusId} />
      <span className="text-xs font-medium text-foreground">{value}</span> {label}
    </span>
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  const nameId = useId();
  const all = total(project);
  const done = project.counts.done;
  return (
    <article
      aria-labelledby={nameId}
      className="relative grid gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:bg-accent/50"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-md text-md font-semibold"
          style={{ background: `color-mix(in oklab, ${project.color} 22%, transparent)` }}
        >
          {project.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <button
            type="button"
            id={nameId}
            onClick={() => navigate(project.id)}
            className="block truncate text-left text-md font-semibold outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
          >
            {project.name}
          </button>
          <p className="break-all font-mono text-2xs text-muted-foreground">
            {project.folder ? abbreviateHome(project.folder) : project.key}
          </p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label={fr.overview.progress(done, all)}
        aria-valuemin={0}
        aria-valuemax={all}
        aria-valuenow={done}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${all ? (done / all) * 100 : 0}%`, background: project.color }}
        />
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted-foreground">
        <Count statusId="in_progress" value={project.counts.in_progress} label={fr.overview.inProgress} />
        <Count statusId="todo" value={project.counts.todo} label={fr.overview.todo} />
        <Count statusId="blocked" value={project.counts.blocked} label={fr.overview.blocked} />
      </p>
    </article>
  );
}

function InboxCard({ count, onOpen }: { count: number; onOpen(): void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left text-sm text-card-foreground shadow-sm outline-none transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Inbox aria-hidden className="size-4 text-muted-foreground" />
      <span>{fr.overview.inbox(count)}</span>
    </button>
  );
}

type Props = {
  viewer: string;
  projects: ProjectSummary[];
  inboxCount: number;
  onNewProject: () => void;
  onOpenInbox(): void;
};

export function Overview({ viewer, projects, inboxCount, onNewProject, onOpenInbox }: Props) {
  const openTickets = projects.reduce((n, p) => n + open(p), 0);
  return (
    <div className="grid gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">{fr.overview.greeting(capitalize(viewer))}</h1>
          <p className="text-sm text-muted-foreground">{fr.overview.summary(projects.length, openTickets)}</p>
        </div>
        <Button onClick={onNewProject}>
          <Plus className="size-4" /> {fr.nav.newProject}
        </Button>
      </div>
      {inboxCount > 0 && <InboxCard count={inboxCount} onOpen={onOpenInbox} />}
      {projects.length === 0 ? (
        <p className="text-muted-foreground">{fr.overview.empty}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
