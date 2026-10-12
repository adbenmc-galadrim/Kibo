import type { AgentSummary, ProjectSummary, RunView } from "@kibo/schema";
import { frAgentsSkills } from "../../i18n/fr-agents-skills";
import { AgentCard } from "./AgentCard";

type Props = {
  agents: readonly AgentSummary[];
  projects: readonly ProjectSummary[];
  runs: readonly RunView[];
  onOpen(agent: AgentSummary, rename: boolean): void;
};

const t = frAgentsSkills.page;

export function AgentGrid({ agents, projects, runs, onOpen }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent) => (
        <AgentCard
          key={agent.ref}
          agent={agent}
          projects={projects}
          runs={runs}
          onOpen={() => onOpen(agent, false)}
          onRename={() => onOpen(agent, true)}
        />
      ))}
    </div>
  );
}

export function AgentsSection(props: Props) {
  const folders = props.projects.filter((p) => p.folder !== null).map((p) => p.name);
  return (
    <section aria-label={t.mine} className="grid gap-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-md font-semibold">{t.mine}</h2>
        <span className="text-xs text-muted-foreground">{props.agents.length}</span>
        <span className="flex-1" />
        <span className="font-mono text-2xs text-muted-foreground">{t.roots(folders)}</span>
      </div>
      {props.agents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.noAgent}</p>
      ) : (
        <AgentGrid {...props} />
      )}
    </section>
  );
}
