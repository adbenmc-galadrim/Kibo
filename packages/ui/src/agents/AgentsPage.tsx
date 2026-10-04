import {
  type AgentProfile,
  type AgentsState,
  type RunState,
  SLOT_STATES,
  type WorkspaceConfig,
} from "@kibo/schema";
import { RunDot } from "@kibo/sdk";
import { Badge } from "@kibo/sdk/ui/badge";
import { Bot } from "lucide-react";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { frAgentsPage } from "../i18n/fr-agents-page";
import { isDemoProfile, profileLabel } from "./demo-profile";
import { formatTokens } from "./format";
import { ProfileSheet } from "./ProfileSheet";
import { permissionModeLabel } from "./permission-mode";
import { RunHistory } from "./RunHistory";

type Props = {
  state: AgentsState;
  config: WorkspaceConfig;
  now: number;
  onOpenRun: (runId: string) => void;
};

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
  const label = profileLabel(profile);
  const fields: [string, string][] = [
    [f.workspace, fr.strategiesShort[profile.workspace]],
    [f.permissions, permissionModeLabel(profile.permissionMode)],
    [f.parallel, fr.agentsPage.parallel(profile.maxParallel)],
    [f.subagents, profile.subagents.map((m) => fr.modelsShort[m]).join(", ") || fr.agentsPage.none],
  ];
  return (
    <article
      aria-label={label}
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
              aria-label={fr.agentsPage.editProfile(label)}
              className="after:absolute after:inset-0"
              onClick={onEdit}
            >
              {label}
            </button>
          </h3>
          <span className="text-2xs text-muted-foreground">
            {fr.agentsPage.modelLine(fr.agents.modelNames[profile.model])}
          </span>
          {isDemoProfile(profile) && (
            <span className="text-2xs text-muted-foreground">{frAgentsPage.demo.noTokens}</span>
          )}
        </div>
        {profile.system && (
          <Badge variant="secondary" className="text-3xs">
            {fr.agentsPage.system}
          </Badge>
        )}
        {active > 0 && (
          <Badge variant="secondary" className="text-3xs bg-blue-500/15 text-blue-600 dark:text-blue-400">
            {fr.agentsPage.active(active)}
          </Badge>
        )}
      </header>
      <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 text-2xs">
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

type StatProps = { state: RunState; value: string; label: string; help?: string };

function Stat({ state, value, label, help }: StatProps) {
  return (
    <li className="grid content-start gap-1 rounded-lg border bg-card p-4">
      <span className="flex items-center gap-2 text-2xl font-semibold">
        <RunDot state={state} />
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
      {help && <span className="text-2xs text-muted-foreground">{help}</span>}
    </li>
  );
}

export function AgentsPage({ state, config, now, onOpenRun }: Props) {
  const [editing, setEditing] = useState<AgentProfile | null>(null);
  const positions = new Map(state.queue.map((q) => [q.runId, q.position]));
  const waiting = state.runs.filter((r) => r.state === "waiting_input").length;
  const s = fr.agentsPage.stats;
  return (
    <div className="grid content-start gap-6 p-6">
      <p className="text-sm text-muted-foreground">{frAgentsPage.subtitle}</p>
      <ul aria-label={fr.agentsPage.title} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          state="running"
          value={frAgentsPage.stats.slots(state.host.used, state.host.hostSlots)}
          label={s.running}
        />
        <Stat state="queued" value={String(state.queue.length)} label={s.queued} />
        <Stat state="waiting_input" value={String(waiting)} label={s.waiting} />
        <Stat
          state="cancelled"
          value={formatTokens(state.tokensToday)}
          label={s.tokens}
          help={frAgentsPage.stats.tokensHelp}
        />
      </ul>
      <section className="grid gap-3">
        <h2 className="text-md font-semibold">{fr.agentsPage.profiles}</h2>
        {!config.profiles.some((p) => !p.system) && (
          <p className="text-sm text-muted-foreground">{fr.agentsPage.noProfile}</p>
        )}
        {config.profiles.length > 0 && (
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
      <RunHistory runs={state.runs} positions={positions} now={now} onOpenRun={onOpenRun} />
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
