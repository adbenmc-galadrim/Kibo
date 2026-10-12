import type { AgentRef, AgentSummary, AgentsState, ProjectSummary, RunState } from "@kibo/schema";
import { lazyPanel, RunDot } from "@kibo/sdk";
import { Alert, AlertDescription } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { frAgentsPage } from "../i18n/fr-agents-page";
import { frAgentsSkills } from "../i18n/fr-agents-skills";
import { AgentsSection } from "./catalog/AgentsSection";
import { SystemAgentsSection } from "./catalog/SystemAgentsSection";
import { useAgentList } from "./catalog/use-agent-list";
import { formatTokens } from "./format";
import { ProjectFilter } from "./ProjectFilter";
import { effectiveProject, projectRuns } from "./project-filter";
import { useAgentsProject } from "./project-pref";
import { RunHistory } from "./RunHistory";

const AgentSheet = lazyPanel(() => import("./sheet/AgentSheet").then((m) => m.AgentSheet), fr.lazy);

type Props = {
  state: AgentsState;
  projects: ProjectSummary[];
  now: number;
  onOpenRun: (runId: string) => void;
};

type StatProps = { state: RunState; value: string; label: string; help?: string };
type Opened = { ref: AgentRef; rename: boolean };

const t = frAgentsSkills.page;

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

const inProject = (projectId: string | null) => (a: AgentSummary) =>
  projectId === null || a.scope !== "project" || a.projectId === projectId;

function Catalog({
  projectId,
  state,
  projects,
  onOpen,
}: {
  projectId: string | null;
  state: AgentsState;
  projects: ProjectSummary[];
  onOpen(opened: Opened): void;
}) {
  const list = useAgentList(projectId);
  if (list.failed && list.agents === null)
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center gap-3">
          {t.failed}
          <Button size="sm" variant="outline" onClick={list.retry}>
            {t.retry}
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (list.agents === null) return <p className="text-sm text-muted-foreground">{t.loading}</p>;
  const shown = list.agents.filter(inProject(projectId));
  const open = (agent: AgentSummary, rename: boolean) => onOpen({ ref: agent.ref, rename });
  const common = { projects, runs: state.runs, onOpen: open };
  return (
    <>
      {list.notices.length > 0 && (
        <Alert>
          <AlertDescription className="grid gap-1">
            {list.notices.map((n) => (
              <p key={`${n.profileName}-${n.text}`}>{n.text}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}
      {list.partialWatch && <p className="text-xs text-muted-foreground">{t.partialWatch}</p>}
      <AgentsSection agents={shown.filter((a) => a.scope !== "system")} {...common} />
      <SystemAgentsSection agents={shown.filter((a) => a.scope === "system")} {...common} />
    </>
  );
}

export function AgentsPage({ state, projects, now, onOpenRun }: Props) {
  const [pref, setPref] = useAgentsProject();
  const [opened, setOpened] = useState<Opened | null>(null);
  const project = effectiveProject(pref, projects);
  const runs = projectRuns(state.runs, project?.id ?? null);
  const runIds = new Set(runs.map((r) => r.id));
  const queued = state.queue.filter((q) => runIds.has(q.runId)).length;
  const positions = new Map(state.queue.map((q) => [q.runId, q.position]));
  const waiting = runs.filter((r) => r.state === "waiting_input").length;
  if (opened)
    return (
      <AgentSheet
        key={opened.ref}
        agentRef={opened.ref}
        projects={projects}
        hostSlots={state.host.hostSlots}
        startRename={opened.rename}
        onClose={() => setOpened(null)}
        onRenamed={(ref) => setOpened({ ref, rename: false })}
      />
    );
  return (
    <div className="grid content-start gap-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        <span className="flex-1" />
        <ProjectFilter projects={projects} value={pref} onChange={setPref} />
      </div>
      <ul aria-label={t.title} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          state="running"
          value={frAgentsPage.stats.slots(state.host.used, state.host.hostSlots)}
          label={t.stats.running}
        />
        <Stat state="queued" value={String(queued)} label={t.stats.queued} />
        <Stat state="waiting_input" value={String(waiting)} label={t.stats.waiting} />
        <Stat
          state="cancelled"
          value={formatTokens(state.tokensToday)}
          label={t.stats.tokens}
          help={frAgentsPage.stats.tokensHelp}
        />
      </ul>
      <Catalog projectId={project?.id ?? null} state={state} projects={projects} onOpen={setOpened} />
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
