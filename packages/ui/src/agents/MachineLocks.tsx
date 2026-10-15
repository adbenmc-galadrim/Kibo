import type { LockTicket, MachineLock } from "@kibo/schema";
import { LockKeyhole } from "lucide-react";
import { frAgentsSkills } from "../i18n/fr-agents-skills";
import { abbreviateHome } from "../lib/home-path";
import { formatDuration } from "./format";

type LockState = "held" | "waiting" | "dead";

const t = frAgentsSkills.queue.locks;

const STATE_CLASS: Record<LockState, string> = {
  held: "border-blue-500/40 text-blue-700 dark:text-blue-400",
  waiting: "border-cyan-500/40 text-cyan-700 dark:text-cyan-400",
  dead: "border-red-500/50 text-red-700 dark:text-red-400",
};
const DOT_CLASS: Record<LockState, string> = {
  held: "bg-blue-500",
  waiting: "bg-cyan-500",
  dead: "bg-red-500",
};

const stateOf = (ticket: LockTicket, waiting: boolean): LockState =>
  waiting ? "waiting" : ticket.alive ? "held" : "dead";

function LockLine({ ticket, state, now }: { ticket: LockTicket; state: LockState; now: number }) {
  return (
    <li className="grid gap-0.5 border-t pt-1.5 first:border-t-0 first:pt-0">
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium">{`${ticket.ticket} ${ticket.label}`}</span>
        <span className="font-mono text-3xs text-muted-foreground">{formatDuration(now - ticket.since)}</span>
        <span
          data-testid="lock-state"
          className={`inline-flex items-center gap-1 rounded-full border px-1.5 text-3xs ${STATE_CLASS[state]}`}
        >
          <span aria-hidden className={`size-1.5 rounded-full ${DOT_CLASS[state]}`} />
          {t[state]}
        </span>
      </span>
      <span className="truncate font-mono text-2xs text-muted-foreground" title={abbreviateHome(ticket.cwd)}>
        {abbreviateHome(ticket.cwd)}
      </span>
    </li>
  );
}

function LockCard({ lock, now }: { lock: MachineLock; now: number }) {
  const occupancy = t.occupancy(lock.held.length, lock.max, lock.waiting.length);
  const lines = [
    ...lock.held.map((ticket) => ({ ticket, state: stateOf(ticket, false) })),
    ...lock.waiting.map((ticket) => ({ ticket, state: stateOf(ticket, true) })),
  ];
  return (
    <article
      aria-label={t.card(lock.name, occupancy)}
      className="grid min-w-0 content-start gap-2 rounded-lg border bg-card p-3"
    >
      <header className="flex items-center gap-2">
        <LockKeyhole aria-hidden className="size-3.5 text-muted-foreground" />
        <span className="font-mono text-sm font-semibold">{lock.name}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{occupancy}</span>
      </header>
      {lines.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.free}</p>
      ) : (
        <ul className="grid gap-1.5">
          {lines.map(({ ticket, state }) => (
            <LockLine
              key={`${state}:${ticket.ticket}:${ticket.pid}`}
              ticket={ticket}
              state={state}
              now={now}
            />
          ))}
        </ul>
      )}
    </article>
  );
}

type Props = { locks: readonly MachineLock[]; now: number; dir?: string | null };

export function MachineLocks({ locks, now, dir = null }: Props) {
  return (
    <section aria-label={t.title} className="grid gap-3">
      <header className="flex flex-wrap items-center gap-2">
        <LockKeyhole aria-hidden className="size-4 text-muted-foreground" />
        <h2 className="text-md font-semibold">{t.title}</h2>
        <span className="text-xs text-muted-foreground">{t.source(dir ?? t.dir)}</span>
      </header>
      {locks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] items-start gap-4">
          {locks.map((lock) => (
            <LockCard key={lock.name} lock={lock} now={now} />
          ))}
        </div>
      )}
    </section>
  );
}
