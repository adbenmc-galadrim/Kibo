import {
  type AgentProfile,
  type AgentsState,
  type RunState,
  runSubject,
  SLOT_STATES,
  type WorkspaceConfig,
} from "@kibo/schema";
import { RunDot } from "@kibo/sdk";
import { Badge } from "@kibo/sdk/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@kibo/sdk/ui/table";
import { Bot } from "lucide-react";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { elapsed, formatDuration, formatTokens, runResultText } from "./format";
import { ProfileSheet } from "./ProfileSheet";

type Props = { state: AgentsState; config: WorkspaceConfig; now: number };

function ProfileCard({
  profile,
  active,
  onEdit,
}: {
  profile: AgentProfile;
  active: number;
  onEdit: () => void;
}) {
  const f = fr.agentsPage.fields;
  const fields: [string, string][] = [
    [f.workspace, fr.strategiesShort[profile.workspace]],
    [f.permissions, profile.permissionMode],
    [f.parallel, fr.agentsPage.parallel(profile.maxParallel)],
    [f.subagents, profile.subagents.map((m) => fr.modelsShort[m]).join(", ") || fr.agentsPage.none],
  ];
  return (
    <article
      aria-label={profile.name}
      className="relative grid gap-3 rounded-lg border bg-card p-4 hover:bg-accent/40"
    >
      <header className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-md border">
          <Bot aria-hidden className="size-4" />
        </span>
        <div className="grid min-w-0 flex-1">
          <h3 className="font-mono text-sm font-semibold">
            <button
              type="button"
              aria-label={fr.agentsPage.editProfile(profile.name)}
              className="after:absolute after:inset-0"
              onClick={onEdit}
            >
              {profile.name}
            </button>
          </h3>
          <span className="text-xs text-muted-foreground">
            {fr.agentsPage.modelLine(fr.agents.modelNames[profile.model])}
          </span>
        </div>
        {active > 0 && (
          <Badge variant="secondary" className="bg-blue-500/15 text-blue-600 dark:text-blue-400">
            {fr.agentsPage.active(active)}
          </Badge>
        )}
      </header>
      <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 text-xs">
        {fields.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function Stat({ state, value, label }: { state: RunState; value: string; label: string }) {
  return (
    <li className="grid gap-1 rounded-lg border bg-card p-4">
      <span className="flex items-center gap-2 text-2xl font-semibold">
        <RunDot state={state} />
        {value}
      </span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </li>
  );
}

export function AgentsPage({ state, config, now }: Props) {
  const [editing, setEditing] = useState<AgentProfile | null>(null);
  const positions = new Map(state.queue.map((q) => [q.runId, q.position]));
  const waiting = state.runs.filter((r) => r.state === "waiting_input").length;
  const history = [...state.runs].sort((a, b) => b.seq - a.seq);
  const c = fr.agentsPage.columns;
  const s = fr.agentsPage.stats;
  return (
    <div className="grid content-start gap-6 p-6">
      <ul aria-label={fr.agentsPage.title} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          state="running"
          value={fr.agents.slots(state.host.used, state.host.hostSlots)}
          label={s.slots}
        />
        <Stat state="queued" value={String(state.queue.length)} label={s.queued} />
        <Stat state="waiting_input" value={String(waiting)} label={s.waiting} />
        <Stat state="cancelled" value={formatTokens(state.tokensToday)} label={s.tokens} />
      </ul>
      <section className="grid gap-3">
        <h2 className="font-semibold">{fr.agentsPage.profiles}</h2>
        {config.profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">{fr.agentsPage.noProfile}</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
            {config.profiles.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                active={
                  state.runs.filter((r) => r.profileId === p.id && SLOT_STATES.includes(r.state)).length
                }
                onEdit={() => setEditing(p)}
              />
            ))}
          </div>
        )}
      </section>
      <section className="grid gap-3">
        <h2 className="font-semibold">{fr.agentsPage.history}</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{fr.agentsPage.noRuns}</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{c.run}</TableHead>
                  <TableHead>{c.ticket}</TableHead>
                  <TableHead>{c.profile}</TableHead>
                  <TableHead>{c.duration}</TableHead>
                  <TableHead>{c.tokens}</TableHead>
                  <TableHead>{c.result}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-muted-foreground">{`#${r.seq}`}</TableCell>
                    <TableCell>{runSubject(r)}</TableCell>
                    <TableCell className="font-mono">{r.profileName}</TableCell>
                    <TableCell className="font-mono">
                      {r.startedAt === null ? "-" : formatDuration(elapsed(r, now))}
                    </TableCell>
                    <TableCell>{formatTokens(r.tokens)}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <RunDot state={r.state} />
                        {runResultText(r, positions.get(r.id) ?? null)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
      {editing && (
        <ProfileSheet
          profile={editing}
          config={config}
          hostSlots={state.host.hostSlots}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
