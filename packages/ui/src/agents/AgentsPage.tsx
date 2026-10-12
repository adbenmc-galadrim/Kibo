import type { AgentsState, ProjectSummary, RunState } from "@kibo/schema";
import { RunDot } from "@kibo/sdk";
import { fr } from "../i18n/fr";
import { frAgentsPage } from "../i18n/fr-agents-page";
import { formatTokens } from "./format";
import { ProjectFilter } from "./ProjectFilter";
import { effectiveProject, projectRuns } from "./project-filter";
import { useAgentsProject } from "./project-pref";
import { RunHistory } from "./RunHistory";

type Props = {
  state: AgentsState;
  projects: ProjectSummary[];
  now: number;
  onOpenRun: (runId: string) => void;
};

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

export function AgentsPage({ state, projects, now, onOpenRun }: Props) {
  const [pref, setPref] = useAgentsProject();
  const project = effectiveProject(pref, projects);
  const runs = projectRuns(state.runs, project?.id ?? null);
  const runIds = new Set(runs.map((r) => r.id));
  const queued = state.queue.filter((q) => runIds.has(q.runId)).length;
  const positions = new Map(state.queue.map((q) => [q.runId, q.position]));
  const waiting = runs.filter((r) => r.state === "waiting_input").length;
  const s = fr.agentsPage.stats;
  return (
    <div className="grid content-start gap-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">{frAgentsPage.subtitle}</p>
        <span className="flex-1" />
        <ProjectFilter projects={projects} value={pref} onChange={setPref} />
      </div>
      <ul aria-label={fr.agentsPage.title} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          state="running"
          value={frAgentsPage.stats.slots(state.host.used, state.host.hostSlots)}
          label={s.running}
        />
        <Stat state="queued" value={String(queued)} label={s.queued} />
        <Stat state="waiting_input" value={String(waiting)} label={s.waiting} />
        <Stat
          state="cancelled"
          value={formatTokens(state.tokensToday)}
          label={s.tokens}
          help={frAgentsPage.stats.tokensHelp}
        />
      </ul>
      <section className="grid gap-3">
        <h2 className="text-md font-semibold">{fr.agentsPage.title}</h2>
        <p className="text-sm text-muted-foreground">{fr.lazy.loading}</p>
      </section>
      <RunHistory
        questions={state.questions}
        runs={runs}
        positions={positions}
        projectColumn={project === null ? projects : null}
        now={now}
        onOpenRun={onOpenRun}
      />
    </div>
  );
}
