import type { ProjectSnapshot, ProjectSummary, StatusId } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Inbox, Plus } from "lucide-react";
import { useId } from "react";
import { fr } from "../i18n/fr";
import { frHome } from "../i18n/fr-home";
import { navigate } from "../route";
import { useNow } from "../state/use-agents";
import { type HomeCard, type HomeCounts, homeCard } from "./home-cards";
import { localDay } from "./sprint/sprint-facts";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Count({ statusId, value, label }: { statusId: StatusId; value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot statusId={statusId} />
      <span className="text-xs font-medium text-foreground">{value}</span> {label}
    </span>
  );
}

function CardCounts({ counts, color }: { counts: HomeCounts; color: string }) {
  return (
    <>
      <div
        role="progressbar"
        aria-label={fr.overview.progress(counts.done, counts.total)}
        aria-valuemin={0}
        aria-valuemax={counts.total}
        aria-valuenow={counts.done}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${counts.total ? (counts.done / counts.total) * 100 : 0}%`, background: color }}
        />
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-muted-foreground">
        <Count statusId="todo" value={counts.open} label={frHome.open(counts.open)} />
        <Count statusId="blocked" value={counts.blocked} label={frHome.blocked(counts.blocked)} />
        {counts.late > 0 && <Count statusId="blocked" value={counts.late} label={frHome.late(counts.late)} />}
        {counts.sprint !== null && (
          <span className="ml-auto whitespace-nowrap">{frHome.sprint(counts.sprint)}</span>
        )}
      </p>
    </>
  );
}

function ProjectCard({ card }: { card: HomeCard }) {
  const nameId = useId();
  return (
    <article
      aria-labelledby={nameId}
      className="relative grid content-start gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:bg-accent/50"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-md text-md font-semibold"
          style={{ background: `color-mix(in oklab, ${card.color} 22%, transparent)` }}
        >
          {card.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <button
            type="button"
            id={nameId}
            onClick={() => navigate(card.id)}
            className="block truncate text-left text-md font-semibold outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
          >
            {card.name}
          </button>
          <p className="truncate text-2xs text-muted-foreground">
            <span className="whitespace-nowrap font-mono">{card.key}</span>
            {card.client !== null && (
              <>
                <span aria-hidden> · </span>
                <span>{frHome.client(card.client)}</span>
              </>
            )}
          </p>
        </div>
      </div>
      {card.counts !== null && <CardCounts counts={card.counts} color={card.color} />}
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

export type HomeViewProps = {
  viewer: string;
  projects: ProjectSummary[];
  snapshots: ReadonlyMap<string, ProjectSnapshot>;
  inboxCount: number;
  now?: number;
  onNewProject: () => void;
  onOpenInbox(): void;
};

export function HomeView({
  viewer,
  projects,
  snapshots,
  inboxCount,
  now: fixedNow,
  onNewProject,
  onOpenInbox,
}: HomeViewProps) {
  const liveNow = useNow(60_000);
  const today = localDay(fixedNow ?? liveNow);
  const cards = projects.map((p) => homeCard(p, snapshots.get(p.id), today));
  const openTickets = cards.reduce((n, c) => n + (c.counts?.open ?? 0), 0);
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
          {cards.map((c) => (
            <ProjectCard key={c.id} card={c} />
          ))}
        </div>
      )}
    </div>
  );
}
