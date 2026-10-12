import {
  type AgentSummary,
  isTerminal,
  type ProjectSummary,
  parseAgentRef,
  type RunView,
} from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Badge } from "@kibo/sdk/ui/badge";
import { Bot, EyeOff, Globe, TriangleAlert } from "lucide-react";
import { frAgentsSkills } from "../../i18n/fr-agents-skills";
import { Mention } from "../mention/Mention";
import { agentStatus, modelText, projectName, scopeText } from "./agent-labels";

type Props = {
  agent: AgentSummary;
  projects: readonly ProjectSummary[];
  runs: readonly RunView[];
  onOpen(): void;
  onRename(): void;
};

const t = frAgentsSkills.card;

function ScopeBadge({ agent, projects }: Pick<Props, "agent" | "projects">) {
  const color = projects.find((p) => p.id === agent.projectId)?.color;
  return (
    <Badge variant="outline" className="shrink-0 gap-1 text-[10px] font-normal">
      {agent.scope === "global" && <Globe aria-hidden className="size-3" />}
      {color && <span aria-hidden className="size-1.5 rounded-full" style={{ background: color }} />}
      {scopeText(agent, projects)}
    </Badge>
  );
}

function shadowPlace(agent: AgentSummary, projects: readonly ProjectSummary[]): string {
  if (agent.shadowedBy === null) return "";
  const by = parseAgentRef(agent.shadowedBy);
  return by.scope === "project"
    ? projectName(by.projectId, projects)
    : scopeText({ scope: by.scope, projectId: null }, projects);
}

function RunLine({ agent, runs }: Pick<Props, "agent" | "runs">) {
  const active = runs.filter(
    (r) => r.profileId === agent.ref && !isTerminal(r.state) && r.state !== "queued",
  );
  const first = active[0];
  if (first)
    return (
      <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-blue-500" />
        <span className="shrink-0">{t.running}</span>
        <Mention runId={first.id} label={first.label} className="min-w-0 truncate" />
      </p>
    );
  return (
    <p className="text-xs text-muted-foreground">
      {agent.activeRuns > 0 ? t.active(agent.activeRuns) : t.idle}
    </p>
  );
}

function StatusLine({ agent, projects, runs, onRename }: Omit<Props, "onOpen">) {
  const status = agentStatus(agent);
  if (status === "unreadable")
    return (
      <Badge
        variant="outline"
        className="w-fit border-destructive/50 text-[10px] font-normal text-destructive"
      >
        {t.unreadable}
      </Badge>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "shadowed" ? (
        <Badge variant="outline" className="gap-1 text-[10px] font-normal">
          <EyeOff aria-hidden className="size-3" />
          {t.shadowed(shadowPlace(agent, projects))}
        </Badge>
      ) : (
        <RunLine agent={agent} runs={runs} />
      )}
      {!agent.settings.enabled && (
        <Badge variant="outline" className="text-[10px] font-normal">
          {t.disabled}
        </Badge>
      )}
      {agent.nameWarning !== null && (
        <span className="flex items-center gap-2 text-xs">
          <Badge
            variant="outline"
            title={agent.nameWarning}
            className="gap-1 border-amber-500/60 text-[10px] font-normal text-amber-700 dark:text-amber-400"
          >
            <TriangleAlert aria-hidden className="size-3" />
            {t.vague}
          </Badge>
          <button type="button" className="underline underline-offset-2" onClick={onRename}>
            {t.rename}
          </button>
        </span>
      )}
    </div>
  );
}

export function AgentCard({ agent, projects, runs, onOpen, onRename }: Props) {
  const unreadable = agent.problem !== null;
  const meta = [modelText(agent.model), t.skills(agent.skillsCount), t.subagents(agent.subagentsCount)];
  return (
    <article
      aria-label={agent.name}
      className={cn(
        "grid content-start gap-2 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20",
        unreadable && "border-destructive/60",
      )}
    >
      <header className="flex min-w-0 items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-md border">
          {unreadable ? (
            <TriangleAlert aria-hidden className="size-4 text-destructive" />
          ) : (
            <Bot aria-hidden className="size-4" />
          )}
        </span>
        <button
          type="button"
          aria-label={t.open(agent.name)}
          onClick={onOpen}
          className="min-w-0 flex-1 truncate text-left font-mono text-sm font-semibold hover:underline"
        >
          {agent.name}
        </button>
        <ScopeBadge agent={agent} projects={projects} />
      </header>
      {unreadable ? (
        <p className="text-xs text-destructive">{agent.problem}</p>
      ) : (
        <>
          <p className="line-clamp-2 text-xs text-muted-foreground">{agent.description}</p>
          <p className="text-xs">{meta.join(" · ")}</p>
        </>
      )}
      <StatusLine agent={agent} projects={projects} runs={runs} onRename={onRename} />
    </article>
  );
}
